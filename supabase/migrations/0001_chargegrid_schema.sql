-- ChargeGrid Intelligence — schema Supabase
--
-- Porta a lógica do simulador Python (Data Structures Sprint,
-- Equipe02-1CCPO: Carros.py, equacoesRecarga.py, gerenciamentoDeRecarga.py,
-- sistemaCobranca.py, SimuladorOCPP.py) para tabelas + funções SQL.
--
-- Decisão de design: em vez de um loop de fundo rodando 1x/segundo (que não
-- existe em Postgres/Supabase sem infra extra), a bateria de cada sessão é
-- armazenada como um "checkpoint" (battery_pct + power_assigned_at) e
-- projetada linearmente no tempo em toda leitura (view charge_sessions_live).
-- A função tick() reavalia redistribuição de potência e finaliza sessões que
-- chegaram a 100% — o front chama tick() a cada poll (ver lib/api.ts), o que
-- reproduz o comportamento do loop original com granularidade de alguns
-- segundos em vez de 1s exato.

-- ============================================================
-- 1. Tabelas
-- ============================================================

create table if not exists public.charge_sessions (
  id bigint generated always as identity primary key,
  station_id text not null default 'HCA-001',
  client_name text not null,
  vehicle_model text not null,
  charge_type text not null check (charge_type in ('lenta', 'rapida', 'prioridade')),
  battery_capacity_kwh numeric not null,
  battery_pct numeric not null check (battery_pct >= 0 and battery_pct <= 100),
  power_max_kw numeric not null,
  power_kw numeric not null,
  power_assigned_at timestamptz not null default now(),
  energy_needed_kwh numeric not null,
  status text not null default 'ativa' check (status in ('ativa', 'concluida')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  final_cost_brl numeric,
  created_at timestamptz not null default now()
);

create index if not exists charge_sessions_status_idx on public.charge_sessions (status);

create table if not exists public.protocol_events (
  id bigint generated always as identity primary key,
  direction text not null check (direction in ('in', 'out')),
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists protocol_events_occurred_at_idx on public.protocol_events (occurred_at desc);

create table if not exists public.demand_snapshots (
  id bigint generated always as identity primary key,
  demand_kw numeric not null,
  limit_kw numeric not null,
  recorded_at timestamptz not null default now()
);

create index if not exists demand_snapshots_recorded_at_idx on public.demand_snapshots (recorded_at desc);

-- ============================================================
-- 2. Funções de tarifação (sistemaCobranca.py)
-- ============================================================

create or replace function public.current_tariff_hourly()
returns numeric
language sql
stable
as $$
  select case
    when extract(hour from now()) between 18 and 21 then 0.95
    when extract(hour from now()) >= 22 or extract(hour from now()) <= 6 then 0.65
    else 0.80
  end;
$$;

create or replace function public.current_tariff_demand()
returns numeric
language sql
stable
as $$
  select case when count(*) >= 3 then 0.10 else 0.0 end
  from public.charge_sessions
  where status = 'ativa';
$$;

create or replace function public.current_tariff_type(p_charge_type text)
returns numeric
language sql
immutable
as $$
  select case p_charge_type
    when 'lenta' then 0.0
    when 'rapida' then 0.05
    when 'prioridade' then 0.15
    else 0.0
  end;
$$;

create or replace function public.current_tariff(p_charge_type text)
returns numeric
language sql
stable
as $$
  select public.current_tariff_hourly() + public.current_tariff_demand() + public.current_tariff_type(p_charge_type);
$$;

-- ============================================================
-- 3. View com bateria projetada em tempo real (equacoesRecarga.py)
--    MULTIPLICADOR_VELOCIDADE = 100, por isso o fator 10000.0/3600
--    (= 100/3600 * 100) na taxa de carregamento por segundo.
-- ============================================================

create or replace view public.charge_sessions_live
with (security_invoker = true)
as
select
  s.*,
  case
    when s.status = 'ativa' then
      least(100, s.battery_pct + extract(epoch from (now() - s.power_assigned_at)) * s.power_kw * (10000.0 / 3600) / s.battery_capacity_kwh)
    else s.battery_pct
  end as battery_pct_live,
  case
    when s.status = 'ativa' then extract(epoch from (now() - s.started_at)) / 60
    else extract(epoch from (s.ended_at - s.started_at)) / 60
  end as duration_min,
  case
    when s.status = 'concluida' then s.final_cost_brl
    else s.energy_needed_kwh * public.current_tariff(s.charge_type)
  end as cost_brl_live
from public.charge_sessions s;

-- ============================================================
-- 4. tick() — checkpoint de bateria, redistribuição de demanda
--    (gerenciamentoDeRecarga.py) e finalização de sessões (>=100%)
-- ============================================================

create or replace function public.tick()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric;
  v_priority_id bigint;
  v_priority_power_max numeric;
  v_priority_power numeric;
  v_remaining numeric;
  v_others_count int;
  v_power_each numeric;
  r record;
begin
  -- checkpoint: grava a bateria projetada e reinicia a base de tempo
  update public.charge_sessions s
    set battery_pct = least(100, s.battery_pct + extract(epoch from (now() - s.power_assigned_at)) * s.power_kw * (10000.0 / 3600) / s.battery_capacity_kwh),
        power_assigned_at = now()
  where s.status = 'ativa';

  -- redistribuição: mesma regra de redistribuirCarregamento()
  select coalesce(sum(power_kw), 0) into v_total from public.charge_sessions where status = 'ativa';

  if v_total >= 100 and exists (select 1 from public.charge_sessions where status = 'ativa') then
    select id, power_max_kw into v_priority_id, v_priority_power_max
      from public.charge_sessions where status = 'ativa'
      order by battery_pct asc limit 1;

    v_priority_power := least(v_priority_power_max * 1.4, 100);
    update public.charge_sessions set power_kw = v_priority_power where id = v_priority_id;

    select count(*) into v_others_count from public.charge_sessions where status = 'ativa' and id <> v_priority_id;
    v_remaining := 100 - v_priority_power;

    if v_others_count > 0 then
      v_power_each := v_remaining / v_others_count;
      update public.charge_sessions
        set power_kw = least(v_power_each, power_max_kw)
        where status = 'ativa' and id <> v_priority_id;
    end if;
  end if;

  -- finalização: carros que chegaram a 100% (removerCarro() / GerarRelatorio)
  for r in select * from public.charge_sessions where status = 'ativa' and battery_pct >= 100 loop
    update public.charge_sessions
      set status = 'concluida',
          ended_at = now(),
          final_cost_brl = round((r.energy_needed_kwh * public.current_tariff(r.charge_type))::numeric, 2)
      where id = r.id;

    insert into public.protocol_events (direction, action, payload) values
      ('out', 'StopTransaction', jsonb_build_object('transactionId', r.id, 'idTag', r.client_name, 'meterStop', round(r.energy_needed_kwh::numeric, 2), 'timestamp', now())),
      ('in', 'StopTransaction', jsonb_build_object('status', 'Accepted'));
  end loop;

  -- amostra de demanda para o histórico do gráfico
  insert into public.demand_snapshots (demand_kw, limit_kw)
    select coalesce(sum(power_kw), 0), 100 from public.charge_sessions where status = 'ativa';

  -- limpeza (mantém só os registros recentes)
  delete from public.demand_snapshots where id < (select coalesce(max(id), 0) - 120 from public.demand_snapshots);
  delete from public.protocol_events where id < (select coalesce(max(id), 0) - 200 from public.protocol_events);
end;
$$;

-- ============================================================
-- 5. start_session() — Carros.py + StartTransaction (SimuladorOCPP.py)
-- ============================================================

create or replace function public.start_session(
  p_client_name text,
  p_vehicle_model text,
  p_charge_type text
)
returns public.charge_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.charge_sessions;
  v_power_max numeric;
  v_battery numeric;
  v_capacity numeric;
  v_energy numeric;
begin
  if p_client_name is null or length(trim(p_client_name)) = 0 then
    raise exception 'nome do cliente é obrigatório';
  end if;
  if p_vehicle_model is null or length(trim(p_vehicle_model)) = 0 then
    raise exception 'modelo do veículo é obrigatório';
  end if;
  if p_charge_type not in ('lenta', 'rapida', 'prioridade') then
    raise exception 'tipo de recarga inválido: %', p_charge_type;
  end if;
  if (select count(*) from public.charge_sessions where status = 'ativa') >= 10 then
    raise exception 'limite de 10 veículos simultâneos atingido';
  end if;

  v_power_max := case p_charge_type
    when 'lenta' then 7.4
    when 'rapida' then 22
    when 'prioridade' then 50
  end;
  v_battery := 25 + random() * 50;      -- random.uniform(25, 75)
  v_capacity := 40 + random() * 60;     -- random.uniform(40, 100)
  v_energy := v_capacity * (100 - v_battery) / 100;

  insert into public.charge_sessions (
    client_name, vehicle_model, charge_type, battery_capacity_kwh,
    battery_pct, power_max_kw, power_kw, power_assigned_at, energy_needed_kwh
  ) values (
    trim(p_client_name), trim(p_vehicle_model), p_charge_type, v_capacity,
    v_battery, v_power_max, v_power_max, now(), v_energy
  )
  returning * into v_row;

  insert into public.protocol_events (direction, action, payload) values
    ('out', 'StartTransaction', jsonb_build_object('connectorId', v_row.id, 'idTag', v_row.client_name, 'meterStart', 0, 'timestamp', now())),
    ('in', 'StartTransaction', jsonb_build_object('transactionId', v_row.id, 'status', 'Accepted'));

  perform public.tick();

  select * into v_row from public.charge_sessions where id = v_row.id;
  return v_row;
end;
$$;

-- ============================================================
-- 6. Agregados prontos para o front (tarifas / demanda / relatório)
-- ============================================================

create or replace function public.get_tarifas()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'tarifaHorario', public.current_tariff_hourly(),
    'adicionalDemanda', public.current_tariff_demand(),
    'carrosAtivos', (select count(*) from public.charge_sessions where status = 'ativa'),
    'porTipo', (
      select jsonb_agg(jsonb_build_object(
        'tipo', t.tipo,
        'label', t.label,
        'maxPowerKw', t.max_power,
        'adicionalTipo', public.current_tariff_type(t.tipo),
        'tarifaFinal', public.current_tariff_hourly() + public.current_tariff_demand() + public.current_tariff_type(t.tipo)
      ))
      from (values ('lenta', 'Lenta', 7.4), ('rapida', 'Rápida', 22.0), ('prioridade', 'Prioridade', 50.0)) as t(tipo, label, max_power)
    )
  );
$$;

create or replace function public.get_demanda()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'currentKw', coalesce((select sum(power_kw) from public.charge_sessions where status = 'ativa'), 0),
    'limitKw', 100,
    'mode', 'automatico',
    'activeChargers', (select count(*) from public.charge_sessions where status = 'ativa')
  );
