import * as React from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface IconButtonProps extends Omit<ButtonProps, 'size' | 'children'> {
  /** 同時作為無障礙名稱與 hover 提示 */
  label: string;
  children: React.ReactNode;
}

/** 只有圖示的按鈕：固定觸控尺寸，附 Tooltip 與 aria-label */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, children, variant = 'ghost', ...props }, ref) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button ref={ref} variant={variant} size="icon" aria-label={label} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
);
IconButton.displayName = 'IconButton';
