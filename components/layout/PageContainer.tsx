import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export function PageContainer({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col gap-5 p-4 sm:p-6 lg:p-8', className)} {...props}>
      {children}
    </div>
  );
}

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
}

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <div>
      {eyebrow && (
        <p className="mb-1.5 font-mono text-xs uppercase tracking-widest text-magenta">{eyebrow}</p>
      )}
      <h1 className="font-display text-xl font-semibold text-text sm:text-2xl">{title}</h1>
      {description && <p className="mt-1.5 text-sm text-text-muted">{description}</p>}
    </div>
  );
}
