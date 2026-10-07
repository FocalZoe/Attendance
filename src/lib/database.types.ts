export type AppUserRole = 'school_admin' | 'teacher'

export interface School {
  id: string
  name: string
  code: string
  edu_code?: string | null
  contact_email?: string | null
  is_verified: boolean
  created_at: string
  updated_at: string
}

export interface UserProfile {
  id: string
  school_id: string
  role: AppUserRole
  name: string
  email?: string | null
  created_at: string
  updated_at: string
}

export interface ClassItem {
  id: string
  school_id: string
  name: string
  student_count?: number
  seat_layout?: Record<string, unknown>
  active_layout_key?: string
  created_at: string
  updated_at: string
}

export interface TeacherClass {
  teacher_id: string
  class_id: string
  is_homeroom: boolean
  created_at: string
}

export interface StudentItem {
  id: string
  class_id: string
  student_no: string
  seat_number: number
  name: string
  verify_code?: string | null
  magic_token?: string | null
  avatar_path?: string | null
  created_at: string
  updated_at: string
}

export interface AttendanceRecordRow {
  id: string
  student_id: string
  class_id: string
  period_key: string
  period_title?: string | null
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'
  photo_path?: string | null
  created_at: string
}

export interface VerifyStudentParentAccessResult {
  student_id: string
  student_name: string
  student_no: string
  seat_number: number
  class_name: string
  school_name: string
}
