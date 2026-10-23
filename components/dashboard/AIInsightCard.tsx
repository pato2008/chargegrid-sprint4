import { BrainCircuit } from 'lucide-react';
import { Badge } from '../ui/Badge';
import type { AIInsight } from '../../mock/ai-insights';
import type { BadgeTone } from '../ui/Badge';

interface AIInsightCardProps {
  insight: AIInsight;
}

const toneMap: Record<AIInsight['tone'], BadgeTone> = {
  success: 'success',
  warning: 'warning',
  info: 'info',
};

export function AIInsightCard({ insight }: AIInsightCardProps) {
  return (
    <div className="flex gap-3 rounded-lg border border-border-soft bg-surface-2 p-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-magenta-dim text-magenta">
        <BrainCircuit className="h-4 w-4" strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-text">{insight.title}</p>
          {insight.metric && (
            <Badge tone={toneMap[insight.tone]} className="shrink-0">
              {insight.metric}
            </Badge>
          )}
        </div>
        <p className="text-xs leading-relaxed text-text-muted">{insight.description}</p>
      </div>
    </div>
  );
}
