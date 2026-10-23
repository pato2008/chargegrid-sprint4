"""
ChargeGrid Intelligence — Simulador energético (Sprint 4)
=========================================================

Simula, em passos de 15 minutos, um estacionamento comercial com:
  - geração fotovoltaica (inversor híbrido GoodWe),
  - banco de baterias GoodWe (linha Lynx),
  - carregadores GoodWe HCA (GW22K-HCA e GW7K-HCA),
  - consumo próprio do estabelecimento,
  - limite de demanda contratada com a distribuidora.

Compara três estratégias com EXATAMENTE os mesmos carros, sol e consumo:
  1. SEM GESTÃO  -> cada carro carrega na potência máxima assim que conecta;
                    o inversor faz só o autoconsumo padrão (sem saber dos carros).
  2. REGRA ANTERIOR -> o código ORIGINAL da equipe (backend_python/
                    gerenciamentoDeRecarga.py) decide a potência: se a soma dos
                    carregadores passa de 100 kW, redistribui.
  3. CHARGEGRID  -> o algoritmo decide a potência de cada carregador a cada
                    15 min: solar primeiro, bateria guardada para a ponta,
                    rede só fora da ponta e nunca acima da demanda contratada.

Saídas:
  resultados/resultados.json        -> todos os indicadores
  resultados/resultados.md          -> tabela pronta para o README
  resultados/serie_temporal.csv     -> série de 15 em 15 min (para o dashboard)
  docs/img/*.png                    -> gráficos

Uso:
  python analise/simulador_chargegrid.py            # 30 dias, semente 42
  python analise/simulador_chargegrid.py --dias 7 --semente 1

Todos os dados são SIMULADOS. As premissas estão na classe Cenario.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import random
from dataclasses import dataclass, field, asdict
import sys
from pathlib import Path
from types import SimpleNamespace

# Reaproveita o código da Sprint anterior (Data Structures) sem alterá-lo
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend_python"))
from gerenciamentoDeRecarga import GerenciamentoDeRecarga  # noqa: E402

# --------------------------------------------------------------------------
# 1. Premissas do cenário (abstração: tudo que é "número mágico" fica aqui)
# --------------------------------------------------------------------------

PASSO_H = 0.25  # 15 minutos, em horas
PASSOS_POR_DIA = int(24 / PASSO_H)


@dataclass
class Cenario:
    """Parâmetros do estacionamento comercial simulado."""

    # Equipamentos GoodWe
    carregadores_22kw: int = 4          # GW22K-HCA (trifásico)
    carregadores_7kw: int = 2           # GW7K-HCA (monofásico)
    solar_kwp: float = 200.0            # potência de pico dos painéis (telhado de supermercado)
    bateria_kwh: float = 150.0          # capacidade útil do banco de baterias GoodWe
    bateria_kw: float = 60.0            # potência máx. de carga/descarga
    bateria_soc_min: float = 0.20       # nunca descarrega abaixo de 20%
    bateria_soc_inicial: float = 0.50
    bateria_eficiencia: float = 0.95    # eficiência em cada sentido

    # Rede elétrica
    demanda_contratada_kw: float = 100.0   # mesmo limite usado no sistema (tick())
    margem_seguranca: float = 0.95         # o algoritmo mira 95% do limite

    # Estabelecimento
    consumo_aberto_kw: float = 35.0     # consumo base com a loja aberta (8h-22h)
    consumo_fechado_kw: float = 10.0

    # Demanda de recarga
    carros_por_dia: float = 18.0        # média (distribuição de Poisson)

    # Fator de emissão do SIN (MCTI/SIRENE, média jan-abr/2025, tCO2/MWh)
    fator_emissao_t_por_mwh: float = 0.0247

    # Tarifas por horário — iguais às de current_tariff_hourly() no Supabase
    @staticmethod
    def tarifa(hora: int) -> float:
        if 18 <= hora <= 21:
            return 0.95          # ponta
        if hora >= 22 or hora <= 6:
            return 0.65          # madrugada
        return 0.80              # intermediário

    @staticmethod
    def horario_ponta(hora: int) -> bool:
        return 18 <= hora <= 21


# --------------------------------------------------------------------------
# 2. Entidades (estruturas de dados)
# --------------------------------------------------------------------------

TIPOS_RECARGA = {
    # tipo: (probabilidade, potência máxima desejada em kW, peso de prioridade)
    "lenta": (0.40, 7.4, 1),
    "rapida": (0.45, 22.0, 2),
    "prioridade": (0.15, 22.0, 3),   # HCA é AC: máximo físico de 22 kW
}


@dataclass
class Veiculo:
    id: int
    tipo: str
    chegada: int                 # índice do passo de chegada
    saida: int                   # índice do passo de saída
    energia_desejada_kwh: float
    energia_entregue_kwh: float = 0.0
    carregador_kw: float = 0.0   # potência do carregador em que conectou
    atendido: bool = False       # conseguiu vaga com carregador?
    potencia_equipe: float | None = None   # memória da regra anterior

    @property
    def energia_restante(self) -> float:
        return max(0.0, self.energia_desejada_kwh - self.energia_entregue_kwh)

    @property
    def potencia_max(self) -> float:
        return min(TIPOS_RECARGA[self.tipo][1], self.carregador_kw)

    @property
    def peso(self) -> int:
        return TIPOS_RECARGA[self.tipo][2]

    def potencia_minima_necessaria(self, passo: int) -> float:
        """Potência constante que ainda termina a recarga antes da saída."""
        horas_restantes = max(PASSO_H, (self.saida - passo) * PASSO_H)
        return min(self.potencia_max, self.energia_restante / horas_restantes)


@dataclass
class Bateria:
    capacidade_kwh: float
    potencia_kw: float
    soc_min: float
    eficiencia: float
    energia_kwh: float = 0.0

    @property
    def soc(self) -> float:
        return self.energia_kwh / self.capacidade_kwh

    def disponivel_descarga_kw(self, soc_piso: float | None = None) -> float:
        piso = self.soc_min if soc_piso is None else max(self.soc_min, soc_piso)
        energia_livre = max(0.0, self.energia_kwh - piso * self.capacidade_kwh)
        return min(self.potencia_kw, energia_livre * self.eficiencia / PASSO_H)

    def disponivel_carga_kw(self) -> float:
        espaco = self.capacidade_kwh - self.energia_kwh
        return min(self.potencia_kw, espaco / self.eficiencia / PASSO_H)

    def descarregar(self, kw: float) -> None:
        self.energia_kwh -= kw * PASSO_H / self.eficiencia

    def carregar(self, kw: float) -> None:
        self.energia_kwh += kw * PASSO_H * self.eficiencia


# --------------------------------------------------------------------------
# 3. Geração dos dados de entrada (sol, consumo, carros)
# --------------------------------------------------------------------------

def gerar_solar(c: Cenario, dias: int, rnd: random.Random) -> list[float]:
    """Curva em sino entre 6h e 18h, com nebulosidade sorteada por dia."""
    serie = []
    for _ in range(dias):
        ceu_limpo = rnd.uniform(0.35, 1.0)
        for p in range(PASSOS_POR_DIA):
            h = p * PASSO_H + PASSO_H / 2
            if 6 < h < 18:
                base = math.sin(math.pi * (h - 6) / 12)
                serie.append(c.solar_kwp * 0.80 * base * ceu_limpo * rnd.uniform(0.9, 1.0))
            else:
                serie.append(0.0)
    return serie


def gerar_consumo(c: Cenario, dias: int, rnd: random.Random) -> list[float]:
    serie = []
    for _ in range(dias):
        for p in range(PASSOS_POR_DIA):
            h = p * PASSO_H
            if 8 <= h < 22:
                extra = 10.0 if 12 <= h < 16 else 0.0   # ar-condicionado à tarde
                serie.append(c.consumo_aberto_kw + extra + rnd.uniform(-3, 3))
            else:
                serie.append(c.consumo_fechado_kw + rnd.uniform(-1, 1))
    return serie


def _poisson(rnd: random.Random, media: float) -> int:
    limite, k, prod = math.exp(-media), 0, 1.0
    while True:
        prod *= rnd.random()
        if prod <= limite:
            return k
        k += 1


def gerar_veiculos(c: Cenario, dias: int, rnd: random.Random) -> list[Veiculo]:
    veiculos, vid = [], 0
    tipos = list(TIPOS_RECARGA)
    pesos = [TIPOS_RECARGA[t][0] for t in tipos]
    for d in range(dias):
        for _ in range(_poisson(rnd, c.carros_por_dia)):
            # 60% chegam ao longo do dia, 40% no pico pós-expediente (17h-20h)
            hora = rnd.uniform(9, 17) if rnd.random() < 0.6 else rnd.uniform(17, 20.5)
            permanencia = rnd.uniform(1.5, 4.0)
            chegada = d * PASSOS_POR_DIA + int(hora / PASSO_H)
            saida = min(chegada + max(1, int(permanencia / PASSO_H)), dias * PASSOS_POR_DIA)
            veiculos.append(Veiculo(
                id=vid,
                tipo=rnd.choices(tipos, pesos)[0],
                chegada=chegada,
                saida=saida,
                energia_desejada_kwh=rnd.uniform(8, 30),
            ))
            vid += 1
    return veiculos


# --------------------------------------------------------------------------
# 4. Estratégias de controle (o "cérebro")
# --------------------------------------------------------------------------

def estrategia_sem_gestao(conectados, passo, hora, solar, consumo, bateria, c):
    """Cada carro puxa a potência máxima. Bateria em autoconsumo padrão."""
    return {v.id: min(v.potencia_max, v.energia_restante / PASSO_H) for v in conectados}


def estrategia_equipe(conectados, passo, hora, solar, consumo, bateria, c):
    """
    Regra da sprint anterior (Data Structures), executada com o código ORIGINAL da equipe:
    GerenciamentoDeRecarga.gerenciarCarregamento() -> redistribuirCarregamento().
    Os carros da simulação são "adaptados" para os atributos que o código
    original espera (bateria, potencia, potenciaMaxima).
    """
    ger = GerenciamentoDeRecarga()
    ger.demandaContratada = c.demanda_contratada_kw
    adaptadores = []
    for v in conectados:
        if v.potencia_equipe is None:          # carro novo entra na potência máxima
            v.potencia_equipe = v.potencia_max
        adaptadores.append(SimpleNamespace(
            ref=v, potenciaMaxima=v.potencia_max, potencia=v.potencia_equipe,
            bateria=100 * v.energia_entregue_kwh / v.energia_desejada_kwh))
    ger.carrosAtivos = adaptadores
    if adaptadores:
        ger.gerenciarCarregamento()
    alocado = {}
    for a in adaptadores:
        a.ref.potencia_equipe = a.potencia     # a regra original nunca devolve a potência cortada
        # o carregador não entrega mais que o seu máximo físico (a regra pede até 1,4x)
        alocado[a.ref.id] = min(a.potencia, a.ref.potencia_max, a.ref.energia_restante / PASSO_H)
    return alocado


def estrategia_chargegrid(conectados, passo, hora, solar, consumo, bateria, c):
    """
    Algoritmo de decisão do ChargeGrid. Regras, em ordem:
      1. Segurança: importação da rede <= 95% da demanda contratada.
      2. Garantia: cada carro recebe a potência mínima para terminar antes de sair.
      3. Energia limpa: excedente solar (e bateria na ponta) vai para os carros.
      4. Rede: fora da ponta completa até a potência máxima; na ponta, não.
      5. Ordem: prioridade > rápida > lenta; empate -> menor folga de tempo.
    """
    ponta = c.horario_ponta(hora)
    sobra_solar = max(0.0, solar - consumo)
    # Fora da ponta a bateria fica reservada (só ajuda acima de 80% de carga)
    bateria_livre = bateria.disponivel_descarga_kw() if ponta else bateria.disponivel_descarga_kw(soc_piso=0.80)
    limite_rede = c.demanda_contratada_kw * c.margem_seguranca
    rede_livre = max(0.0, limite_rede - max(0.0, consumo - solar))

    energia_limpa = sobra_solar + bateria_livre
    teto_total = energia_limpa + rede_livre          # nunca ultrapassa a demanda
    orcamento_rede = rede_livre if not ponta else 0.0

    ordem = sorted(conectados,
                   key=lambda v: (-v.peso, (v.saida - passo) - v.energia_restante / max(v.potencia_max, 0.1)))
    alocado = {v.id: 0.0 for v in conectados}
    restante = teto_total

    # Regra 2: mínimo necessário (pode usar rede mesmo na ponta, para não deixar carro sem carga)
    for v in ordem:
        p = min(v.potencia_minima_necessaria(passo), restante)
        alocado[v.id] = p
        restante -= p
    limpa_restante = max(0.0, energia_limpa - sum(alocado.values()))
    rede_restante = max(0.0, min(restante, orcamento_rede - max(0.0, sum(alocado.values()) - energia_limpa)))

    # Regras 3 e 4: completa com energia limpa e depois com rede (se permitido)
    for fonte in ("limpa", "rede"):
        for v in ordem:
            folga = min(v.potencia_max, v.energia_restante / PASSO_H) - alocado[v.id]
            if folga <= 0:
                continue
            disponivel = limpa_restante if fonte == "limpa" else rede_restante
            p = min(folga, disponivel)
            alocado[v.id] += p
            if fonte == "limpa":
                limpa_restante -= p
            else:
                rede_restante -= p
    return alocado


# --------------------------------------------------------------------------
# 5. Motor da simulação (automação: roda sozinho passo a passo)
# --------------------------------------------------------------------------

@dataclass
class Resultado:
    nome: str
    serie: list[dict] = field(default_factory=list)
    veiculos: list[Veiculo] = field(default_factory=list)


def simular(nome, estrategia, c, solar, consumo, veiculos_base) -> Resultado:
    # copia os carros para as duas estratégias partirem do mesmo ponto
    veiculos = [Veiculo(**{k: getattr(v, k) for k in
                           ("id", "tipo", "chegada", "saida", "energia_desejada_kwh")})
                for v in veiculos_base]
    por_chegada: dict[int, list[Veiculo]] = {}
    for v in veiculos:
        por_chegada.setdefault(v.chegada, []).append(v)

    bateria = Bateria(c.bateria_kwh, c.bateria_kw, c.bateria_soc_min, c.bateria_eficiencia,
                      c.bateria_soc_inicial * c.bateria_kwh)
    vagas_livres = [22.0] * c.carregadores_22kw + [7.4] * c.carregadores_7kw
    conectados: list[Veiculo] = []
    res = Resultado(nome, veiculos=veiculos)

    for passo in range(len(solar)):
        hora = int((passo % PASSOS_POR_DIA) * PASSO_H)

        # saídas: libera o carregador
        for v in [v for v in conectados if v.saida <= passo or v.energia_restante <= 1e-6]:
            conectados.remove(v)
            vagas_livres.append(v.carregador_kw)

        # chegadas: carro lento prefere carregador de 7 kW
        for v in por_chegada.get(passo, []):
            if not vagas_livres:
                continue        # sem vaga com carregador: não atendido
            vagas_livres.sort(reverse=(v.tipo != "lenta"))
            v.carregador_kw = vagas_livres.pop(0)
            v.atendido = True
            conectados.append(v)

        # decisão
        try:
            potencias = estrategia(conectados, passo, hora, solar[passo], consumo[passo], bateria, c)
        except ZeroDivisionError as erro:     # proteção contra dado inválido
            raise RuntimeError(f"Falha na estratégia {nome} no passo {passo}") from erro

        carga_ve = sum(potencias.values())
        for v in conectados:
            v.energia_entregue_kwh += potencias[v.id] * PASSO_H

        # balanço de energia: solar atende o consumo, depois os carros
        s = solar[passo]
        solar_p_consumo = min(s, consumo[passo])
        solar_p_ve = min(s - solar_p_consumo, carga_ve)
        sobra = s - solar_p_consumo - solar_p_ve

        falta_consumo = consumo[passo] - solar_p_consumo
        falta_ve = carga_ve - solar_p_ve
        ponta = Cenario.horario_ponta(hora)

        # bateria
        bat_p_ve = bat_p_consumo = bat_carga = 0.0
        if nome == "ChargeGrid":
            livre = bateria.disponivel_descarga_kw() if ponta else bateria.disponivel_descarga_kw(0.80)
            bat_p_ve = min(falta_ve, livre)
            livre -= bat_p_ve
            if ponta:
                bat_p_consumo = min(falta_consumo, livre)
        else:  # autoconsumo padrão: descarrega para o que faltar, a qualquer hora
            livre = bateria.disponivel_descarga_kw()
            bat_p_consumo = min(falta_consumo, livre)
            bat_p_ve = min(falta_ve, livre - bat_p_consumo)
        bateria.descarregar(bat_p_ve + bat_p_consumo)
        if sobra > 0:
            bat_carga = min(sobra, bateria.disponivel_carga_kw())
            bateria.carregar(bat_carga)

        rede_ve = falta_ve - bat_p_ve
        rede_consumo = falta_consumo - bat_p_consumo
        exportado = sobra - bat_carga

        res.serie.append({
            "passo": passo, "dia": passo // PASSOS_POR_DIA, "hora": round((passo % PASSOS_POR_DIA) * PASSO_H, 2),
            "solar_kw": round(s, 3), "consumo_kw": round(consumo[passo], 3), "carga_ve_kw": round(carga_ve, 3),
            "ve_solar_kw": round(solar_p_ve, 3), "ve_bateria_kw": round(bat_p_ve, 3), "ve_rede_kw": round(rede_ve, 3),
            "rede_total_kw": round(rede_ve + rede_consumo, 3), "exportado_kw": round(exportado, 3),
            "bateria_soc": round(bateria.soc, 4), "tarifa": Cenario.tarifa(hora), "ponta": ponta,
            "carros_conectados": len(conectados),
        })
    return res


# --------------------------------------------------------------------------
# 6. Indicadores
# --------------------------------------------------------------------------

def indicadores(r: Resultado, c: Cenario) -> dict:
    s = r.serie
    e = lambda chave: sum(x[chave] for x in s) * PASSO_H
    ve_total, ve_solar, ve_bat, ve_rede = e("carga_ve_kw"), e("ve_solar_kw"), e("ve_bateria_kw"), e("ve_rede_kw")
    solar_total, exportado = e("solar_kw"), e("exportado_kw")
    ve_rede_ponta = sum(x["ve_rede_kw"] for x in s if x["ponta"]) * PASSO_H
    custo_rede_ve = sum(x["ve_rede_kw"] * PASSO_H * x["tarifa"] for x in s)
    atendidos = [v for v in r.veiculos if v.atendido]
    pedida = sum(v.energia_desejada_kwh for v in atendidos)
    entregue = sum(v.energia_entregue_kwh for v in atendidos)
    completos = sum(1 for v in atendidos if v.energia_restante <= 0.5)
    renovavel = ve_solar + ve_bat
    return {
        "estrategia": r.nome,
        "energia_recarga_kwh": round(ve_total, 1),
        "recarga_renovavel_pct": round(100 * renovavel / ve_total, 1) if ve_total else 0,
        "recarga_rede_ponta_kwh": round(ve_rede_ponta, 1),
        "pico_rede_kw": round(max(x["rede_total_kw"] for x in s), 1),
        "intervalos_acima_demanda": sum(1 for x in s if x["rede_total_kw"] > c.demanda_contratada_kw),
        "custo_rede_recarga_brl": round(custo_rede_ve, 2),
        "custo_medio_kwh_recarga_brl": round(custo_rede_ve / ve_total, 3) if ve_total else 0,
        "autoconsumo_solar_pct": round(100 * (1 - exportado / solar_total), 1) if solar_total else 0,
        "carros_atendidos": len(atendidos),
        "carros_sem_vaga": len(r.veiculos) - len(atendidos),
        "energia_entregue_pct": round(100 * entregue / pedida, 1) if pedida else 0,
        "recargas_completas_pct": round(100 * completos / len(atendidos), 1) if atendidos else 0,
        "co2_evitado_kg": round(renovavel * c.fator_emissao_t_por_mwh, 1),   # kWh * t/MWh = kg
    }


# --------------------------------------------------------------------------
# 7. Gráficos
# --------------------------------------------------------------------------

COR = {"solar": "#eda100", "bateria": "#1baf7a", "rede": "#2a78d6",
       "sem": "#eb6834", "eq": "#6250d6", "cg": "#2a78d6", "texto": "#0b0b0b", "texto2": "#52514e",
       "grade": "#e6e5e0", "fundo": "#fcfcfb"}


def _estilo(ax, titulo):
    ax.set_facecolor(COR["fundo"])
    for lado in ("top", "right"):
        ax.spines[lado].set_visible(False)
    for lado in ("left", "bottom"):
        ax.spines[lado].set_color(COR["grade"])
    ax.tick_params(colors=COR["texto2"], labelsize=9)
    ax.grid(axis="y", color=COR["grade"], linewidth=0.8)
    ax.set_axisbelow(True)
    ax.set_title(titulo, loc="left", fontsize=11, color=COR["texto"], fontweight="bold")


def escolher_dia(r: Resultado) -> int:
    """Dia com mais sol e muitos carros: bom para mostrar o algoritmo."""
    dias = {}
    for x in r.serie:
        d = dias.setdefault(x["dia"], [0.0, 0.0])
        d[0] += x["solar_kw"]
        d[1] += x["carga_ve_kw"]
    return max(dias, key=lambda d: dias[d][0] * dias[d][1])


def graficos(sem: Resultado, eq: Resultado, cg: Resultado, ind_sem: dict, ind_eq: dict, ind_cg: dict,
             c: Cenario, pasta: Path):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    pasta.mkdir(parents=True, exist_ok=True)
    dia = escolher_dia(cg)
    fatia = lambda r: [x for x in r.serie if x["dia"] == dia]
    horas = [x["hora"] for x in fatia(cg)]

    # 1) De onde vem a energia da recarga (lado a lado)
    fig, eixos = plt.subplots(1, 3, figsize=(15, 4.2), sharey=True, facecolor=COR["fundo"])
    for ax, r, titulo in ((eixos[0], sem, "Sem gestão"), (eixos[1], eq, "Regra anterior (Data Structures)"),
                          (eixos[2], cg, "ChargeGrid (Sprint 4)")):
        d = fatia(r)
        ax.stackplot(horas, [x["ve_solar_kw"] for x in d], [x["ve_bateria_kw"] for x in d],
                     [x["ve_rede_kw"] for x in d], colors=[COR["solar"], COR["bateria"], COR["rede"]],
                     labels=["Solar", "Bateria", "Rede"], edgecolor=COR["fundo"], linewidth=0.6)
        ax.axvspan(18, 22, color="#d9d8d2", alpha=0.35, linewidth=0, zorder=0)
        ax.text(20, ax.get_ylim()[1] * 0.02 if ax.get_ylim()[1] else 1, "ponta", ha="center",
                fontsize=8, color=COR["texto2"])
        _estilo(ax, titulo)
        ax.set_xlim(6, 24)
        ax.set_xticks(range(6, 25, 3))
        ax.set_xlabel("Hora do dia", color=COR["texto2"], fontsize=9)
    eixos[0].set_ylabel("Potência de recarga (kW)", color=COR["texto2"], fontsize=9)
    eixos[2].legend(loc="upper left", frameon=False, fontsize=9)
    fig.suptitle(f"De onde vem a energia que carrega os carros — dia simulado nº {dia + 1}",
                 x=0.01, ha="left", fontsize=12, color=COR["texto"])
    fig.tight_layout()
    fig.savefig(pasta / "fonte_energia_recarga.png", dpi=150)
    plt.close(fig)

    # 2) Demanda da rede x limite contratado
    fig, ax = plt.subplots(figsize=(12, 4.2), facecolor=COR["fundo"])
    ax.plot(horas, [x["rede_total_kw"] for x in fatia(sem)], color=COR["sem"], linewidth=5, alpha=0.55,
            label="Sem gestão (linha larga, por baixo)")
    ax.plot(horas, [x["rede_total_kw"] for x in fatia(eq)], color=COR["eq"], linewidth=2, label="Regra anterior (Data Structures)")
    ax.plot(horas, [x["rede_total_kw"] for x in fatia(cg)], color=COR["cg"], linewidth=2, label="ChargeGrid (Sprint 4)")
    ax.axhline(c.demanda_contratada_kw, color=COR["texto"], linewidth=1.2, linestyle="--")
    ax.text(7.0, c.demanda_contratada_kw + 2, f"Demanda contratada ({c.demanda_contratada_kw:.0f} kW)",
            fontsize=9, color=COR["texto"])
    ax.axvspan(18, 22, color="#d9d8d2", alpha=0.35, linewidth=0, zorder=0)
    _estilo(ax, f"Potência puxada da rede pelo estabelecimento — dia simulado nº {dia + 1}")
    ax.set_xlim(0, 24)
    ax.set_xticks(range(0, 25, 3))
    ax.set_xlabel("Hora do dia", color=COR["texto2"], fontsize=9)
    ax.set_ylabel("kW", color=COR["texto2"], fontsize=9)
    ax.legend(loc="upper left", frameon=False, fontsize=9)
    fig.tight_layout()
    fig.savefig(pasta / "demanda_rede.png", dpi=150)
    plt.close(fig)

    # 3) Resumo: 4 indicadores em pequenos múltiplos (um eixo por unidade)
    metricas = [
        ("recarga_renovavel_pct", "Recarga com energia solar/bateria", "%"),
        ("pico_rede_kw", "Pico de demanda da rede", "kW"),
        ("recarga_rede_ponta_kwh", "Recarga com rede no horário de ponta", "kWh"),
        ("custo_medio_kwh_recarga_brl", "Custo de rede por kWh recarregado", "R$/kWh"),
    ]
    fig, eixos = plt.subplots(1, 4, figsize=(15, 3.9), facecolor=COR["fundo"])
    for ax, (chave, titulo, unidade) in zip(eixos, metricas):
        valores = [ind_sem[chave], ind_eq[chave], ind_cg[chave]]
        barras = ax.bar(["Sem\ngestão", "Regra\nanterior", "ChargeGrid"], valores,
                        color=[COR["sem"], COR["eq"], COR["cg"]], width=0.6)
        for b, val in zip(barras, valores):
            ax.text(b.get_x() + b.get_width() / 2, b.get_height(), f"{val:g} {unidade}".replace(".", ","),
                    ha="center", va="bottom", fontsize=9, color=COR["texto"])
        _estilo(ax, "")
        ax.set_title(titulo, fontsize=9.5, color=COR["texto"], loc="left", wrap=True)
        ax.set_yticks([])
        ax.spines["left"].set_visible(False)
        ax.set_ylim(0, max(valores) * 1.25 if max(valores) else 1)
    fig.suptitle(f"Resultado em {len(cg.serie) // PASSOS_POR_DIA} dias simulados — mesmos carros, mesmo sol",
                 x=0.01, ha="left", fontsize=12, color=COR["texto"])
    fig.tight_layout()
    fig.savefig(pasta / "resumo_indicadores.png", dpi=150)
    plt.close(fig)
    return dia


# --------------------------------------------------------------------------
# 8. Execução
# --------------------------------------------------------------------------

def main():
    try:  # terminais do Windows sem UTF-8 não quebram com acentos ou "₂"
        sys.stdout.reconfigure(errors="replace")
    except AttributeError:
        pass
    ap = argparse.ArgumentParser(description="Simulador energético ChargeGrid")
    ap.add_argument("--dias", type=int, default=30)
    ap.add_argument("--semente", type=int, default=42)
    ap.add_argument("--saida", default=".")
    args = ap.parse_args()
    if args.dias < 1:
        ap.error("--dias precisa ser >= 1")

    raiz = Path(args.saida)
    print("=" * 64)
    print(" ChargeGrid Intelligence — simulador energético (Sprint 4)")
    print(f" {args.dias} dias | passos de 15 min | 200 kWp solar | bateria 150 kWh")
    print(" 4x GoodWe GW22K-HCA + 2x GW7K-HCA | demanda contratada 100 kW")
    print("=" * 64)
    print("Simulando 3 estratégias com os mesmos carros e o mesmo sol...\n")
    c = Cenario()
    rnd = random.Random(args.semente)
    solar = gerar_solar(c, args.dias, rnd)
    consumo = gerar_consumo(c, args.dias, rnd)
    veiculos = gerar_veiculos(c, args.dias, rnd)

    sem = simular("Sem gestão", estrategia_sem_gestao, c, solar, consumo, veiculos)
    eq = simular("Regra anterior", estrategia_equipe, c, solar, consumo, veiculos)
    cg = simular("ChargeGrid", estrategia_chargegrid, c, solar, consumo, veiculos)
    ind_sem, ind_eq, ind_cg = indicadores(sem, c), indicadores(eq, c), indicadores(cg, c)
    try:
        dia = graficos(sem, eq, cg, ind_sem, ind_eq, ind_cg, c, raiz / "docs" / "img")
    except ImportError:
        dia = escolher_dia(cg)
        print("Aviso: matplotlib não instalado, gráficos não foram gerados (pip install matplotlib).\n")

    pasta = raiz / "resultados"
    pasta.mkdir(parents=True, exist_ok=True)
    (pasta / "resultados.json").write_text(json.dumps({
        "dias_simulados": args.dias, "semente": args.semente, "dia_dos_graficos": dia + 1,
        "cenario": asdict(c), "sem_gestao": ind_sem, "regra_anterior": ind_eq, "chargegrid": ind_cg,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    with open(pasta / "serie_temporal.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["estrategia"] + list(cg.serie[0]))
        w.writeheader()
        for r in (sem, eq, cg):
            for x in r.serie:
                w.writerow({"estrategia": r.nome, **x})

    linhas = [
        ("Recarga com energia solar/bateria (%)", "recarga_renovavel_pct"),
        ("Recarga com rede no horário de ponta (kWh)", "recarga_rede_ponta_kwh"),
        ("Pico de demanda da rede (kW)", "pico_rede_kw"),
        ("Intervalos de 15 min acima da demanda contratada", "intervalos_acima_demanda"),
        ("Custo de rede da recarga (R$)", "custo_rede_recarga_brl"),
        ("Custo de rede por kWh recarregado (R$)", "custo_medio_kwh_recarga_brl"),
        ("Autoconsumo da geração solar (%)", "autoconsumo_solar_pct"),
        ("Energia pedida que foi entregue (%)", "energia_entregue_pct"),
        ("Recargas completas (%)", "recargas_completas_pct"),
        ("CO₂ evitado na recarga (kg)", "co2_evitado_kg"),
    ]
    md = ["| Indicador | Sem gestão | Regra anterior | ChargeGrid (Sprint 4) |", "|---|---|---|---|"]
    md += [f"| {rot} | {ind_sem[k]:g} | {ind_eq[k]:g} | {ind_cg[k]:g} |" for rot, k in linhas]
    (pasta / "resultados.md").write_text("\n".join(md) + "\n", encoding="utf-8")

    largura = max(len(rot) for rot, _ in linhas)
    print(f"{'Indicador':<{largura}} | {'Sem gestão':>10} | {'Regra ant.':>10} | {'ChargeGrid':>10}")
    print("-" * (largura + 42))
    for rot, k in linhas:
        print(f"{rot:<{largura}} | {ind_sem[k]:>10g} | {ind_eq[k]:>10g} | {ind_cg[k]:>10g}")
    print(f"\nCarros simulados: {len(veiculos)}"
          f" | sem vaga (ChargeGrid): {ind_cg['carros_sem_vaga']}"
          f" | sem vaga (sem gestão): {ind_sem['carros_sem_vaga']}")
    print("Arquivos gerados: resultados/resultados.json, resultados/serie_temporal.csv, docs/img/*.png")


if __name__ == "__main__":
    main()
