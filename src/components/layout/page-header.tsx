import * as React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  /** 標題上方的小字，例如日期 */
  eyebrow?: string;
  description?: React.ReactNode;
  /** 右側主要動作（通常是按鈕） */
  actions?: React.ReactNode;
  id?: string;
  className?: string;
}

/** 頁面標題區：各頁共用，取代手寫的標題與說明排版 */
export function PageHeader({ title, eyebrow, description, actions, id, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="tabular text-sm text-muted-foreground">{eyebrow}</p>}
        <h1 id={id} className="mt-1 text-3xl font-bold text-foreground">
          {title}
        </h1>
        {description && <p className="mt-2 max-w-prose text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
