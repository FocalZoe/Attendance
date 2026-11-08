import * as React from 'react';
import { cn } from '@/lib/utils';

/** 載入骨架：靜態色塊，減少動態使用者不會看到脈動（見 globals.css 的 reduced-motion） */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-secondary', className)}
      {...props}
    />
  );
}

/** 全頁載入畫面，附螢幕閱讀器可讀的狀態文字 */
export function PageSkeleton({ label = '載入中' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10 sm:px-6">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-28 w-full" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    </div>
  );
}

/** 列表載入骨架 */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-2">
      <span className="sr-only">載入中</span>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
