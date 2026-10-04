import { create } from 'zustand';
import { getAuthSession, logoutAuth, subscribeAuthSession } from '../services/authService';

export const useAuthStore = create((set) => {
  subscribeAuthSession((session) => set({ session }));

  return {
    session: getAuthSession(),
    isLoginModalOpen: false,

    setSession: (session) => set({ session }),

    openLoginModal: () => set({ isLoginModalOpen: true }),
    closeLoginModal: () => set({ isLoginModalOpen: false }),

    logout: async () => {
      await logoutAuth();
      set({ session: null });
    },
  };
});
