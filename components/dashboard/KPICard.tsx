import type { LucideIcon } from 'lucide-react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Card } from '../ui/Card';
import { cn } from '../../lib/cn';

export type KPITone = 'red' | 'magenta' | 'warning' | 'success' | 'blue' | 'info';

interface KPICardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  unit?: string;
  tone?: KPITone;
  trend?: { value: string; positive: boolean };
}

const toneClasses: Record<KPITone, string> = {
  red: 'bg-red-dim text-red',
  magenta: 'bg-magenta-dim text-magenta',
  warning: 'bg-warning-dim text-warning',
  success: 'bg-success-dim text-success',
  blue: 'bg-blue-dim text-blue',
  info: 'bg-info-dim text-info',
};

export function KPICard({ icon: Icon, label, value, unit, tone = 'blue', trend }: KPICardProps) {
  return (
    <Card className="flex flex-col gap-3">
      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', toneClasses[tone])}>
        <Icon className="h-4 w-4" strokeWidth={1.8} />
      </div>
      <div>
        <p className="mb-1 text-xs text-text-faint">{label}</p>
        <p className="flex items-baseline gap-1 font-display text-xl font-semibold text-text">
          {value}
          {unit && <span className="text-xs font-normal text-text-faint">{unit}</span>}
        </p>
      </div>
      {trend && (
        <div
          className={cn(
            'flex items-center gap-1 text-xs font-medium',
            trend.positive ? 'text-success' : 'text-red',
          )}
        >
          {trend.positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          {trend.value}
        </div>
      )}
    </Card>
  );
}
