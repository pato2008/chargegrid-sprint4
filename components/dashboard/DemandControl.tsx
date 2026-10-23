import { Badge } from '../ui/Badge';
import type { DemandStateData } from '../../mock/energy';

interface DemandControlProps {
  data: DemandStateData;
}

export function DemandControl({ data }: DemandControlProps) {
  const pct = Math.min(100, Math.round((data.currentKw / data.limitKw) * 100));
  const critical = pct >= 90;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-2xl font-semibold text-text">
            {data.currentKw.toFixed(1)} <span className="text-sm font-normal text-text-faint">/ {data.limitKw} kW</span>
          </p>
          <p className="text-xs text-text-muted">{data.activeChargers} carregadores ativos</p>
        </div>
        <Badge tone={data.mode === 'automatico' ? 'success' : 'warning'} dot>
          {data.mode === 'automatico' ? 'Automático' : 'Manual'}
        </Badge>
      </div>

      <div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className={`h-full rounded-full ${critical ? 'bg-red' : 'bg-gradient-to-r from-blue to-magenta'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-text-faint">{pct}% do limite contratado</p>
      </div>

      <p className="rounded-lg border border-border-soft bg-surface-2 px-3.5 py-3 text-xs text-text-muted">
        {critical
          ? 'Demanda próxima do limite. Novas sessões de recarga rápida podem ser postergadas automaticamente.'
          : 'Demanda dentro da margem segura. Nenhuma ação necessária no momento.'}
      </p>
    </div>
  );
}
