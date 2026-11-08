import * as React from 'react';
import type { AttendanceStatus } from '@/types/database';
import { ATTENDANCE_STATUS_LABEL } from '@/lib/attendance-status';
import { cn } from '@/lib/utils';

/* 出席簿的「蓋章格」：一個字 + 邊框 + 底色。
   四態除了顏色，還以不同的字（出 / 遲 / 假 / 缺）區分，色盲也能辨識。 */
export const STAMP: Record<AttendanceStatus, { glyph: string; className: string }> = {
  present: { glyph: '出', className: 'border-present bg-present-soft text-present' },
  late: { glyph: '遲', className: 'border-late bg-late-soft text-late' },
  leave: { glyph: '假', className: 'border-leave bg-leave-soft text-leave' },
  absent: { glyph: '缺', className: 'border-absent bg-absent-soft text-absent' },
};

/** Overlay on a photo: translucent fill so the picture stays visible, solid border for the state */
export const OVERLAY_STYLE: Record<AttendanceStatus, string> = {
  present: 'border-present bg-present/15',
  late: 'border-late bg-late/15',
  leave: 'border-leave bg-leave/15',
  absent: 'border-absent bg-absent/15',
};

export const ATTENDANCE_STATUS_ORDER: AttendanceStatus[] = ['present', 'late', 'leave', 'absent'];

interface StatusMarkProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: AttendanceStatus;
  /** 在蓋章格右側顯示文字標籤 */
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE: Record<NonNullable<StatusMarkProps['size']>, string> = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-11 w-11 text-lg',
};

export function StatusMark({ status, showLabel = false, size = 'md', className, ...props }: StatusMarkProps) {
  const stamp = STAMP[status];
  const label = ATTENDANCE_STATUS_LABEL[status];

  return (
    <span className={cn('inline-flex items-center gap-2', className)} {...props}>
      <span
        role={showLabel ? undefined : 'img'}
        aria-label={showLabel ? undefined : label}
        aria-hidden={showLabel ? true : undefined}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-sm border-[1.5px] font-display font-bold leading-none',
          SIZE[size],
          stamp.className
        )}
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {stamp.glyph}
      </span>
      {showLabel && <span className="text-sm font-medium text-foreground">{label}</span>}
    </span>
  );
}

/** 四態圖例：用於歷史紀錄與家長查勤頁，讓蓋章格的意義一目了然 */
export function StatusLegend({ className }: { className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-2', className)} aria-label="出勤狀態圖例">
      {ATTENDANCE_STATUS_ORDER.map((status) => (
        <li key={status}>
          <StatusMark status={status} size="sm" showLabel />
        </li>
      ))}
    </ul>
  );
}
