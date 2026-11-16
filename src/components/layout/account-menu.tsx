import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ThemeRadioItems } from '@/components/ui/theme-toggle';
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
import { CircleHelp, KeyRound, LogOut, Palette } from 'lucide-react';
import { START_TOUR_EVENT } from '@/lib/tour';

export const ROLE_LABEL: Record<Profile['role'], string> = {
  sys_admin: '系統總管',
  school_admin: '學校主管',
  teacher: '任課教師',
};

const ROLE_BADGE: Record<Profile['role'], 'default' | 'success' | 'info'> = {
  sys_admin: 'default',
  school_admin: 'success',
  teacher: 'info',
};

/** 帳號選單：改密碼、切換主題、重看導覽、登出。頂欄與側欄外框共用。 */
export function AccountMenu({ profile }: { profile: Profile }) {
  const navigate = useNavigate();
  const { signOut } = useAuthStore();
  const { preference, setPreference } = useTheme();
  const [passwordDialogOpen, setPasswordDialogOpen] = React.useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-11 gap-2.5 px-2"
            data-tour="account"
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
            <span className="block truncate text-xs font-normal text-muted-foreground">{profile.email}</span>
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
          {profile.role !== 'sys_admin' && (
            <DropdownMenuItem onSelect={() => window.dispatchEvent(new Event(START_TOUR_EVENT))}>
              <CircleHelp className="mr-2 h-4 w-4" aria-hidden="true" />
              重看導覽
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
            登出
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ChangePasswordDialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen} email={profile.email} />
    </>
  );
}
