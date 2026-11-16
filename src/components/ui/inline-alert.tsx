import * as React from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { m } from 'motion/react';
import { fadeUp } from '@/lib/motion';
import { Alert, AlertDescription } from '@/components/ui/alert';

const TONE = {
  error: { variant: 'destructive', Icon: AlertCircle },
  success: { variant: 'success', Icon: CheckCircle2 },
  info: { variant: 'info', Icon: Info },
} as const;

interface InlineAlertProps {
  tone?: keyof typeof TONE;
  children: React.ReactNode;
  className?: string;
}

/**
 * 就近顯示的訊息，建立在 shadcn Alert 上。
 * 錯誤要說明發生什麼事與如何處理，不道歉、不含糊。
 */
export function InlineAlert({ tone = 'error', children, className }: InlineAlertProps) {
  const { variant, Icon } = TONE[tone];
  return (
    <m.div variants={fadeUp} initial="hidden" animate="visible" className={className}>
      <Alert variant={variant}>
        <Icon aria-hidden="true" />
        <AlertDescription className="font-medium">{children}</AlertDescription>
      </Alert>
    </m.div>
  );
}
