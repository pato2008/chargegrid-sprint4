import random
from datetime import datetime


class SistemaCobranca:
    def __init__(self):
        self.historico = []

    def tarifaPorHorario(self):
        hora = datetime.now().hour
        if 18 <= hora <= 21:
            return 0.95
        elif hora >= 22 or hora <= 6:
            return 0.65
        else:
            return 0.80

    def tarifaPorDemanda(self, carrosAtivos):
        if len(carrosAtivos) >= 3:
            return 0.10
        return 0.0

    def tarifaPorTipo(self, tipoRecarga):
        match tipoRecarga:
            case '1':
                return 0.0
            case '2':
                return 0.05
            case '3':
                return 0.15
            case _:
                return 0.0

    def calcularTarifa(self, carro, carrosAtivos):
        return self.tarifaPorHorario() + self.tarifaPorDemanda(carrosAtivos) + self.tarifaPorTipo(carro.tipoRecarga)

    def calcularValorSessao(self, carro, carrosAtivos):
        tarifa = self.calcularTarifa(carro, carrosAtivos)
        custo = carro.energia * tarifa
        self.historico.append(custo)
        return custo

    def gerarFatura(self, carro, carrosAtivos):
        tarifa = self.calcularTarifa(carro, carrosAtivos)
        custo = carro.energia * tarifa
        return (
            f"\n===== FATURA =====\n"
            f"Cliente: {carro.nome}\n"
            f"Veículo: {carro.modelo}\n"
            f"Energia consumida: {carro.energia:.2f} kWh\n"
            f"Tarifa base (horário): R$ {self.tarifaPorHorario():.2f}/kWh\n"
            f"Adicional por demanda: R$ {self.tarifaPorDemanda(carrosAtivos):.2f}/kWh\n"
            f"Adicional por prioridade: R$ {self.tarifaPorTipo(carro.tipoRecarga):.2f}/kWh\n"
            f"Tarifa final: R$ {tarifa:.2f}/kWh\n"
            f"Total: R$ {custo:.2f}\n"
            f"=================="
        )

    def gerarHistorico(self):
        return sum(self.historico)