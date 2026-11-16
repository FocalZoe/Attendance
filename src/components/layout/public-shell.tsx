import * as React from 'react';
import { Link } from 'react-router-dom';
import { Camera } from 'lucide-react';
import { m } from 'motion/react';
import { PageTransition } from '@/components/motion/page-transition';
import { transitions } from '@/lib/motion';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { cn } from '@/lib/utils';

interface PublicShellProps {
  children: React.ReactNode;
  /** 內容區最大寬度 */
  width?: 'narrow' | 'wide';
  /** 右上角額外連結（例如「教職員登入」） */
  aside?: React.ReactNode;
}

/** 登入、註冊、家長查勤等單欄頁面共用的外框：小頂欄 + 靠左內容 */
export function PublicShell({ children, width = 'narrow', aside }: PublicShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <m.header
        className="border-b border-border"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0, transition: transitions.base }}
      >
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2" aria-label="回到首頁">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Camera className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="font-display text-base font-bold text-foreground">
              班級自動化點名系統
            </span>
          </Link>
          <div className="flex items-center gap-1">
            {aside}
            <ThemeToggle />
          </div>
        </div>
      </m.header>

      <main
        className={cn(
          'mx-auto w-full flex-1 px-4 py-10 sm:px-6 sm:py-14',
          width === 'narrow' ? 'max-w-md' : 'max-w-3xl'
        )}
      >
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
