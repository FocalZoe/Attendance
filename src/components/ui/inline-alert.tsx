import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const alertVariants = cva('flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm', {
  variants: {
    tone: {
      error: 'border-absent/40 bg-absent-soft text-absent',
      success: 'border-present/40 bg-present-soft text-present',
      info: 'border-leave/40 bg-leave-soft text-leave',
    },
  },
  defaultVariants: { tone: 'error' },
});

const ICON = { error: AlertCircle, success: CheckCircle2, info: Info } as const;

interface InlineAlertProps extends VariantProps<typeof alertVariants> {
  children: React.ReactNode;
  className?: string;
}

/** 就近顯示的訊息。錯誤要說明發生什麼事與如何處理，不道歉、不含糊。 */
export function InlineAlert({ tone = 'error', children, className }: InlineAlertProps) {
  const Icon = ICON[tone ?? 'error'];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn(alertVariants({ tone }), className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 font-medium">{children}</div>
    </div>
  );
}
