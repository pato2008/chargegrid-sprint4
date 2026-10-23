import uuid
import json
from datetime import datetime

class SimuladorOCPP:
    def enviar(self, action, payload):
        mensagem = [
            2,
            str(uuid.uuid4())[:8],
            action,
            payload
        ]
        print(f"\n[OCPP →] {json.dumps(mensagem, indent=2)}")
        return mensagem

    def receber(self, action, payload):
        mensagem = [
            3,
            str(uuid.uuid4())[:8],
            action,
            payload
        ]
        print(f"\n[OCPP ←] {json.dumps(mensagem, indent=2)}")
        return mensagem

    def bootNotification(self):
        self.enviar("BootNotification", {
            "chargePointModel": "SimuladorEV",
            "chargePointVendor": "Equipe02"
        })
        self.receber("BootNotification", {
            "status": "Accepted",
            "currentTime": datetime.now().isoformat(),
            "interval": 1
        })

    def iniciarSessao(self, carro):
        self.enviar("StartTransaction", {
            "connectorId": carro.id,
            "idTag": carro.nome,
            "meterStart": 0,
            "timestamp": datetime.now().isoformat()
        })
        self.receber("StartTransaction", {
            "transactionId": carro.id,
            "status": "Accepted"
        })

    def meterValues(self, carro):
        self.enviar("MeterValues", {
            "connectorId": carro.id,
            "transactionId": carro.id,
            "meterValue": round(carro.bateria, 2),
            "timestamp": datetime.now().isoformat()
        })

    def encerrarSessao(self, carro):
        self.enviar("StopTransaction", {
            "transactionId": carro.id,
            "idTag": carro.nome,
            "meterStop": round(carro.energia, 2),
            "timestamp": datetime.now().isoformat()
        })
        self.receber("StopTransaction", {
            "status": "Accepted"
        })