// Camada de dados sobre o Supabase (supabase/migrations/) que porta o
// simulador de recarga do Data Structures Sprint (Equipe02-1CCPO).
//
// Não existe mais um servidor rodando um loop 1x/segundo — a bateria de
// cada sessão é projetada linearmente no tempo pela view
// `charge_sessions_live`, e a função `tick()` (chamada a cada refresh do
// SessionsContext) reavalia redistribuição de potência e finaliza sessões
// que chegaram a 100%. Ver o cabeçalho da migration para o racional completo.
import type { ChargeType, ChargingSession } from '../mock/types';
import type { DetalheTarifa, Fatura } from './tarifacao';
import { supabase } from './supabaseClient';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface SessionRow {
  id: number;
  station_id: string;
  client_name: string;
  vehicle_model: string;
  charge_type: ChargeType;
  battery_capacity_kwh: number;
  battery_pct: number;
  power_max_kw: number;
  power_kw: number;
  power_assigned_at: string;
  energy_needed_kwh: number;
  status: 'ativa' | 'concluida';
  started_at: string;
  ended_at: string | null;
  final_cost_brl: number | null;
  created_at: string;
  battery_pct_live?: number;
  duration_min?: number;
  cost_brl_live?: number;
}

function mapRow(row: SessionRow): ChargingSession {
  return {
    id: `S-${row.id}`,
    stationId: row.station_id,
    stationName: row.station_id,
    clientName: row.client_name,
    vehicleModel: row.vehicle_model,
    chargeType: row.charge_type,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    durationMin: round2(row.duration_min ?? 0),
    energyKwh: round2(row.energy_needed_kwh),
    avgPowerKw: round2(row.power_kw),
    costBrl: round2(row.cost_brl_live ?? row.final_cost_brl ?? 0),
    status: row.status === 'ativa' ? 'em-andamento' : 'concluida',
    batteryPct: round2(row.battery_pct_live ?? row.battery_pct),
  };
}

export interface SessionsResponse {
  ativas: ChargingSession[];
  finalizadas: ChargingSession[];
}

export async function getSessions(): Promise<SessionsResponse> {
  const { error: tickError } = await supabase.rpc('tick');
  if (tickError) throw new Error(`Supabase tick(): ${tickError.message}`);

  const { data, error } = await supabase.from('charge_sessions_live').select('*');
  if (error) throw new Error(`Supabase charge_sessions_live: ${error.message}`);

  const rows = (data ?? []) as SessionRow[];
  const ativas = rows
    .filter((r) => r.status === 'ativa')
    .sort((a, b) => a.started_at.localeCompare(b.started_at))
    .map(mapRow);
  const finalizadas = rows
    .filter((r) => r.status === 'concluida')
    .sort((a, b) => (b.ended_at ?? '').localeCompare(a.ended_at ?? ''))
    .map(mapRow);

  return { ativas, finalizadas };
}

export interface NovaSessaoPayload {
  nome: string;
  modelo: string;
  tipoRecarga: ChargeType;
  capacidadeKwh: number;
}

export interface NovaSessaoResponse {
  session: ChargingSession;
  fatura: Fatura & { estimada: boolean };
}

export async function createSession(payload: NovaSessaoPayload): Promise<NovaSessaoResponse> {
  const { data, error } = await supabase.rpc('start_session', {
    p_client_name: payload.nome,
    p_vehicle_model: payload.modelo,
    p_charge_type: payload.tipoRecarga,
    p_battery_capacity_kwh: payload.capacidadeKwh,
  });
  if (error) throw new Error(`Supabase start_session(): ${error.message}`);

  const row = data as SessionRow;
  const tarifas = await getTarifas();
  const tipoInfo = tarifas.porTipo.find((t) => t.tipo === payload.tipoRecarga);
  if (!tipoInfo) throw new Error(`Tarifa não encontrada para o tipo ${payload.tipoRecarga}`);

  const detalheTarifa: DetalheTarifa = {
    tarifaHorario: tarifas.tarifaHorario,
    tarifaDemanda: tarifas.adicionalDemanda,
    tarifaTipo: tipoInfo.adicionalTipo,
    tarifaFinal: tipoInfo.tarifaFinal,
  };
  const totalBrl = row.energy_needed_kwh * detalheTarifa.tarifaFinal;

  return {
    session: mapRow({ ...row, battery_pct_live: row.battery_pct, duration_min: 0, cost_brl_live: totalBrl }),
    fatura: {
      clienteNome: row.client_name,
      veiculoModelo: row.vehicle_model,
      energiaKwh: round2(row.energy_needed_kwh),
      detalheTarifa,
      totalBrl: round2(totalBrl),
      estimada: true,
    },
  };
}

