-- Sprint 4 — correções encontradas na depuração
--
-- 1. Tipo "prioridade" passa de 50 kW para 22 kW. O GoodWe HCA é um
--    carregador AC de no máximo 22 kW (GW22K-HCA); 50 kW só existe em
--    carregador DC. A diferença da "prioridade" passa a ser a ordem de
--    atendimento na redistribuição e o adicional de tarifa.
-- 2. tick(): o carro prioritário recebia potencia_max * 1.4 (acima do que o
--    carregador entrega). Agora recebe no máximo a própria potência máxima.
-- 3. tick(): a potência cortada nunca era devolvida quando carros saíam.
--    Agora todos voltam à potência máxima a cada ciclo e só então a regra
--    redistribui, se a soma passar do limite.
--
-- Mesmos defeitos documentados em analise/teste_regra_anterior.py (Python).
-- Seguro rodar mais de uma vez.

-- ------------------------------------------------------------
-- Sessões já abertas como "prioridade" passam a respeitar 22 kW
-- ------------------------------------------------------------
update public.charge_sessions
  set power_max_kw = 22, power_kw = least(power_kw, 22)
  where charge_type = 'prioridade' and power_max_kw > 22;

-- ------------------------------------------------------------
-- start_session(): mesma função da 0002, com prioridade = 22 kW
-- ------------------------------------------------------------
create or replace function public.start_session(
  p_client_name text,
  p_vehicle_model text,
  p_charge_type text,
  p_battery_capacity_kwh numeric default null
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
  if p_battery_capacity_kwh is not null and (p_battery_capacity_kwh < 1 or p_battery_capacity_kwh > 300) then
    raise exception 'capacidade da bateria deve estar entre 1 e 300 kWh';
  end if;
  if (select count(*) from public.charge_sessions where status = 'ativa') >= 10 then
    raise exception 'limite de 10 veículos simultâneos atingido';
  end if;

  v_power_max := case p_charge_type
    when 'lenta' then 7.4      -- GW7K-HCA
    when 'rapida' then 22      -- GW22K-HCA
    when 'prioridade' then 22  -- GW22K-HCA, com preferência na redistribuição
  end;
  v_battery := 25 + random() * 50;
  v_capacity := coalesce(p_battery_capacity_kwh, 40 + random() * 60);
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

grant execute on function public.start_session(text, text, text, numeric) to anon, authenticated;

-- ------------------------------------------------------------
-- tick(): checkpoint + redistribuição corrigida + finalização
-- ------------------------------------------------------------
create or replace function public.tick()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limite constant numeric := 100;
  v_total numeric;
  v_priority_id bigint;
  v_priority_power numeric;
  v_others_count int;
  v_power_each numeric;
  r record;
begin
  -- checkpoint: grava a bateria projetada e reinicia a base de tempo
  update public.charge_sessions s
    set battery_pct = least(100, s.battery_pct + extract(epoch from (now() - s.power_assigned_at)) * s.power_kw * (10000.0 / 3600) / s.battery_capacity_kwh),
        power_assigned_at = now()
  where s.status = 'ativa';

  -- correção 3: todos voltam à potência máxima antes de avaliar o limite
  update public.charge_sessions set power_kw = power_max_kw where status = 'ativa';

  select coalesce(sum(power_kw), 0) into v_total from public.charge_sessions where status = 'ativa';

  if v_total > v_limite then
    -- prioridade: tipo "prioridade" primeiro; em empate, menor bateria (regra original)
    select id into v_priority_id
      from public.charge_sessions where status = 'ativa'
      order by (charge_type = 'prioridade') desc, battery_pct asc
      limit 1;

    -- correção 2: nunca acima da potência máxima do próprio carregador
    select least(power_max_kw, v_limite) into v_priority_power
      from public.charge_sessions where id = v_priority_id;
    update public.charge_sessions set power_kw = v_priority_power where id = v_priority_id;

    select count(*) into v_others_count from public.charge_sessions where status = 'ativa' and id <> v_priority_id;
    if v_others_count > 0 then
      v_power_each := (v_limite - v_priority_power) / v_others_count;
      update public.charge_sessions
        set power_kw = least(v_power_each, power_max_kw)
        where status = 'ativa' and id <> v_priority_id;
    end if;
  end if;

  -- finalização: carros que chegaram a 100%
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

  -- amostra de demanda para o gráfico
  insert into public.demand_snapshots (demand_kw, limit_kw)
    select coalesce(sum(power_kw), 0), v_limite from public.charge_sessions where status = 'ativa';

  -- limpeza (mantém só os registros recentes)
  delete from public.demand_snapshots where id < (select coalesce(max(id), 0) - 120 from public.demand_snapshots);
  delete from public.protocol_events where id < (select coalesce(max(id), 0) - 200 from public.protocol_events);
end;
$$;

grant execute on function public.tick() to anon, authenticated;

-- ------------------------------------------------------------
-- get_tarifas(): potência exibida para "prioridade" = 22 kW
-- ------------------------------------------------------------
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
      from (values ('lenta', 'Lenta', 7.4), ('rapida', 'Rápida', 22.0), ('prioridade', 'Prioridade', 22.0)) as t(tipo, label, max_power)
    )
  );
$$;

grant execute on function public.get_tarifas() to anon, authenticated;
