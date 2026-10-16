export type UserRole = 'sys_admin' | 'school_admin' | 'teacher';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave';

export interface School {
  id: string;
  name: string;
  code: string;
  created_at: string;
}

export interface Profile {
  id: string;
  school_id: string | null;
  role: UserRole;
  name: string;
  email: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
  school?: School;
}

export interface SchoolClass {
  id: string;
  school_id: string;
  name: string;
  grade: string;
  academic_year: string;
  created_at: string;
}

export interface ClassTeacher {
  id: string;
  class_id: string;
  teacher_id: string;
  created_at: string;
  teacher?: Profile;
  class?: SchoolClass;
}

export interface Student {
  id: string;
  school_id: string;
  class_id: string;
  student_number: string;
  name: string;
  seat_number: number;
  gender: string | null;
  parent_phone: string;
  created_at: string;
}

export interface SeatingChart {
  id: string;
  class_id: string;
  name: string;
  aspect_ratio: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SeatingBox {
  id: string;
  chart_id: string;
  student_id: string | null;
  seat_label: string;
  x_ratio: number;
  y_ratio: number;
  w_ratio: number;
  h_ratio: number;
  created_at: string;
  student?: Student;
}

export interface AttendanceSession {
  id: string;
  class_id: string;
  teacher_id: string;
  chart_id: string | null;
  session_date: string;
  period: string | null;
  snapshot_path: string | null;
  detection_raw_json: Record<string, unknown> | null;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
  ai_detected_status: 'present' | 'absent' | null;
  is_overridden: boolean;
  note: string | null;
  created_at: string;
  student?: Student;
}

export interface ParentQueryResult {
  success: boolean;
  message?: string;
  student?: {
    id: string;
    name: string;
    student_number: string;
    seat_number: number;
    class_name: string;
    school_name: string;
  };
  records?: Array<{
    record_id: string;
    date: string;
    period: string | null;
    status: AttendanceStatus;
    ai_detected_status: 'present' | 'absent' | null;
    is_overridden: boolean;
    note: string | null;
    snapshot_path: string | null;
    created_at: string;
  }>;
}
