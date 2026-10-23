# Roteiros dos vídeos — Sprint 4 (máx. 5 min cada)

Os dois vídeos têm o mesmo **bloco comum** (0:00–2:30). Gravem esse bloco **uma vez só** e montem dois cortes, trocando o trecho final.

## Antes de gravar (checklist)
- [ ] Supabase com as **três** migrations rodadas (0001, 0002, 0003) e **sem sessões ativas**.
- [ ] Wokwi montado (ver `firmware/README.md`) com URL e anon key preenchidas. **Testem antes:** o Serial Monitor precisa mostrar `[demanda] ...` a cada 5 s.
- [ ] Dashboard aberto ao lado do Wokwi (tela dividida).
- [ ] `python analise/simulador_chargegrid.py` e `python analise/teste_regra_anterior.py` rodados uma vez, terminal limpo.
- [ ] Abas abertas: README no GitHub, VS Code com `backend_python/gerenciamentoDeRecarga.py` e `analise/simulador_chargegrid.py`.
- **Não mostrar:** os cards de "IA" e o painel "Fluxo de energia" do dashboard (os valores são fixos, não calculados ao vivo), e o arquivo `capsula_espacial.ino` (é de outro trabalho).
- Conferir na tela **Tarifação** que "Prioridade" mostra **22 kW**. Se mostrar 50, a migration 0003 não foi rodada.

---

## BLOCO COMUM (0:00 – 2:30)

**[0:00 – 0:20] Problema** — *tela: título do README*
> "Somos o grupo ChargeGrid: Lucas, Gustavo, João Victor e João Pedro. Nosso desafio: um supermercado instala carregadores de carro elétrico. No fim da tarde, todo mundo chega junto, os carros mais o consumo da loja estouram a demanda contratada, e a recarga acontece no horário mais caro. Enquanto isso, o sol do meio-dia foi desperdiçado."

**[0:20 – 0:45] Arquitetura** — *tela: `docs/img/arquitetura.png`*
> "Em amarelo, o ecossistema GoodWe: painéis, inversor híbrido com bateria e carregadores HCA. O totem do carregador é um ESP32 no Wokwi, que conversa por HTTPS com o nosso back-end no Supabase. O dashboard em React mostra tudo em tempo real. E o simulador em Python mede o ganho do algoritmo com sol e bateria ao longo de um mês."

**[0:45 – 1:45] Demonstração integrada** — *tela dividida: Wokwi à esquerda, dashboard (página Sessões) à direita*
1. Dar play no Wokwi. Mostrar o LCD com "Rede 0/100kW" e o LED verde.
> "Este é o totem do carregador. O cliente escolhe o tipo de recarga no potenciômetro..."
2. Girar para "Rapida 22kW" e apertar o botão.
> "...e aperta o botão. O ESP32 chama a função start_session no banco, que registra o carro e gera a mensagem OCPP StartTransaction, o protocolo dos carregadores comerciais."
3. Apontar a sessão aparecendo no dashboard em ~2 s.
> "Em dois segundos a recarga aparece no dashboard. Não fizemos nada aqui."
4. Abrir **Protocolos**: o evento já está lá.
5. Iniciar mais 4 recargas (pelo botão ou pela tela Nova sessão) e abrir **Demanda**.
> "Com cinco carros, a soma passaria de 100 kW. A cada ciclo, a função tick redistribui a potência. Vejam o LCD: a demanda atual, e o LED vermelho acende quando chegamos a 95% do limite."

**[1:45 – 2:30] Resultado em uma frase** — *tela: `docs/img/demanda_rede.png`*
> "Simulamos 30 dias com os mesmos carros e o mesmo sol, comparando três estratégias. Sem gestão, a demanda estourou o limite 28 vezes. A nossa regra da sprint anterior também: 28 vezes. Com o ChargeGrid, nenhuma: o pico ficou em 95 kW. Agora vamos explicar por quê."

---

## CORTE 1 — Pensamento Computacional e Automação com Python (2:30 – 5:00)

