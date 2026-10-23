# ChargeGrid — backend no Supabase

Este diretório contém a migration SQL que porta o simulador de recarga do
Data Structures Sprint (Equipe02-1CCPO) para o Postgres do Supabase. Não há
mais backend Python — todo o estado e a lógica de negócio vivem no banco.

## Rodando as migrations

Rode **as três, em ordem**: `0001_chargegrid_schema.sql`, `0002_start_session_capacity_input.sql` e
`0003_sprint4_correcoes.sql`. A 0003 (Sprint 4) limita o tipo "prioridade" a 22 kW (máximo do
GoodWe HCA) e corrige dois defeitos do `tick()`: o carro prioritário recebia 1,4× a própria potência
máxima, e a potência cortada nunca era devolvida quando carros saíam. Se o banco já tem a 0001 e a
0002, basta rodar a 0003.

Passo a passo para cada arquivo:

1. Abra seu projeto em [app.supabase.com](https://app.supabase.com).
2. Vá em **SQL Editor** → **New query**.
3. Cole o conteúdo de `migrations/0001_chargegrid_schema.sql` inteiro e rode (**Run**).
4. Confira em **Table Editor** se apareceram `charge_sessions`, `protocol_events`
   e `demand_snapshots`, e em **Database → Functions** se apareceram `tick`,
   `start_session`, `get_tarifas`, `get_demanda`, `get_relatorio`.

O script foi escrito para ser seguro de rodar mais de uma vez (usa
`create or replace`, `if not exists`, `drop policy if exists`).

## Configurando o front

1. Copie `.env.example` para `.env` (na raiz do projeto, ao lado de `package.json`).
2. Preencha:
   - `VITE_SUPABASE_URL` — em **Project Settings → API → Project URL**.
   - `VITE_SUPABASE_ANON_KEY` — em **Project Settings → API → Project API keys**
     (a chave "anon" / "publishable", **não** a `service_role`).
3. `npm install && npm run dev`.
4. Na Vercel: **Settings → Environment Variables**, adicione as mesmas duas
   variáveis, e faça um redeploy.

A anon/publishable key é feita para ser pública no bundle do navegador — a
segurança vem das políticas de RLS abaixo, não do sigilo dessa chave. A
`service_role` key, essa sim secreta, nunca é usada no front.

## Schema

| Tabela | Papel |
|---|---|
| `charge_sessions` | Uma linha por veículo (Carros.py). Guarda um "checkpoint" de bateria (`battery_pct` + `power_assigned_at`) em vez de tick contínuo. |
| `protocol_events` | Log de mensagens OCPP 1.6 simuladas (SimuladorOCPP.py). |
| `demand_snapshots` | Amostras de demanda total ao longo do tempo, para o gráfico. |

View `charge_sessions_live`: projeta a bateria/duração/custo de cada sessão
em tempo real (usa `now()`), sem precisar de um processo rodando.

Funções: `tick()` (redistribuição de potência + finalização de sessões a
100%, gerenciamentoDeRecarga.py), `start_session(...)` (cadastra o carro +
StartTransaction), `get_tarifas`/`get_demanda`/`get_relatorio` (agregados
prontos para o front), `current_tariff*` (sistemaCobranca.py).

**Sobre o "tick" sem servidor:** como não há um processo contínuo, `tick()`
é chamado pelo front a cada refresh (a cada ~2s, ver `SessionsContext`).
Isso reproduz o loop original com uma granularidade um pouco mais grossa —
a simulação só avança enquanto pelo menos um cliente com a aba aberta está
fazendo polling. Suficiente para o uso como dashboard demonstrativo.

## Row Level Security

Modelo escolhido: **leitura pública, escrita só via função**. Não há
autenticação de usuário no front hoje, então:

- RLS habilitado nas 3 tabelas.
- Política de `select` com `using (true)` — qualquer cliente (mesmo anônimo)
  lê tudo.
- **Nenhuma política de insert/update/delete** — por padrão, sem policy o
  RLS nega. Ou seja, ninguém consegue escrever direto nas tabelas via
  `supabase.from(...).insert(...)`.
- Toda escrita passa pelas funções `start_session()` e `tick()`, criadas
  como `SECURITY DEFINER` — elas rodam com o privilégio de quem criou a
  função (bypassa RLS internamente), mas só fazem exatamente o que o código
  SQL permite (validar tipo de recarga, limite de 10 carros simultâneos,
  etc.), nunca uma escrita arbitrária vinda do cliente.

Se no futuro o projeto ganhar autenticação de usuário (ex: um operador
logado), dá pra evoluir para políticas por `auth.uid()` sem mudar a
estrutura — só trocar `using (true)` pelas condições de dono/role.

## Realtime

`charge_sessions` e `protocol_events` estão na publicação
`supabase_realtime`. A página **Protocolos** assina mudanças na tabela
`protocol_events` via `postgres_changes` (`lib/api.ts` →
`subscribeToProtocolEvents`) em vez de fazer polling.
