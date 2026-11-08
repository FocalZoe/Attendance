import * as React from 'react';
import {
  THEME_STORAGE_KEY,
  isThemePreference,
  nextThemePreference,
  resolveTheme,
  type ThemePreference,
} from '@/lib/theme';

function readPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(saved) ? saved : 'system';
  } catch {
    return 'system';
  }
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme(preference: ThemePreference) {
  const resolved = resolveTheme(preference, systemPrefersDark());
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

export function useTheme() {
  const [preference, setPreference] = React.useState<ThemePreference>(readPreference);

  React.useEffect(() => {
    applyTheme(preference);

    // 偏好為「跟隨系統」時，系統切換日夜模式要即時反映
    if (preference !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [preference]);

  const update = React.useCallback((next: ThemePreference) => {
    setPreference(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // 私密模式等無法寫入時，僅在本次分頁內生效
    }
  }, []);

  const cycle = React.useCallback(() => update(nextThemePreference(preference)), [preference, update]);

  return { preference, setPreference: update, cycle };
}
