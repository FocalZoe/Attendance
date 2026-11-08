import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/hooks/useTheme';
import { isThemePreference, type ThemePreference } from '@/lib/theme';

export const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; Icon: typeof Sun }> = [
  { value: 'system', label: '跟隨系統', Icon: Monitor },
  { value: 'light', label: '淺色', Icon: Sun },
  { value: 'dark', label: '深色', Icon: Moon },
];

/** 主題單選項目，供獨立切換鈕與帳號選單共用 */
export function ThemeRadioItems({
  preference,
  setPreference,
}: {
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
}) {
  return (
    <DropdownMenuRadioGroup
      value={preference}
      onValueChange={(value) => {
        if (isThemePreference(value)) setPreference(value);
      }}
    >
      {THEME_OPTIONS.map(({ value, label, Icon }) => (
        <DropdownMenuRadioItem key={value} value={value}>
          <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
          {label}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}

/** 未登入頁面使用的主題切換 */
export function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  const { Icon } = THEME_OPTIONS.find((o) => o.value === preference) ?? THEME_OPTIONS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="切換主題">
          <Icon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <ThemeRadioItems preference={preference} setPreference={setPreference} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
