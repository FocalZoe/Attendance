import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL: string =
  (import.meta.env && (import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL)) ||
  'https://fsutnzfqzbfvdjjzizzf.supabase.co';

const SUPABASE_KEY: string =
  (import.meta.env &&
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env.VITE_SUPABASE_ANON_KEY ||
      import.meta.env.SUPABASE_ANON_KEY)) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzdXRuemZxemJmdmRqanppenpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMjczMDEsImV4cCI6MjA5NzYwMzMwMX0.7BjvnIrcccp7gxJp0zo9nLJEU1HHk2nlFUb5Ul2tjr8';

export const supabaseClient: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export interface AuthSessionData {
  role: 'admin' | 'teacher' | 'class' | 'parent';
  id: string;
  name: string;
  schoolId?: string;
  schoolName?: string;
  currentClassId?: string;
  currentClassName?: string;
  studentCount?: number;
  activeLayoutKey?: string;
  user?: any;
  [key: string]: any;
}

const AUTH_STORAGE_KEY = 'attendance_auth_session_v2';

export const getAuthSession = (): AuthSessionData | null => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        (parsed.role === 'admin' ||
          parsed.role === 'teacher' ||
          parsed.role === 'class' ||
          parsed.role === 'parent')
      ) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[AuthDomain] 讀取登入會話失敗:', err);
  }
  return null;
};

export const saveAuthSession = (
  role: 'admin' | 'teacher' | 'class' | 'parent',
  user: any,
  extra: Record<string, any> = {}
): AuthSessionData | null => {
  try {
    const sessionData: AuthSessionData = {
      role,
      id: user?.id || '',
      name: user?.name || user?.email || user?.account || '已登入使用者',
      schoolId: user?.school_id || '',
      schoolName: extra.schoolName || '',
      currentClassId: extra.currentClassId || user?.active_class_id || '',
      currentClassName: extra.currentClassName || user?.class_name || '',
      studentCount: user?.student_count || 0,
      activeLayoutKey: user?.active_layout_key || 'layout1',
      user,
      ...extra,
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionData));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:session-changed', { detail: sessionData }));
    }
    return sessionData;
  } catch (err) {
    console.error('[AuthDomain] 儲存登入會話失敗:', err);
    return null;
  }
};

export const logoutAuth = async (): Promise<void> => {
  try {
    await supabaseClient.auth.signOut().catch(() => {});
    localStorage.removeItem(AUTH_STORAGE_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:session-changed', { detail: null }));
    }
  } catch (err) {
    console.error('[AuthDomain] 登出失敗:', err);
  }
};
