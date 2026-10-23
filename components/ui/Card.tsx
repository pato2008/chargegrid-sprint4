import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

export function Card({ className, padded = true, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-surface',
        padded && 'p-5',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ eyebrow, title, action, className }: CardHeaderProps) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)}>
      <div>
        {eyebrow && (
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-text-faint">{eyebrow}</p>
        )}
        <h3 className="font-display text-sm font-semibold text-text">{title}</h3>
      </div>
      {action}
    </div>
  );
}
