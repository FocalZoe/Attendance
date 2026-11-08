export interface ReminderSchedule {
  id: string;
  weekday: number; // 1 (Mon) - 7 (Sun)
  start_time: string; // HH:MM or HH:MM:SS
  remind_before_min: number;
}

/** 開始時間後仍可提醒的寬限分鐘數（超過則視為已錯過，不再提醒） */
export const REMINDER_GRACE_MIN = 15;

/** JS Date.getDay() 為 0=週日；本系統使用 1=週一 … 7=週日 */
export function weekdayOf(date: Date): number {
  const d = date.getDay();
  return d === 0 ? 7 : d;
}

export function localDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function minutesOfDay(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/** 現在是否落在 [開始時間 - 提前分鐘, 開始時間 + 寬限] 區間（以本地時間計） */
export function isReminderDue(schedule: ReminderSchedule, now: Date): boolean {
  if (schedule.weekday !== weekdayOf(now)) return false;

  const start = minutesOfDay(schedule.start_time);
  if (start === null) return false;

  const current = now.getHours() * 60 + now.getMinutes();
  return current >= start - schedule.remind_before_min && current <= start + REMINDER_GRACE_MIN;
}

/** 每個課表時段每天只提醒一次 */
export function reminderKey(scheduleId: string, now: Date): string {
  return `${scheduleId}:${localDateString(now)}`;
}

/** 顯示用：HH:MM:SS → HH:MM */
export function formatTime(time: string): string {
  return time.slice(0, 5);
}

export const WEEKDAY_LABELS: Record<number, string> = {
  1: '週一',
  2: '週二',
  3: '週三',
  4: '週四',
  5: '週五',
  6: '週六',
  7: '週日',
};
