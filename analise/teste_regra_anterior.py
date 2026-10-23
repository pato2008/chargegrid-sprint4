"""
Testes de depuração do código da sprint anterior (backend_python/).

Reproduz três defeitos encontrados em gerenciamentoDeRecarga.py e mostra a
versão corrigida lado a lado. Não altera o código original.

Uso:
  python analise/teste_regra_anterior.py
"""

import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend_python"))
from gerenciamentoDeRecarga import GerenciamentoDeRecarga  # noqa: E402


class OcppSilencioso:
    """Substitui o SimuladorOCPP para os testes não imprimirem JSON."""
    def encerrarSessao(self, carro):
        pass


def novo_gerenciador(tipos):
    g = GerenciamentoDeRecarga()
    for t in tipos:
        g.adicionarCarro(t, "Modelo", "Cliente")
    return g


def bug_1_potencia_acima_do_maximo():
    print("\nBUG 1 — carro prioritário recebe mais que a potência máxima dele")
    g = novo_gerenciador(["3", "3", "2", "2", "2"])
    g.gerenciarCarregamento()
    for c in g.carrosAtivos:
        alerta = "  <-- ACIMA DO MÁXIMO" if c.potencia > c.potenciaMaxima else ""
        print(f"  carro {c.id}: máx {c.potenciaMaxima:>4} kW | recebeu {c.potencia:5.1f} kW{alerta}")
    print("  Causa: potenciaPrioritario = potenciaMaxima * 1.4")
    print("  Correção: min(carroPrioritario.potenciaMaxima, self.demandaContratada)")


def bug_2_ids_repetidos():
    print("\nBUG 2 — IDs repetidos depois que um carro sai")
    g = novo_gerenciador(["1", "1", "1"])
    g.carrosAtivos[0].bateria = 100
    g.removerCarro(OcppSilencioso())
    g.adicionarCarro("1", "Modelo", "Cliente")
    ids = [c.id for c in g.carrosAtivos]
    print(f"  IDs ativos: {ids}  <-- o 3 aparece duas vezes")
    print("  Causa: id = len(self.carrosAtivos) + 1")
    print("  Correção: um contador self.proximoId que só aumenta")


def bug_3_potencia_nunca_volta():
    print("\nBUG 3 — depois de cortar a potência, ela nunca é devolvida")
    g = novo_gerenciador(["3", "3", "2", "2", "2"])
    g.gerenciarCarregamento()
    g.carrosAtivos = g.carrosAtivos[:2]          # 3 carros foram embora
    g.gerenciarCarregamento()
    total = sum(c.potencia for c in g.carrosAtivos)
    for c in g.carrosAtivos:
        print(f"  carro {c.id}: máx {c.potenciaMaxima:>4} kW | recebe {c.potencia:5.1f} kW")
    print(f"  Total {total:.1f} kW de 100 kW disponíveis  <-- capacidade desperdiçada")
    print("  Causa: gerenciarCarregamento() só age quando a soma passa do limite")
    print("  Correção: voltar todos para a potência máxima e só então redistribuir")


def gerenciar_corrigido(carros, limite):
    """Versão corrigida da regra (bugs 1 e 3)."""
    for c in carros:
        c.potencia = c.potenciaMaxima                       # bug 3
    if sum(c.potencia for c in carros) < limite:
        return
    prioritario = min(carros, key=lambda c: c.bateria)
    prioritario.potencia = min(prioritario.potenciaMaxima, limite)   # bug 1
    outros = [c for c in carros if c is not prioritario]
    sobra = limite - prioritario.potencia
    for c in outros:
        c.potencia = min(sobra / len(outros), c.potenciaMaxima)


def demonstrar_correcao():
    print("\nCORRIGIDO — mesma situação do bug 3 com a regra corrigida")
    g = novo_gerenciador(["3", "3", "2", "2", "2"])
    gerenciar_corrigido(g.carrosAtivos, g.demandaContratada)
    print(f"  5 carros: {[round(c.potencia, 1) for c in g.carrosAtivos]} "
          f"(total {sum(c.potencia for c in g.carrosAtivos):.1f} kW)")
    g.carrosAtivos = g.carrosAtivos[:2]
    gerenciar_corrigido(g.carrosAtivos, g.demandaContratada)
    print(f"  2 carros: {[round(c.potencia, 1) for c in g.carrosAtivos]} "
          f"(total {sum(c.potencia for c in g.carrosAtivos):.1f} kW)")


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(errors="replace")
    except AttributeError:
        pass
    random.seed(7)          # Carros.py sorteia a bateria: semente fixa = saída repetível
    bug_1_potencia_acima_do_maximo()
    bug_2_ids_repetidos()
    bug_3_potencia_nunca_volta()
    demonstrar_correcao()
