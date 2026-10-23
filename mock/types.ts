export type ChargeType = 'lenta' | 'rapida' | 'prioridade';

export interface ChargeTypeInfo {
  id: ChargeType;
  label: string;
  maxPowerKw: number;
}

export const CHARGE_TYPES: Record<ChargeType, ChargeTypeInfo> = {
  lenta: { id: 'lenta', label: 'Lenta', maxPowerKw: 7 },
  rapida: { id: 'rapida', label: 'Rápida', maxPowerKw: 22 },
  prioridade: { id: 'prioridade', label: 'Prioridade', maxPowerKw: 22 },
};

export type SessionStatus = 'em-andamento' | 'concluida';

export interface ChargingSession {
  id: string;
  stationId: string;
  stationName: string;
  clientName: string;
  vehicleModel: string;
  chargeType: ChargeType;
  startedAt: string;
  endedAt?: string;
  durationMin: number;
  energyKwh: number;
  avgPowerKw: number;
  costBrl: number;
  status: SessionStatus;
  batteryPct: number;
}
