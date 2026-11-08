import { describe, expect, it } from 'vitest';
import {
  getNextSchedule,
  getTodaySchedules,
  isReminderDue,
  reminderKey,
  weekdayOf,
  REMINDER_GRACE_MIN,
} from './schedule';

// 2026-11-09 is a Monday; 2026-11-08 is a Sunday
const at = (day: number, h: number, m: number) => new Date(2026, 10, day, h, m, 0);

const monday8 = { id: 's1', weekday: 1, start_time: '08:00:00', remind_before_min: 5 };

describe('weekdayOf', () => {
  it('maps Sunday to 7 and Monday to 1', () => {
    expect(weekdayOf(at(8, 12, 0))).toBe(7);
    expect(weekdayOf(at(9, 12, 0))).toBe(1);
  });
});

describe('isReminderDue', () => {
  it('is false before the reminder window', () => {
    expect(isReminderDue(monday8, at(9, 7, 54))).toBe(false);
  });

  it('is true from remind_before_min before start', () => {
    expect(isReminderDue(monday8, at(9, 7, 55))).toBe(true);
    expect(isReminderDue(monday8, at(9, 8, 0))).toBe(true);
  });

  it('stays true until the grace period ends, then false', () => {
    expect(isReminderDue(monday8, at(9, 8, REMINDER_GRACE_MIN))).toBe(true);
    expect(isReminderDue(monday8, at(9, 8, REMINDER_GRACE_MIN + 1))).toBe(false);
  });

  it('is false on a different weekday', () => {
    expect(isReminderDue(monday8, at(10, 8, 0))).toBe(false);
  });

  it('is false for malformed times', () => {
    expect(isReminderDue({ ...monday8, start_time: 'abc' }, at(9, 8, 0))).toBe(false);
    expect(isReminderDue({ ...monday8, start_time: '25:00:00' }, at(9, 8, 0))).toBe(false);
  });
});

describe('getTodaySchedules / getNextSchedule', () => {
  const s = (id: string, weekday: number, start: string) => ({
    id,
    weekday,
    start_time: start,
    remind_before_min: 5,
  });
  const list = [
    s('b', 1, '10:10:00'),
    s('a', 1, '08:00:00'),
    s('c', 1, '13:30:00'),
    s('x', 2, '08:00:00'),
  ];

  it('returns only today in start-time order', () => {
    expect(getTodaySchedules(list, at(9, 7, 0)).map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('picks the first slot that has not ended yet', () => {
    expect(getNextSchedule(list, at(9, 7, 0))?.id).toBe('a');
    expect(getNextSchedule(list, at(9, 8, REMINDER_GRACE_MIN))?.id).toBe('a');
    expect(getNextSchedule(list, at(9, 8, REMINDER_GRACE_MIN + 1))?.id).toBe('b');
    expect(getNextSchedule(list, at(9, 12, 0))?.id).toBe('c');
  });

  it('returns null when nothing is left today', () => {
    expect(getNextSchedule(list, at(9, 20, 0))).toBeNull();
    expect(getNextSchedule(list, at(11, 8, 0))).toBeNull();
  });
});

describe('reminderKey', () => {
  it('is stable within a day and differs across days', () => {
    expect(reminderKey('s1', at(9, 8, 0))).toBe(reminderKey('s1', at(9, 8, 14)));
    expect(reminderKey('s1', at(9, 8, 0))).not.toBe(reminderKey('s1', at(10, 8, 0)));
  });
});
