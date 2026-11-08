import * as React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ThemeRadioItems, ThemeToggle } from '@/components/ui/theme-toggle';
import { ChangePasswordDialog } from '@/components/ui/change-password-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Profile } from '@/types/database';
import { Camera, KeyRound, LogOut, Palette } from 'lucide-react';
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

const DASHBOARD_LABEL: Record<Profile['role'], string> = {
  sys_admin: '學校組織',
  school_admin: '校務管理',
  teacher: '今日點名',
};

export function Navbar({ profile: propProfile }: NavbarProps) {
  const navigate = useNavigate();
  const { profile: storeProfile, signOut } = useAuthStore();
  const { preference, setPreference } = useTheme();
  const profile = propProfile !== undefined ? propProfile : storeProfile;

  const [passwordDialogOpen, setPasswordDialogOpen] = React.useState(false);

  const handleSignOut = async () => {
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
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-11 gap-2.5 px-2"
                  aria-label={`${profile.name} 的帳號選單`}
                >
                  <span className="hidden flex-col text-right leading-tight md:flex">
                    <span className="text-sm font-bold text-foreground">{profile.name}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {profile.school?.name || ROLE_LABEL[profile.role]}
                    </span>
                  </span>
                  <Avatar>
                    <AvatarFallback className="bg-primary font-display text-sm font-bold text-primary-foreground">
                      {profile.name.slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="space-y-1.5 py-2">
                  <span className="block text-sm font-bold text-foreground">{profile.name}</span>
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    {profile.email}
                  </span>
                  <Badge variant={ROLE_BADGE[profile.role]}>{ROLE_LABEL[profile.role]}</Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setPasswordDialogOpen(true)}>
                  <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" />
                  修改密碼
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Palette className="mr-2 h-4 w-4" aria-hidden="true" />
                    主題
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <ThemeRadioItems preference={preference} setPreference={setPreference} />
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                  登出
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <ChangePasswordDialog
              open={passwordDialogOpen}
              onOpenChange={setPasswordDialogOpen}
              email={profile.email}
            />
          </>
        ) : (
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/parent-query">家長查勤</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/login">教職員登入</Link>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
