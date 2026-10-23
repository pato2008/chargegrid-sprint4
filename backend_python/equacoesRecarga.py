import random
import math

class equacoesRecarga():
    def __init__(self):
        self.multiplicadorVelocidade = 100

    def calcularEnergiaNecessaria(self, capacidade, bateria):
        return  capacidade * (100 - bateria) / 100

    def calcularTempoNecessario(self, energia, potencia):
        return ((energia / potencia) * 3600) / self.multiplicadorVelocidade



