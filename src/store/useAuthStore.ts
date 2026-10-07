import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

export type UserRole = 'school_admin' | 'teacher' | 'parent'

export interface UserProfile {
  id: string
  name: string
  email?: string
  role: UserRole
  schoolId: string
  schoolName: string
  studentNo?: string
  seatNumber?: number
  assignedClassIds?: string[]
}

interface AuthState {
  user: UserProfile | null
  isAuthenticated: boolean
  isLoading: boolean
  setAuth: (user: UserProfile | null) => void
  logout: () => Promise<void>
  initialize: () => () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: (user) => set({ user, isAuthenticated: !!user }),

  logout: async () => {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.warn('[useAuthStore] Supabase signOut warning:', err)
    }
    set({ user: null, isAuthenticated: false, isLoading: false })
  },

  initialize: () => {
    set({ isLoading: true })

    const fetchUserProfile = async (userId: string, email?: string) => {
      try {
        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('*, schools(name)')
          .eq('id', userId)
          .maybeSingle()

        if (error || !profile) {
          console.warn('[useAuthStore] No user_profile found:', error?.message)
          set({ user: null, isAuthenticated: false, isLoading: false })
          return
        }

        let assignedClassIds: string[] = []
        if (profile.role === 'teacher') {
          const { data: tcData } = await supabase
            .from('teacher_classes')
            .select('class_id')
            .eq('teacher_id', userId)
          if (tcData) {
            assignedClassIds = tcData.map((item: { class_id: string }) => item.class_id)
          }
        }

        set({
          user: {
            id: userId,
            name: profile.name || email || '已認證使用者',
            email: email || profile.email,
            role: (profile.role as UserRole) || 'teacher',
            schoolId: profile.school_id || '',
            schoolName: profile.schools?.name || '',
            assignedClassIds,
          },
          isAuthenticated: true,
          isLoading: false,
        })
      } catch (err) {
        console.warn('[useAuthStore] fetchUserProfile error:', err)
        set({ user: null, isAuthenticated: false, isLoading: false })
      }
    }

    const loadSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          await fetchUserProfile(session.user.id, session.user.email)
        } else {
          set({ user: null, isAuthenticated: false, isLoading: false })
        }
      } catch (err) {
        console.warn('[useAuthStore] initialize error:', err)
        set({ user: null, isAuthenticated: false, isLoading: false })
      }
    }

    loadSession()

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await fetchUserProfile(session.user.id, session.user.email)
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false })
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  },
}))
