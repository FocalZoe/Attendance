import * as React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { AccountMenu } from '@/components/layout/account-menu';
import type { Profile } from '@/types/database';
import { Camera } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavbarProps {
  profile?: Profile | null;
}

function dashboardPath(role: Profile['role']): string {
  if (role === 'sys_admin') return '/dashboard/sys-admin';
  if (role === 'school_admin') return '/dashboard/school-admin';
  return '/dashboard/teacher';
}

const DASHBOARD_LABEL: Record<Profile['role'], string> = {
  sys_admin: '學校組織',
  school_admin: '校務管理',
  teacher: '今日點名',
};

export function Navbar({ profile: propProfile }: NavbarProps) {
  const { profile: storeProfile } = useAuthStore();
  const profile = propProfile !== undefined ? propProfile : storeProfile;

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'inline-flex h-10 items-center border-b-2 px-1 text-sm font-medium transition-colors',
      isActive
        ? 'border-primary text-foreground'
        : 'border-transparent text-muted-foreground hover:text-foreground'
    );

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-6">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Camera className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="truncate font-display text-lg font-bold leading-tight text-foreground">
              班級自動化點名系統
            </span>
          </Link>

          {profile && (
            <nav className="hidden items-center md:flex" aria-label="主要導覽">
              <NavLink to={dashboardPath(profile.role)} className={navLinkClass} end>
                {DASHBOARD_LABEL[profile.role]}
              </NavLink>
            </nav>
          )}
        </div>

        {profile ? (
          <AccountMenu profile={profile} />
        ) : (
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/parent-query">家長查勤</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/login">帳號登入</Link>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
