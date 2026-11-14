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

/** 取出今天（本地時間）的時段，依開始時間由早到晚排序 */
export function getTodaySchedules<T extends ReminderSchedule>(schedules: T[], now: Date): T[] {
  const weekday = weekdayOf(now);
  return schedules
    .filter((s) => s.weekday === weekday && minutesOfDay(s.start_time) !== null)
    .sort((a, b) => (minutesOfDay(a.start_time) ?? 0) - (minutesOfDay(b.start_time) ?? 0));
}

/**
 * 「下一節」：今天第一個尚未結束的時段。
 * 開始後 REMINDER_GRACE_MIN 分鐘內仍視為進行中，仍可點名。
 */
export function getNextSchedule<T extends ReminderSchedule>(schedules: T[], now: Date): T | null {
  const current = now.getHours() * 60 + now.getMinutes();
  return (
    getTodaySchedules(schedules, now).find(
      (s) => (minutesOfDay(s.start_time) ?? 0) + REMINDER_GRACE_MIN >= current
    ) ?? null
  );
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

export interface ExpandedSchedule extends ReminderSchedule {
  class_id: string;
  period: string;
  class?: { name: string } | null;
}

/**
 * The school-wide period table applies to every class and every weekday (Mon-Fri).
 * shortcut: no per-class timetable, so a teacher is reminded for each of their classes in every period; upgrade when a real timetable exists.
 */
export function expandPeriods(
  periods: Array<{ period: string; start_time: string; remind_before_min: number }>,
  classes: Array<{ id: string; name: string }>
): ExpandedSchedule[] {
  const out: ExpandedSchedule[] = [];
  for (const c of classes) {
    for (let weekday = 1; weekday <= 5; weekday++) {
      for (const p of periods) {
        out.push({
          id: `${c.id}:${weekday}:${p.period}`,
          weekday,
          class_id: c.id,
          period: p.period,
          start_time: p.start_time,
          remind_before_min: p.remind_before_min,
          class: { name: c.name },
        });
      }
    }
  }
  return out;
}
