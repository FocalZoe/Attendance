import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';

const THEME_META = {
  system: { label: '跟隨系統', Icon: Monitor },
  light: { label: '淺色', Icon: Sun },
  dark: { label: '深色', Icon: Moon },
} as const;

export function ThemeToggle() {
  const { preference, cycle } = useTheme();
  const { label, Icon } = THEME_META[preference];

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycle}
      title={`主題：${label}（點擊切換）`}
      aria-label={`主題：${label}，點擊切換`}
    >
      <Icon aria-hidden="true" />
    </Button>
  );
}
