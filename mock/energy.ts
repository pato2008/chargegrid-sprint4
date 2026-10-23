export interface EnergyFlowData {
  solarKw: number;
  gridKw: number;
  batteryPct: number;
  batteryKw: number;
  chargerKw: number;
  homeLoadKw: number;
}

export const energyFlow: EnergyFlowData = {
  solarKw: 4.2,
  gridKw: 2.1,
  batteryPct: 76,
  batteryKw: 1.3,
  chargerKw: 7.6,
  homeLoadKw: 1.8,
};

// DemandStateData e DemandPoint vêm agora da API (backend/app/schemas.py:
// DemandaOut e DemandPointOut) — ver lib/api.ts. Os tipos ficam re-exportados
// aqui para os componentes de UI que já os importavam deste módulo.
export type { DemandaResponse as DemandStateData, DemandPoint } from '../lib/api';