$$;

create or replace function public.get_relatorio()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'totalSessoes', (select count(*) from public.charge_sessions),
    'sessoesConcluidas', (select count(*) from public.charge_sessions where status = 'concluida'),
    'sessoesAtivas', (select count(*) from public.charge_sessions where status = 'ativa'),
    'energiaTotalKwh', coalesce((select sum(energy_needed_kwh) from public.charge_sessions), 0),
    'receitaTotalBrl', coalesce((select sum(coalesce(final_cost_brl, energy_needed_kwh * public.current_tariff(charge_type))) from public.charge_sessions), 0),
    'historicoTotalBrl', coalesce((select sum(final_cost_brl) from public.charge_sessions where status = 'concluida'), 0)
  );
$$;

-- ============================================================
-- 7. Row Level Security
--
-- Modelo escolhido: leitura pública (não há autenticação de usuário no
-- front hoje), escrita bloqueada por padrão nas tabelas base — toda escrita
-- passa exclusivamente pelas funções SECURITY DEFINER acima (start_session,
-- tick), que aplicam as regras de negócio (limite de 10 carros, tipos
-- válidos, etc.) antes de gravar. Isso evita que qualquer cliente anônimo
-- insira/edite linhas arbitrárias diretamente nas tabelas.
-- ============================================================

