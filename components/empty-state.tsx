import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function EmptyState({ icon: Icon, title, description, action, size = 'md' }: EmptyStateProps) {
  const padding = size === 'sm' ? 'py-8' : size === 'lg' ? 'py-20' : 'py-14';
  const iconSize = size === 'sm' ? 28 : 36;
  return (
    <div className={`${padding} text-center flex flex-col items-center gap-3`}>
      <div className="w-12 h-12 rounded-2xl bg-secondary/40 border border-border/50 flex items-center justify-center">
        <Icon size={iconSize / 2} strokeWidth={1.5} className="text-muted-foreground/60" />
      </div>
      <div className="space-y-1 max-w-xs">
        <p className="h-card">{title}</p>
        {description && <p className="t-caption">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
