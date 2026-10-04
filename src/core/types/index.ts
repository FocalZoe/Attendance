/**
 * 系統核心全域型別定義
 */

export type UserRole = 'super_admin' | 'school_admin' | 'teacher' | 'parent';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  school_id: string | null;
  full_name?: string;
  created_at?: string;
}

export interface Classroom {
  id: string;
  school_id: string;
  name: string;
  capacity?: number;
  created_at?: string;
}

export interface Seat {
  id: string;
  classroom_id: string;
  seat_number: string;
  x: number;
  y: number;
  width: number;
  height: number;
  is_occupied?: boolean;
}

export interface Student {
  id: string;
  school_id: string;
  classroom_id?: string;
  name: string;
  student_number: string;
  created_at?: string;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  classroom_id: string;
  timestamp: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  confidence_score?: number;
  is_verified?: boolean;
}