**[2:30 – 3:10] Onde começamos** — *tela: `backend_python/gerenciamentoDeRecarga.py`, método `redistribuirCarregamento`*
> "Na sprint anterior, decompusemos o problema em classes: Carros, SistemaCobranca, SimuladorOCPP e GerenciamentoDeRecarga, que é a regra de controle. Quando a soma passa de 100 kW, ela pega o carro com menos bateria usando min com uma função lambda, dá prioridade a ele e divide o resto entre os outros."

**[3:10 – 3:45] Depuração** — *quem fala: João Pedro · tela: terminal rodando `python analise/teste_regra_anterior.py`*
> "Ao reaproveitar esse código, a depuração achou três defeitos, e escrevemos um script que reproduz cada um. Primeiro: o carro prioritário recebe 1,4 vezes o máximo dele, ou seja, um carro de 22 kW recebe 30,8, o que é impossível. Segundo: o ID é o tamanho da lista mais um, então, quando um carro sai, dois carros ficam com o mesmo ID. Terceiro: depois de cortar a potência, ela nunca volta; com dois carros, usamos só 34,6 dos 100 kW. A última parte do script mostra a versão corrigida, e a mesma correção já está aplicada no banco do sistema."

**[3:45 – 4:30] O algoritmo novo** — *tela: `analise/simulador_chargegrid.py`, função `estrategia_chargegrid`*
> "Mas o maior problema era de lógica: a regra antiga só olhava para os carregadores e ignorava o consumo da loja. Na Sprint 4, o algoritmo considera tudo. Ordena os carros com sorted: prioridade primeiro, depois quem tem menos tempo. Faz três passadas: o mínimo para cada carro terminar antes de ir embora, a energia limpa e, fora da ponta, a rede, sem nunca passar de 95% do contratado. E, em vez de reescrever a regra antiga, o simulador importa e executa a classe original; ela é passada como parâmetro para a mesma função simular."

**[4:30 – 5:00] Automação e fechamento** — *tela: terminal com `python analise/simulador_chargegrid.py`*
> "Um comando simula 30 dias em passos de 15 minutos, três estratégias, e gera JSON, CSV, a tabela do README e os gráficos. Decomposição, padrões, abstração, algoritmo e depuração, aplicados a um problema real de energia. Tudo está no repositório."

---

## CORTE 2 — Soluções em Energias Renováveis e Sustentáveis (2:30 – 5:00)

**[2:30 – 3:10] Por que cada equipamento GoodWe** — *tela: arquitetura, apontando os blocos amarelos*
> "O inversor híbrido GoodWe da série ET é a linha trifásica com bateria, adequada a um comércio, e junta painéis, bateria e rede. A bateria guarda o sol do meio-dia para a ponta. Os carregadores HCA foram escolhidos porque a GoodWe os projetou para carregar com o excedente solar e serem gerenciados pelo SEMS: quatro de 22 kW para quem fica pouco tempo e dois de 7 kW para quem fica a tarde toda. O nosso sistema não substitui o SEMS; ele é a camada que decide."

**[3:10 – 3:55] De onde vem a energia** — *tela: `docs/img/fonte_energia_recarga.png`*
> "Este é um dia simulado. Nos dois primeiros painéis, sem gestão e com a regra antiga, os carros que chegam depois das 17h puxam tudo da rede, em azul, em pleno horário de ponta. A regra antiga não ajudou porque só olhava os carregadores, não a loja nem o sol. No terceiro, o ChargeGrid adianta a recarga e, às 18h, usa a bateria, em verde, que ficou reservada para esse momento."

**[3:55 – 4:25] Números** — *tela: `docs/img/resumo_indicadores.png`*
> "Em 30 dias: zero ultrapassagens de demanda, contra 28. Pico 30% menor. Metade da energia de ponta. Custo por kWh 12% menor. E a energia entregue aos clientes praticamente não mudou: 92%."

**[4:25 – 5:00] Avaliação crítica**
> "Há custos. Como as recargas ficam mais lentas, os carregadores ficam ocupados por mais tempo: 18 carros não acharam vaga no mês, contra 10. E o CO₂ evitado é pequeno, cerca de 136 kg, porque a matriz brasileira já é muito limpa. O ganho real é tirar carga da rede no horário de ponta e permitir mais carregadores sem obra na rede. Tudo foi simulado; o próximo passo é ler dados reais do SEMS."
