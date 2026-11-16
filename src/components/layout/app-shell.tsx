import * as React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { m } from 'motion/react';
import { Building2, CalendarCheck, Camera, Menu, PanelLeftClose, PanelLeftOpen, School } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Profile } from '@/types/database';
import { AccountMenu } from '@/components/layout/account-menu';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { transitions } from '@/lib/motion';
import { cn } from '@/lib/utils';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** 導覽步驟用的標記 */
  tour?: string;
  /** 只有網址完全相同才算目前頁面 */
  end?: boolean;
}

const DEFAULT_NAV: Record<Profile['role'], NavItem[]> = {
  sys_admin: [{ to: '/dashboard/sys-admin', label: '學校組織', icon: Building2, end: true }],
  school_admin: [{ to: '/dashboard/school-admin', label: '校務管理', icon: School, end: true }],
  teacher: [{ to: '/dashboard/teacher', label: '今日點名', icon: CalendarCheck, end: true }],
};

const COLLAPSE_KEY = 'attendance:sidebar:collapsed';
const EXPANDED_WIDTH = 232;
const COLLAPSED_WIDTH = 64;

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false; // storage can be blocked; fall back to expanded
  }
}

function Brand({ showLabel }: { showLabel: boolean }) {
  return (
    <Link to="/" className="flex min-w-0 items-center gap-2.5" aria-label="回到首頁">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Camera className="h-5 w-5" aria-hidden="true" />
      </span>
      {showLabel && (
        <span className="truncate font-display text-base font-bold leading-tight text-foreground">
          班級自動化點名系統
        </span>
      )}
    </Link>
  );
}

function NavEntry({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const link = (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      data-tour={item.tour}
      aria-label={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
          isActive ? 'text-foreground' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <m.span
              layoutId="app-nav-active"
              transition={transitions.base}
              className="absolute inset-0 rounded-md bg-secondary"
              aria-hidden="true"
            />
          )}
          <item.icon className="relative h-4 w-4 shrink-0" aria-hidden="true" />
          {!collapsed && <span className="relative truncate">{item.label}</span>}
        </>
      )}
    </NavLink>
  );

  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

interface AppShellProps {
  profile: Profile | null;
  /** 不傳時依身分給預設導覽 */
  navItems?: NavItem[];
  children: React.ReactNode;
}

/**
 * 登入後頁面的共用外框：桌面是可收合的左側欄，手機是從左滑出的面板。
 * 帳號選單放在頂欄右側。
 */
export function AppShell({ profile, navItems, children }: AppShellProps) {
  const [collapsed, setCollapsed] = React.useState<boolean>(readCollapsed);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const items = navItems ?? (profile ? DEFAULT_NAV[profile.role] : []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* 桌面側欄 */}
      <m.aside
        aria-label="主要導覽"
        className="sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-border bg-card lg:flex"
        initial={false}
        animate={{ width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
        transition={transitions.base}
      >
        <div className={cn('flex h-16 shrink-0 items-center border-b border-border', collapsed ? 'justify-center' : 'px-4')}>
          <Brand showLabel={!collapsed} />
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {items.map((item) => (
            <NavEntry key={item.to} item={item} collapsed={collapsed} />
          ))}
        </nav>

        <div className="border-t border-border p-2">
          <Button
            type="button"
            variant="ghost"
            className={cn('w-full', collapsed ? 'justify-center px-0' : 'justify-start px-3')}
            onClick={toggle}
            aria-label={collapsed ? '展開側欄' : '收合側欄'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
            {!collapsed && <span>收合側欄</span>}
          </Button>
        </div>
      </m.aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-background px-4 sm:px-6">
          {/* 手機導覽 */}
          <div className="lg:hidden">
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button type="button" variant="ghost" size="icon" aria-label="開啟導覽">
                  <Menu aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent title="主要導覽">
                <div className="flex h-16 shrink-0 items-center border-b border-border px-4 pr-14">
                  <Brand showLabel />
                </div>
                <nav className="flex-1 space-y-1 overflow-y-auto p-2">
                  {items.map((item) => (
                    <NavEntry key={item.to} item={item} collapsed={false} onNavigate={() => setSheetOpen(false)} />
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>

          <div className="lg:hidden">
            <Brand showLabel={false} />
          </div>

          <div className="ml-auto">{profile && <AccountMenu profile={profile} />}</div>
        </header>

        {children}
      </div>
    </div>
  );
}
