from datetime import datetime

def GerarRelatorio(gerenciamento, cobranca):
    with open("relatorio_sessoes.txt", "w", encoding="utf-8") as f:
        f.write("========== RELATÓRIO DE SESSÕES ==========\n")
        f.write(f"Data: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}\n\n")

        for carro in gerenciamento.carrosFinalizados:
            custo = cobranca.calcularValorSessao(carro, gerenciamento.carrosFinalizados)
            f.write(f"Carro: {carro.modelo} (ID {carro.id})\n")
            f.write(f"Cliente: {carro.nome}\n")
            f.write(f"Tipo de recarga: {carro.tipoRecarga}\n")
            f.write(f"Bateria inicial: {carro.bateriaInicial:.2f}%\n")
            f.write(f"Bateria final: {carro.bateria:.2f}%\n")
            f.write(f"Quantidade carregada: {carro.bateria - carro.bateriaInicial:.2f}%\n")
            f.write(f"Energia consumida: {carro.energia:.2f} kWh\n")
            f.write(f"Custo: R$ {custo:.2f}\n")
            f.write("-" * 40 + "\n")

        f.write(f"\nTotal de sessões: {len(gerenciamento.carrosFinalizados)}\n")
        f.write(f"Histórico total: R$ {cobranca.gerarHistorico():.2f}\n")

    print("\nRelatório salvo em relatorio_sessoes.txt")