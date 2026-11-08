import * as React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChangePasswordDialog } from '@/components/ui/change-password-dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { Profile } from '@/types/database';
import { Camera, KeyRound, LogOut, Menu, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavbarProps {
  profile?: Profile | null;
}

const ROLE_LABEL: Record<Profile['role'], string> = {
  sys_admin: '系統總管',
  school_admin: '學校主管',
  teacher: '任課教師',
};

const ROLE_BADGE: Record<Profile['role'], 'default' | 'success' | 'info'> = {
  sys_admin: 'default',
  school_admin: 'success',
  teacher: 'info',
};

function dashboardPath(role: Profile['role']): string {
  if (role === 'sys_admin') return '/dashboard/sys-admin';
  if (role === 'school_admin') return '/dashboard/school-admin';
  return '/dashboard/teacher';
}

export function Navbar({ profile: propProfile }: NavbarProps) {
  const navigate = useNavigate();
  const { profile: storeProfile, signOut } = useAuthStore();
  const profile = propProfile !== undefined ? propProfile : storeProfile;

  const [menuOpen, setMenuOpen] = React.useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = React.useState(false);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    navigate('/login');
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'inline-flex h-10 items-center border-b-2 px-1 text-sm font-medium transition-colors',
      isActive
        ? 'border-primary text-foreground'
        : 'border-transparent text-muted-foreground hover:text-foreground'
    );

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-0">
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
            <nav className="hidden items-center gap-5 md:flex" aria-label="主要導覽">
              <NavLink to={dashboardPath(profile.role)} className={navLinkClass} end>
                {profile.role === 'sys_admin'
                  ? '學校組織'
                  : profile.role === 'school_admin'
                  ? '校務管理'
                  : '今日點名'}
              </NavLink>
            </nav>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/parent-query">
              <Search aria-hidden="true" />
              家長查勤
            </Link>
          </Button>

          <ThemeToggle />

          {profile ? (
            <>
              <div className="hidden items-center gap-3 pl-2 md:flex">
                <div className="flex flex-col text-right leading-tight">
                  <span className="text-sm font-bold text-foreground">{profile.name}</span>
                  <span className="text-xs text-muted-foreground">{profile.school?.name || profile.email}</span>
                </div>
                <Badge variant={ROLE_BADGE[profile.role]}>{ROLE_LABEL[profile.role]}</Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPasswordDialogOpen(true)}
                  title="修改密碼"
                  aria-label="修改密碼"
                >
                  <KeyRound aria-hidden="true" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleSignOut} title="登出" aria-label="登出">
                  <LogOut aria-hidden="true" />
                </Button>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMenuOpen(true)}
                aria-label="開啟選單"
              >
                <Menu aria-hidden="true" />
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link to="/register">開通學校</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/login">教職員登入</Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      {profile && (
        <>
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetContent side="right" className="flex flex-col gap-6">
              <SheetHeader className="text-left">
                <SheetTitle>{profile.name}</SheetTitle>
                <SheetDescription>{profile.school?.name || profile.email}</SheetDescription>
                <div>
                  <Badge variant={ROLE_BADGE[profile.role]}>{ROLE_LABEL[profile.role]}</Badge>
                </div>
              </SheetHeader>

              <nav className="flex flex-col gap-1" aria-label="行動版選單">
                <Button asChild variant="ghost" className="justify-start" onClick={() => setMenuOpen(false)}>
                  <Link to={dashboardPath(profile.role)}>我的控制台</Link>
                </Button>
                <Button asChild variant="ghost" className="justify-start" onClick={() => setMenuOpen(false)}>
                  <Link to="/parent-query">
                    <Search aria-hidden="true" />
                    家長查勤
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start"
                  onClick={() => {
                    setMenuOpen(false);
                    setPasswordDialogOpen(true);
                  }}
                >
                  <KeyRound aria-hidden="true" />
                  修改密碼
                </Button>
              </nav>

              <Button variant="outline" className="mt-auto justify-start" onClick={handleSignOut}>
                <LogOut aria-hidden="true" />
                登出
              </Button>
            </SheetContent>
          </Sheet>

          <ChangePasswordDialog
            open={passwordDialogOpen}
            onOpenChange={setPasswordDialogOpen}
            email={profile.email}
          />
        </>
      )}
    </header>
  );
}
