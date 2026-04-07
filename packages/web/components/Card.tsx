import type { ReactNode } from 'react';

interface CardProps {
  header?: ReactNode;
  headerRight?: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
}

export default function Card({ header, headerRight, footer, className = '', bodyClassName = 'p-3', children }: CardProps) {
  return (
    <div className={`bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden ${className}`}>
      {header && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--border)] bg-[var(--bg)]/30">
          <div className="text-xs font-bold opacity-60 flex items-center gap-1.5 min-w-0">
            {header}
          </div>
          {headerRight && <div className="shrink-0 text-xs">{headerRight}</div>}
        </div>
      )}
      {children !== undefined && <div className={bodyClassName}>{children}</div>}
      {footer && <div className="border-t border-[var(--border)]">{footer}</div>}
    </div>
  );
}
