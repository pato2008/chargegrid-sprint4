import { AlertTriangle, Info, OctagonAlert } from 'lucide-react';
import type { AlertItem, AlertLevel } from '../../mock/alerts';

interface AlertsPanelProps {
  alerts: AlertItem[];
}

const levelConfig: Record<AlertLevel, { icon: typeof Info; tone: string }> = {
  critico: { icon: OctagonAlert, tone: 'text-red bg-red-dim' },
  atencao: { icon: AlertTriangle, tone: 'text-warning bg-warning-dim' },
  info: { icon: Info, tone: 'text-info bg-info-dim' },
};

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  if (alerts.length === 0) {
    return <p className="text-sm text-text-muted">Nenhum alerta no momento.</p>;
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => {
        const config = levelConfig[alert.level];
        return (
          <div key={alert.id} className="flex gap-3">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${config.tone}`}>
              <config.icon className="h-3.5 w-3.5" strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text">{alert.title}</p>
              <p className="text-xs text-text-muted">{alert.description}</p>
              <p className="mt-0.5 font-mono text-[11px] text-text-faint">{alert.time}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
