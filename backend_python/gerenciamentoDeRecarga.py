from Carros import Carros
from equacoesRecarga import equacoesRecarga


class GerenciamentoDeRecarga:
    def __init__(self):
        self.carrosAtivos = []
        self.carrosFinalizados = []
        self.demandaContratada = 100

    def adicionarCarro(self, tipoRecarga, modeloCarro, nome):
        carro = Carros(id = len(self.carrosAtivos) + 1, tipoRecarga = tipoRecarga, modeloCarro= modeloCarro, nome = nome)
        equacoes = equacoesRecarga()
        carro.energia = equacoes.calcularEnergiaNecessaria(carro.capacidade, carro.bateria)
        carro.tempo = equacoes.calcularTempoNecessario(carro.energia, carro.potencia)
        carro.tempoInicial = carro.tempo
        self.carrosAtivos.append(carro)

    def removerCarro(self, ocpp):
        mensagens = []
        for carro in self.carrosAtivos[:]:
            if carro.bateria >= 100:
                self.carrosAtivos.remove(carro)
                self.carrosFinalizados.append(carro)
                ocpp.encerrarSessao(carro)
                mensagens.append(f"ID {carro.id} - O {carro.modelo} de {carro.nome} terminou de carregar!")
        return mensagens

    def gerenciarCarregamento(self):
        total = sum(c.potencia for c in self.carrosAtivos)
        if total >= self.demandaContratada:
            self.redistribuirCarregamento()

    def redistribuirCarregamento(self):
        carroPrioritario = min(self.carrosAtivos, key=lambda c: c.bateria)
        outros = [c for c in self.carrosAtivos if c is not carroPrioritario]

        potenciaPrioritario = min(carroPrioritario.potenciaMaxima * 1.4, self.demandaContratada)
        carroPrioritario.potencia = potenciaPrioritario

        sobra = self.demandaContratada - potenciaPrioritario
        potenciaPorCarro = sobra / len(outros) if outros else 0

        for carro in outros:
            carro.potencia = min(potenciaPorCarro, carro.potenciaMaxima)