export interface TarifaTipo {
  tipo: ChargeType;
  label: string;
  maxPowerKw: number;
  adicionalTipo: number;
  tarifaFinal: number;
}

export interface TarifasResponse {
  tarifaHorario: number;
  adicionalDemanda: number;
  carrosAtivos: number;
  porTipo: TarifaTipo[];
}

export async function getTarifas(): Promise<TarifasResponse> {
  const { data, error } = await supabase.rpc('get_tarifas');
  if (error) throw new Error(`Supabase get_tarifas(): ${error.message}`);
  return data as TarifasResponse;
}

export interface DemandaResponse {
  currentKw: number;
  limitKw: number;
  mode: 'automatico';
  activeChargers: number;
}

export async function getDemanda(): Promise<DemandaResponse> {
  const { data, error } = await supabase.rpc('get_demanda');
  if (error) throw new Error(`Supabase get_demanda(): ${error.message}`);
  return data as DemandaResponse;
}

export interface DemandPoint {
  time: string;
  demandKw: number;
  limitKw: number;
}

export async function getDemandaHistorico(): Promise<DemandPoint[]> {
  const { data, error } = await supabase
    .from('demand_snapshots')
    .select('demand_kw, limit_kw, recorded_at')
    .order('recorded_at', { ascending: false })
    .limit(60);
  if (error) throw new Error(`Supabase demand_snapshots: ${error.message}`);

  return (data ?? [])
    .slice()
    .reverse()
    .map((row) => ({
      time: new Date(row.recorded_at).toLocaleTimeString('pt-BR'),
      demandKw: round2(Number(row.demand_kw)),
      limitKw: Number(row.limit_kw),
    }));
}

export interface ProtocolEvent {
  id: string;
  message: string;
  direction: 'in' | 'out';
  time: string;
}

interface ProtocolEventRow {
  id: number;
  direction: 'in' | 'out';
  action: string;
  payload: unknown;
  occurred_at: string;
}

function mapProtocolEvent(row: ProtocolEventRow): ProtocolEvent {
  return {
    id: String(row.id),
    message: `${row.action} — ${JSON.stringify(row.payload)}`,
    direction: row.direction,
    time: new Date(row.occurred_at).toLocaleTimeString('pt-BR'),
  };
}

export async function getProtocolos(): Promise<ProtocolEvent[]> {
  const { data, error } = await supabase
    .from('protocol_events')
    .select('id, direction, action, payload, occurred_at')
    .order('occurred_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(`Supabase protocol_events: ${error.message}`);
  return (data ?? []).map(mapProtocolEvent);
}

// Realtime: usado pela página Protocolos para receber novos eventos OCPP
// via Postgres Changes, sem precisar dar poll na tabela.
export function subscribeToProtocolEvents(
  onInsert: (event: ProtocolEvent) => void,
  onStatusChange?: (connected: boolean) => void,
) {
  const channel = supabase
    .channel('protocol_events_stream')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'protocol_events' },
      (payload) => onInsert(mapProtocolEvent(payload.new as ProtocolEventRow)),
    )
    .subscribe((status) => {
      onStatusChange?.(status === 'SUBSCRIBED');
    });

  return () => {
    supabase.removeChannel(channel);
  };
}

export interface RelatorioResponse {
  totalSessoes: number;
  sessoesConcluidas: number;
  sessoesAtivas: number;
  energiaTotalKwh: number;
  receitaTotalBrl: number;
  historicoTotalBrl: number;
}

export async function getRelatorio(): Promise<RelatorioResponse> {
  const { data, error } = await supabase.rpc('get_relatorio');
  if (error) throw new Error(`Supabase get_relatorio(): ${error.message}`);
  return data as RelatorioResponse;
}

export type { DetalheTarifa };
