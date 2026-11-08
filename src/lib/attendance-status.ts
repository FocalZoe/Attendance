import type { AttendanceStatus } from '@/types/database';

export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: '出席',
  absent: '缺席',
  late: '遲到',
  leave: '請假',
};

/** 手動覆寫選單用：含說明文字的選項 */
export const ATTENDANCE_STATUS_OPTIONS: Array<{ value: AttendanceStatus; label: string }> = [
  { value: 'present', label: '出席 (在座)' },
  { value: 'absent', label: '缺席 (曠課)' },
  { value: 'late', label: '遲到' },
  { value: 'leave', label: '請假' },
];
