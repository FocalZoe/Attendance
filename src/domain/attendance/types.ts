/**
 * 考勤領域核心型別定義
 * 不依賴任何 UI 元件或框架狀態
 */

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'

export interface AttendanceRecord {
  id: string
  studentId: string
  studentNo: string
  studentName: string
  seatNumber: number
  classId: string
  className: string
  date: string // YYYY-MM-DD
  periodNumber: number
  status: AttendanceStatus
  recordedAt: string // ISO 8601
  verifiedByAi: boolean
  photoUrl?: string
}

export interface StudentAttendanceSummary {
  studentId: string
  studentNo: string
  studentName: string
  seatNumber: number
  totalPeriods: number
  presentCount: number
  absentCount: number
  lateCount: number
  excusedCount: number
  attendanceRate: number // 0 ~ 100
}