alter table public.charge_sessions enable row level security;
alter table public.protocol_events enable row level security;
alter table public.demand_snapshots enable row level security;

drop policy if exists "Leitura pública" on public.charge_sessions;
drop policy if exists "Leitura pública" on public.protocol_events;
drop policy if exists "Leitura pública" on public.demand_snapshots;

create policy "Leitura pública" on public.charge_sessions for select using (true);
create policy "Leitura pública" on public.protocol_events for select using (true);
create policy "Leitura pública" on public.demand_snapshots for select using (true);

-- nenhuma policy de insert/update/delete é criada de propósito: sem policy,
-- o RLS nega por padrão. As funções SECURITY DEFINER acima continuam
-- podendo escrever porque rodam com o privilégio de quem as criou.

grant select on public.charge_sessions, public.protocol_events, public.demand_snapshots to anon, authenticated;
grant select on public.charge_sessions_live to anon, authenticated;

grant execute on function public.start_session(text, text, text) to anon, authenticated;
grant execute on function public.tick() to anon, authenticated;
grant execute on function public.get_tarifas() to anon, authenticated;
grant execute on function public.get_demanda() to anon, authenticated;
grant execute on function public.get_relatorio() to anon, authenticated;
grant execute on function public.current_tariff_hourly() to anon, authenticated;
grant execute on function public.current_tariff_demand() to anon, authenticated;
grant execute on function public.current_tariff_type(text) to anon, authenticated;
grant execute on function public.current_tariff(text) to anon, authenticated;

-- ============================================================
-- 8. Realtime — protocol_events e charge_sessions publicam mudanças
--    (usado pela página Protocolos para atualizar o log sem polling)
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'protocol_events'
  ) then
    alter publication supabase_realtime add table public.protocol_events;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'charge_sessions'
  ) then
    alter publication supabase_realtime add table public.charge_sessions;
  end if;
end;
$$;

-- ============================================================
-- 9. Seed — BootNotification inicial (equivalente ao boot do simulador)
-- ============================================================

insert into public.protocol_events (direction, action, payload)
select 'out', 'BootNotification', jsonb_build_object('chargePointModel', 'SimuladorEV', 'chargePointVendor', 'Equipe02')
where not exists (select 1 from public.protocol_events where action = 'BootNotification');

insert into public.protocol_events (direction, action, payload)
select 'in', 'BootNotification', jsonb_build_object('status', 'Accepted', 'currentTime', now(), 'interval', 1)
where not exists (
  select 1 from public.protocol_events where action = 'BootNotification' and direction = 'in'
);
