import time
import threading
from sistemaCobranca import SistemaCobranca
from gerenciamentoDeRecarga import GerenciamentoDeRecarga
from SimuladorOCPP import SimuladorOCPP
from GerarRelatorio import GerarRelatorio

gerenciamento = GerenciamentoDeRecarga()
cobranca = SistemaCobranca()
ocpp = SimuladorOCPP()
lock = threading.Lock()
MULTIPLICADOR = 100

def validar_int(mensagem, minimo, maximo):
    while True:
        try:
            valor = int(input(mensagem))
            if minimo <= valor <= maximo:
                return valor
            print(f"Digite um número entre {minimo} e {maximo}.")
        except ValueError:
            print("Entrada inválida. Digite um número.")


def validar_texto(mensagem):
    while True:
        valor = input(mensagem).strip()
        if valor:
            return valor
        print("Campo obrigatório. Tente novamente.")


def menu_principal():
    print("\n========== SISTEMA DE RECARGA ==========")
    print("[1] Iniciar simulação")
    print("[2] Ver tarifas vigentes")
    print("[3] Sair")
    return validar_int("Escolha uma opção: ", 1, 3)


def exibir_tarifas():
    print("\n========== TARIFAS VIGENTES ==========")
    print(f"Horário de pico (18h–21h):     R$ 0.95/kWh")
    print(f"Madrugada (22h–06h):           R$ 0.65/kWh")
    print(f"Horário normal:                R$ 0.80/kWh")
    print(f"\nAdicionais por tipo de recarga:")
    print(f"[1] Lenta:      + R$ 0.00/kWh")
    print(f"[2] Rápida:     + R$ 0.05/kWh")
    print(f"[3] Prioridade: + R$ 0.15/kWh")
    print(f"\nAdicional por alta demanda (3+ carros): + R$ 0.10/kWh")


def cadastrar_carros():
    quantidade = validar_int("Quantos carros deseja simular? ", 1, 10)
    for i in range(quantidade):
        print(f"\nCarro {i + 1}:")
        nome = validar_texto("Nome do cliente: ")
        modelo = validar_texto("Modelo do carro: ")
        tipo = str(validar_int("Tipo de recarga ([1] Lenta, [2] Rápida, [3] Prioridade): ", 1, 3))
        gerenciamento.adicionarCarro(tipo, modelo, nome)
        ocpp.iniciarSessao(gerenciamento.carrosAtivos[-1])


def monitorar_carregamento():
    try:
        while len(gerenciamento.carrosAtivos) > 0:
            time.sleep(1)

            with lock:
                print("\n--- Monitor de Carregamento ---")
                for carro in gerenciamento.carrosAtivos[:]:
                    energiaPorSegundo = (carro.potencia / 3600) * MULTIPLICADOR
                    carro.bateria += (energiaPorSegundo / carro.capacidade) * 100
                    if carro.bateria > 100:
                        carro.bateria = 100

                    energiaRestante = (100 - carro.bateria) * carro.capacidade / 100
                    carro.tempo = (energiaRestante / energiaPorSegundo) if energiaPorSegundo > 0 else 0

                    print(f"ID {carro.id} - {carro.modelo} ({carro.nome}): {carro.bateria:.2f}% | {carro.tempo:.0f}s restantes | {carro.potencia:.1f}kW | Tipo: {carro.tipoRecarga}")

                gerenciamento.gerenciarCarregamento()

                mensagens = gerenciamento.removerCarro(ocpp)
                for msg in mensagens:
                    print(msg)

    except KeyboardInterrupt:
        print("\nSimulação encerrada!")

    print("\n========== Resumo Final ==========")
    for carro in gerenciamento.carrosFinalizados:
        fatura = cobranca.gerarFatura(carro, gerenciamento.carrosFinalizados)
        print(fatura)

    GerarRelatorio(gerenciamento, cobranca)


if __name__ == "__main__":
    ocpp.bootNotification()

    while True:
        opcao = menu_principal()

        if opcao == 1:
            cadastrar_carros()
            monitorar_carregamento()
            break
        elif opcao == 2:
            exibir_tarifas()
        elif opcao == 3:
            print("Encerrando sistema.")
            break