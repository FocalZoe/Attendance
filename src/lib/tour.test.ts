import { describe, expect, it } from 'vitest';
import { availableSteps, tourStorageKey, TOUR_STEPS } from './tour';

describe('availableSteps', () => {
  it('drops steps whose target is missing', () => {
    const steps = availableSteps(TOUR_STEPS.teacher, (sel) => sel === '[data-tour="today"]');
    expect(steps).toHaveLength(1);
    expect(steps[0].title).toBe('今天的點名');
  });

  it('keeps every step when all targets exist', () => {
    expect(availableSteps(TOUR_STEPS.school_admin, () => true)).toHaveLength(TOUR_STEPS.school_admin.length);
  });
});

describe('TOUR_STEPS', () => {
  it('no longer sends teachers to a schedule editor', () => {
    expect(TOUR_STEPS.teacher.some((s) => s.selector.includes('"schedule"'))).toBe(false);
  });

  it('points school admins to the schedule button', () => {
    expect(TOUR_STEPS.school_admin.some((s) => s.selector === '[data-tour="sa-schedule"]')).toBe(true);
  });
});

describe('tourStorageKey', () => {
  it('is scoped by role and user', () => {
    expect(tourStorageKey('teacher', 'u1')).toBe('attendance:tour:teacher:u1');
    expect(tourStorageKey('school_admin', 'u1')).not.toBe(tourStorageKey('teacher', 'u1'));
  });
});
