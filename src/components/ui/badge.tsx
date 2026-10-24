import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 select-none shadow-none',
  {
    variants: {
      variant: {
        default: 'border-slate-300 bg-slate-100 text-slate-800',
        secondary: 'border-slate-300 bg-slate-100 text-slate-900',
        destructive: 'border-rose-300 bg-rose-100 text-rose-800',
        outline: 'border-slate-300 text-slate-700 bg-transparent',
        success: 'border-emerald-300 bg-emerald-100 text-emerald-800',
        warning: 'border-amber-300 bg-amber-100 text-amber-800',
        info: 'border-sky-300 bg-sky-100 text-sky-800',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
