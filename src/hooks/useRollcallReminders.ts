import * as React from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { expandPeriods, isReminderDue, localDateString, reminderKey, type ExpandedSchedule } from '@/lib/schedule';
import { periodLabel } from '@/lib/periods';

const CHECK_INTERVAL_MS = 30_000;
const STORAGE_KEY = 'rollcall-reminders-fired';

export type ScheduleWithClass = ExpandedSchedule;

function readFired(today: string): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const keys = raw ? (JSON.parse(raw) as string[]) : [];
    // 僅保留今天的紀錄，避免無限成長
    return new Set(keys.filter((k) => k.endsWith(`:${today}`)));
  } catch {
    return new Set();
  }
}

function writeFired(keys: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...keys]));
  } catch {
    // localStorage 不可用時，僅於本次分頁生命週期內去重
  }
}

interface UseRollcallRemindersOptions {
  teacherId: string | undefined;
  schoolId: string | null | undefined;
  /** 使用者點選「開始點名」時呼叫 */
  onStart: (classId: string, period: string) => void;
}

export function useRollcallReminders({ teacherId, schoolId, onStart }: UseRollcallRemindersOptions) {
  const [schedules, setSchedules] = React.useState<ScheduleWithClass[]>([]);
  const [permission, setPermission] = React.useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  );
  const firedRef = React.useRef<Set<string>>(new Set());
  const onStartRef = React.useRef(onStart);

  React.useEffect(() => {
    onStartRef.current = onStart;
  }, [onStart]);

  const reload = React.useCallback(async () => {
    if (!teacherId || !schoolId) return;
    const [periodsRes, classesRes] = await Promise.all([
      supabase.from('school_periods').select('period, start_time, remind_before_min').eq('school_id', schoolId),
      supabase.from('class_teachers').select('class:classes(id, name)').eq('teacher_id', teacherId),
    ]);

    if (periodsRes.error || classesRes.error) {
      console.error('Failed to load rollcall times:', periodsRes.error ?? classesRes.error);
      return;
    }
    const classes = (classesRes.data || [])
      .map((row) => row.class as unknown as { id: string; name: string } | null)
      .filter((c): c is { id: string; name: string } => !!c);
    setSchedules(expandPeriods(periodsRes.data || [], classes));
  }, [teacherId, schoolId]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  React.useEffect(() => {
    if (schedules.length === 0) return;

    const check = async () => {
      const now = new Date();
      const today = localDateString(now);
      if (firedRef.current.size === 0) firedRef.current = readFired(today);

      for (const schedule of schedules) {
        const key = reminderKey(schedule.id, now);
        if (firedRef.current.has(key) || !isReminderDue(schedule, now)) continue;

        // 先標記，避免非同步查詢期間下一輪重複觸發
        firedRef.current.add(key);
        writeFired(firedRef.current);

        // 該班該日該節已點名則不再提醒
        const { count } = await supabase
          .from('attendance_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('class_id', schedule.class_id)
          .eq('session_date', today)
          .eq('period', schedule.period);
        if ((count ?? 0) > 0) continue;

        const className = schedule.class?.name ?? '班級';
        const title = `${className} · ${periodLabel(schedule.period)} 點名時間到`;

        toast(title, {
          duration: 60_000,
          action: {
            label: '開始點名',
            onClick: () => onStartRef.current(schedule.class_id, schedule.period),
          },
        });

        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            const notification = new Notification(title, { body: '點擊以回到點名頁面' });
            notification.onclick = () => {
              window.focus();
              onStartRef.current(schedule.class_id, schedule.period);
              notification.close();
            };
          } catch {
            // 部分行動瀏覽器不支援 new Notification，已有站內 toast 作為備援
          }
        }
      }
    };

    check();
    const timer = window.setInterval(check, CHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [schedules]);

  const requestPermission = React.useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }, []);

  return { schedules, reload, permission, requestPermission };
}
