# Firmware — totem do carregador GoodWe HCA (ESP32 no Wokwi)

O ESP32 faz o papel do controlador de um ponto de recarga e conversa **de verdade** com o mesmo Supabase do dashboard:

| Componente | Pino | Função |
|---|---|---|
| Potenciômetro | GPIO 34 | Escolhe o tipo de recarga (lenta / rápida / prioridade) |
| Botão verde | GPIO 4 | Inicia a recarga → `start_session()` (OCPP StartTransaction) |
| LCD 16x2 I2C | SDA 21 / SCL 22 | Tipo escolhido e demanda atual / limite |
| LED verde / amarelo / vermelho | 25 / 26 / 27 | Livre / carregando / ≥ 95% da demanda contratada |

A cada 5 segundos, o ESP32 chama `tick()`, que redistribui a potência e encerra as recargas completas, e `get_demanda()`. Por isso a simulação avança mesmo com o dashboard fechado.

## Como montar no Wokwi
1. Acesse https://wokwi.com → **New Project → ESP32**.
2. Substitua o conteúdo de `sketch.ino` e `diagram.json` pelos arquivos desta pasta.
3. Crie um arquivo `libraries.txt` com o conteúdo do arquivo desta pasta.
4. No `sketch.ino`, preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY` (os mesmos valores do `.env` do front).
5. Clique em **Play**. No Serial Monitor deve aparecer `WiFi conectado` e, a cada 5 s, `[demanda] ...`.
6. Gire o potenciômetro, aperte o botão e veja a sessão aparecer no dashboard.
7. **Salve o projeto e copie o link** para o README principal.

## Se der erro
- `HTTP 401` → anon key errada.
- `HTTP 404` → URL errada, ou as migrations não foram rodadas no Supabase.
- `HTTP -1` → Wi-Fi não conectou (o Wokwi-GUEST exige o canal 6, já configurado).
- Mensagem `Sem vaga (10/10)` → regra do banco: limite de 10 carros simultâneos.
