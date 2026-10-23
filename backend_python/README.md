# Sistema Inteligente de Gerenciamento de Recarga
**Equipe 02 — 1CCPO**

Sistema de simulação de recarga de veículos elétricos com gerenciamento de múltiplas sessões, controle de demanda de energia, tarifação dinâmica e simulação do protocolo OCPP.

---

## Como executar

**Requisitos:** Python 3.10+

```bash
python simuladorDeRecarga.py
```

Não há dependências externas — apenas bibliotecas padrão do Python.

---

## Arquivos do projeto

| Arquivo | Responsabilidade |
|---|---|
| `simuladorDeRecarga.py` | Ponto de entrada, menu, loop de monitoramento |
| `Carros.py` | Objeto carro com atributos de bateria, capacidade e potência |
| `gerenciamentoDeRecarga.py` | Gerencia sessões ativas, controle de demanda e redistribuição |
| `equacoesRecarga.py` | Cálculo de energia necessária e tempo estimado |
| `sistemaCobranca.py` | Tarifação dinâmica e geração de faturas |
| `SimuladorOCPP.py` | Simulação do protocolo OCPP 1.6 |
| `GerarRelatorio.py` | Exportação do relatório em `.txt` |

---

## Funcionalidades

### Gerenciamento de múltiplas sessões
- Suporta até 10 veículos simultâneos
- Cada carro tem bateria, capacidade e potência sorteadas aleatoriamente
- Veículos são removidos da sessão automaticamente ao atingir 100%

### Tipos de recarga

| Opção | Tipo | Potência máxima |
|---|---|---|
| 1 | Lenta | 7,4 kW |
| 2 | Rápida | 22 kW |
| 3 | Prioridade | 50 kW |

### Controle de demanda
- Limite de 100 kW para o condomínio
- Quando a soma das potências ultrapassa o limite, o sistema redistribui automaticamente
- O carro com menor bateria recebe prioridade (+40% de potência)
- Os demais recebem a potência restante proporcionalmente

### Tarifação dinâmica

| Condição | Tarifa base |
|---|---|
| Horário de pico (18h–21h) | R$ 0,95/kWh |
| Madrugada (22h–06h) | R$ 0,65/kWh |
| Horário normal | R$ 0,80/kWh |

Adicionais aplicados sobre a tarifa base:

| Condição | Adicional |
|---|---|
| Recarga rápida | + R$ 0,05/kWh |
| Recarga prioridade | + R$ 0,15/kWh |
| Alta demanda (3+ carros) | + R$ 0,10/kWh |

### Simulação OCPP
Mensagens simuladas no formato OCPP 1.6 (array JSON com tipo, id único, ação e payload):
- `BootNotification` — inicialização do sistema
- `StartTransaction` — início de cada sessão
- `StopTransaction` — encerramento de cada sessão

### Relatório
Ao encerrar, o sistema gera `relatorio_sessoes.txt` com o resumo completo de todas as sessões: energia consumida, custo individual e total histórico.

---

## Exemplo de execução

```
[OCPP →] BootNotification → Accepted

========== SISTEMA DE RECARGA ==========
[1] Iniciar simulação
[2] Ver tarifas vigentes
[3] Sair

Quantos carros deseja simular? 2

Carro 1:
Nome do cliente: João
Modelo do carro: Tesla
Tipo de recarga: 3

[OCPP →] StartTransaction (ID 1) → Accepted

--- Monitor de Carregamento ---
ID 1 - Tesla (João): 45.23% | 87s restantes | 50.0kW | Tipo: 3

ID 1 - O Tesla de João terminou de carregar!
[OCPP →] StopTransaction (ID 1) → Accepted

===== FATURA =====
Cliente: João
Veículo: Tesla
Energia consumida: 24.31 kWh
Tarifa final: R$ 0.90/kWh
Total: R$ 21.88
==================

Relatório salvo em relatorio_sessoes.txt
```
