import { Battery, Home, Plug, Sun, Zap } from 'lucide-react';
import type { EnergyFlowData } from '../../mock/energy';

interface EnergyFlowProps {
  data: EnergyFlowData;
}

const nodes = (data: EnergyFlowData) => [
  { key: 'solar', label: 'Solar', value: `${data.solarKw.toFixed(1)} kW`, icon: Sun, tone: 'text-warning bg-warning-dim' },
  { key: 'grid', label: 'Rede', value: `${data.gridKw.toFixed(1)} kW`, icon: Zap, tone: 'text-blue bg-blue-dim' },
  { key: 'battery', label: 'Bateria', value: `${data.batteryPct}%`, icon: Battery, tone: 'text-success bg-success-dim' },
  { key: 'charger', label: 'Carregador', value: `${data.chargerKw.toFixed(1)} kW`, icon: Plug, tone: 'text-magenta bg-magenta-dim' },
  { key: 'home', label: 'Consumo interno', value: `${data.homeLoadKw.toFixed(1)} kW`, icon: Home, tone: 'text-red bg-red-dim' },
];

export function EnergyFlow({ data }: EnergyFlowProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {nodes(data).map((node) => (
        <div
          key={node.key}
          className="flex flex-col items-center gap-2 rounded-lg border border-border-soft bg-surface-2 px-3 py-4 text-center"
        >
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${node.tone}`}>
            <node.icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </div>
          <p className="font-mono text-sm font-semibold text-text">{node.value}</p>
          <p className="text-[11px] uppercase tracking-wide text-text-faint">{node.label}</p>
        </div>
      ))}
    </div>
  );
}
