import random
class Carros:
    def __init__(self,id, tipoRecarga, modeloCarro, nome):
        self.id = id
        self.modelo = modeloCarro
        self.nome = nome
        self.bateria = random.uniform(25, 75)
        self.bateriaInicial = self.bateria
        self.capacidade =  random.uniform(40, 100)

        match tipoRecarga:
            case '1':
                self.potenciaMaxima = 7.4
            case '2':
                self.potenciaMaxima = 22
            case '3':
                self.potenciaMaxima = 50

        self.tipoRecarga = tipoRecarga
        self.potencia = self.potenciaMaxima
