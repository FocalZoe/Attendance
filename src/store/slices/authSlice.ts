import { StateCreator } from 'zustand';
import { AuthSessionData, getAuthSession, logoutAuth } from '@/domain/auth';

export interface AuthSlice {
  session: AuthSessionData | null;
  isLoginModalOpen: boolean;
  setSession: (session: AuthSessionData | null) => void;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  logout: () => Promise<void>;
}

export const createAuthSlice: StateCreator<AuthSlice> = (set) => ({
  session: getAuthSession(),
  isLoginModalOpen: false,

  setSession: (session) => set({ session }),
  openLoginModal: () => set({ isLoginModalOpen: true }),
  closeLoginModal: () => set({ isLoginModalOpen: false }),

  logout: async () => {
    await logoutAuth();
    set({ session: null });
  },
});
