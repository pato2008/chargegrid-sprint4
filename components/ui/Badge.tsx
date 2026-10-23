import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export type BadgeTone = 'red' | 'magenta' | 'warning' | 'success' | 'blue' | 'info' | 'neutral';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
}

const toneClasses: Record<BadgeTone, string> = {
  red: 'bg-red-dim text-red',
  magenta: 'bg-magenta-dim text-magenta',
  warning: 'bg-warning-dim text-warning',
  success: 'bg-success-dim text-success',
  blue: 'bg-blue-dim text-blue',
  info: 'bg-info-dim text-info',
  neutral: 'bg-surface-2 text-text-muted',
};

const dotClasses: Record<BadgeTone, string> = {
  red: 'bg-red',
  magenta: 'bg-magenta',
  warning: 'bg-warning',
  success: 'bg-success',
  blue: 'bg-blue',
  info: 'bg-info',
  neutral: 'bg-text-faint',
};

export function Badge({ tone = 'neutral', dot = false, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dotClasses[tone])} />}
      {children}
    </span>
  );
}
