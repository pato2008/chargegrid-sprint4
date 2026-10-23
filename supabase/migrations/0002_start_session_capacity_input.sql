-- Permite que quem abre uma nova sessão informe a capacidade da bateria do
-- veículo (kWh) em vez de sempre sortear aleatoriamente (Carros.py sorteava
-- random.uniform(40, 100)). O nível de bateria inicial continua sorteado —
-- não foi pedido para virar input.
--
-- start_session(text, text, text) muda de assinatura (ganha um 4º parâmetro),
-- então a versão antiga precisa ser removida explicitamente: CREATE OR
-- REPLACE não troca o número de argumentos de uma função, ele cria uma nova
-- função sobrecarregada e deixa a antiga (de 3 argumentos) órfã no banco.

drop function if exists public.start_session(text, text, text);

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
    when 'lenta' then 7.4
    when 'rapida' then 22
    when 'prioridade' then 50
  end;
  v_battery := 25 + random() * 50;                          -- random.uniform(25, 75)
  v_capacity := coalesce(p_battery_capacity_kwh, 40 + random() * 60); -- input do usuário, ou random.uniform(40, 100)
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
