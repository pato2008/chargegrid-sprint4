export type StationStatus = 'disponivel' | 'em-uso' | 'offline' | 'manutencao';

export interface Station {
  id: string;
  name: string;
  location: string;
  connectors: number;
  maxPowerKw: number;
  status: StationStatus;
}

export const stations: Station[] = [
  { id: 'HCA-001', name: 'HCA-001', location: 'LAB FIAP Eco Home', connectors: 2, maxPowerKw: 22, status: 'em-uso' },
  { id: 'HCA-002', name: 'HCA-002', location: 'LAB FIAP Eco Home', connectors: 2, maxPowerKw: 22, status: 'disponivel' },
  { id: 'HCA-003', name: 'HCA-003', location: 'Estacionamento B', connectors: 1, maxPowerKw: 7, status: 'manutencao' },
  { id: 'HCA-004', name: 'HCA-004', location: 'Estacionamento B', connectors: 2, maxPowerKw: 22, status: 'offline' },
];
