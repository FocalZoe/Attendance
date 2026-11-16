import * as React from 'react';
import { m } from 'motion/react';
import { fadeUp } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  title: string;
  description?: string;
  /** 下一步動作（通常是一顆 Button），空畫面應該告訴使用者接下來能做什麼 */
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <m.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className={cn(
        'flex flex-col items-start gap-2 rounded-lg border border-dashed border-input px-5 py-8',
        className
      )}
    >
      <p className="font-display text-base font-bold text-foreground">{title}</p>
      {description && <p className="max-w-prose text-sm text-muted-foreground">{description}</p>}
      {action && <div className="pt-2">{action}</div>}
    </m.div>
  );
}
