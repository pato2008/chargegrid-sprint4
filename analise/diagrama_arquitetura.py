"""Gera docs/img/arquitetura.png — diagrama da arquitetura final do ChargeGrid."""
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

FUNDO, TEXTO, TEXTO2, BORDA = "#fcfcfb", "#0b0b0b", "#52514e", "#c9c8c1"
CORES = {"goodwe": "#fdf3dc", "borda": "#eef5fc", "nuvem": "#e8f6f0", "front": "#f3f1fc", "python": "#fdeee7"}

caixas = {
    # chave: (x, y, largura, altura, cor, título, linhas)
    "fv": (0.2, 6.2, 2.7, 1.3, "goodwe", "Painéis fotovoltaicos", ["200 kWp (simulado)"]),
    "inv": (4.1, 6.2, 2.9, 1.3, "goodwe", "Inversor híbrido GoodWe ET", ["+ baterias GoodWe", "+ smart meter"]),
    "hca": (8.2, 6.2, 3.2, 1.3, "goodwe", "Carregadores GoodWe HCA", ["4× GW22K-HCA", "2× GW7K-HCA"]),
    "esp": (8.2, 3.75, 3.2, 1.65, "borda", "ESP32 no Wokwi (C++)", ["potenciômetro: tipo", "botão: inicia recarga", "LCD + LEDs: demanda"]),
    "db": (4.1, 3.75, 2.9, 1.65, "nuvem", "Supabase (PostgreSQL)", ["tick(): divide a potência", "start_session(): OCPP Start", "tarifação por horário"]),
    "py": (0.2, 3.75, 2.7, 1.65, "python", "Simulador Python", ["solar + bateria + HCA", "3 estratégias, 30 dias", "usa o código original"]),
    "front": (4.1, 1.2, 2.9, 1.6, "front", "Dashboard React", ["sessões, demanda, tarifas,", "protocolos OCPP em tempo real"]),
    "res": (0.2, 1.2, 2.7, 1.6, "python", "Resultados", ["resultados.json / .csv", "gráficos em docs/img"]),
}


def centro(k, lado):
    x, y, w, h = caixas[k][:4]
    return {"top": (x + w / 2, y + h), "bottom": (x + w / 2, y), "left": (x, y + h / 2), "right": (x + w, y + h / 2)}[lado]


setas = [
    ("fv", "right", "inv", "left", "CC", True),
    ("inv", "right", "hca", "left", "CA", True),
    ("hca", "bottom", "esp", "top", "papel do controlador", True),
    ("esp", "left", "db", "right", "HTTPS", False),
    ("db", "bottom", "front", "top", "RPC + Realtime", False),
    ("inv", "bottom", "db", "top", "dados SEMS (fase real)", True),
    ("py", "bottom", "res", "top", "", False),
]

fig, ax = plt.subplots(figsize=(12, 8), facecolor=FUNDO)
ax.set_xlim(0, 11.6)
ax.set_ylim(0.6, 8.3)
ax.axis("off")
ax.text(0.2, 8.05, "ChargeGrid Intelligence — arquitetura final", fontsize=14, color=TEXTO, fontweight="bold")
ax.text(0.2, 7.75, "Amarelo: ecossistema GoodWe · Azul: borda/IoT · Verde: back-end · Lilás: interface · Laranja: análise em Python",
        fontsize=9, color=TEXTO2)

for k, (x, y, w, h, cor, titulo, linhas) in caixas.items():
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.02,rounding_size=0.12",
                                facecolor=CORES[cor], edgecolor=BORDA, linewidth=1))
    ax.text(x + 0.15, y + h - 0.32, titulo, fontsize=10.5, color=TEXTO, fontweight="bold")
    for i, linha in enumerate(linhas):
        ax.text(x + 0.15, y + h - 0.68 - i * 0.3, linha, fontsize=9, color=TEXTO2)

for a, la, b, lb, rotulo, tracejada in setas:
    p1, p2 = centro(a, la), centro(b, lb)
    ax.add_patch(FancyArrowPatch(p1, p2, arrowstyle="-|>", mutation_scale=12, color=TEXTO2,
                                 linewidth=1.2, linestyle=(0, (4, 3)) if tracejada else "-"))
    if rotulo:
        mx, my = (p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2
        horiz = abs(p1[1] - p2[1]) < 0.01
        ax.text(mx if horiz else mx + 0.1, my + 0.12 if horiz else my, rotulo, fontsize=8.5, color=TEXTO2, ha="center" if horiz else "left",
                bbox=dict(facecolor=FUNDO, edgecolor="none", pad=1))

ax.text(0.2, 0.75, "Linha cheia = implementado.  Linha tracejada = equipamento físico simulado ou integração prevista para a instalação real.", fontsize=8.5, color=TEXTO2)
saida = Path("docs/img")
saida.mkdir(parents=True, exist_ok=True)
fig.savefig(saida / "arquitetura.png", dpi=150, bbox_inches="tight", facecolor=FUNDO)
print("docs/img/arquitetura.png gerado")
