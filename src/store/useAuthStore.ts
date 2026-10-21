import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isLoading: boolean;
  isInitialized: boolean;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string; redirectTo?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<Profile | null>;
  setProfile: (profile: Profile | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  session: null,
  isLoading: true,
  isInitialized: false,

  initialize: async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentSession = sessionData.session;

      if (currentSession?.user) {
        set({ user: currentSession.user, session: currentSession });
        await get().refreshProfile();
      } else {
        set({ user: null, profile: null, session: null, isLoading: false, isInitialized: true });
      }

      // 監聽後續登入/登出變化
      supabase.auth.onAuthStateChange(async (_event, newSession) => {
        if (newSession?.user) {
          set({ user: newSession.user, session: newSession });
          await get().refreshProfile();
        } else {
          set({ user: null, profile: null, session: null, isLoading: false });
        }
      });
    } catch (err) {
      console.error('初始化認證狀態失敗:', err);
      set({ isLoading: false, isInitialized: true });
    }
  },

  refreshProfile: async () => {
    const currentUser = get().user;
    if (!currentUser) {
      set({ profile: null, isLoading: false, isInitialized: true });
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, school:schools(*)')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (error) {
        console.error('取得個人資料失敗:', error);
      }

      const userProfile = (data as Profile) || null;
      set({ profile: userProfile, isLoading: false, isInitialized: true });
      return userProfile;
    } catch (err) {
      console.error('更新 Profile 異常:', err);
      set({ isLoading: false, isInitialized: true });
      return null;
    }
  },

  signIn: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error || !data.user) {
        set({ isLoading: false });
        return {
          success: false,
          error: error?.message === 'Invalid login credentials'
            ? '帳號或密碼錯誤，請重新確認'
            : (error?.message || '登入失敗，請稍後再試'),
        };
      }

      set({ user: data.user, session: data.session });
      const fetchedProfile = await get().refreshProfile();

      let targetRoute = '/dashboard';
      if (fetchedProfile?.role === 'sys_admin') {
        targetRoute = '/dashboard/sys-admin';
      } else if (fetchedProfile?.role === 'school_admin') {
        targetRoute = '/dashboard/school-admin';
      } else if (fetchedProfile?.role === 'teacher') {
        targetRoute = '/dashboard/teacher';
      }

      return {
        success: true,
        redirectTo: targetRoute,
      };
    } catch (err: unknown) {
      set({ isLoading: false });
      const msg = err instanceof Error ? err.message : '登入過程發生未預期錯誤';
      return { success: false, error: msg };
    }
  },

  signOut: async () => {
    set({ isLoading: true });
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('登出異常:', err);
    } finally {
      set({ user: null, profile: null, session: null, isLoading: false });
    }
  },

  setProfile: (profile: Profile | null) => {
    set({ profile });
  },
}));
