import { create } from 'zustand'

export interface ParentStudentInfo {
  id: string
  name: string
  studentNo: string
  seatNumber: number
  className: string
  schoolName: string
  magicToken?: string
}

interface ParentState {
  student: ParentStudentInfo | null
  isAuthenticated: boolean
  setParentAuth: (student: ParentStudentInfo | null) => void
  clearParentAuth: () => void
}

export const useParentStore = create<ParentState>((set) => ({
  student: null,
  isAuthenticated: false,
  setParentAuth: (student) => {
    set({ student, isAuthenticated: !!student })
  },
  clearParentAuth: () => {
    set({ student: null, isAuthenticated: false })
  },
}))
