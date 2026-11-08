import * as React from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import {
  START_TOUR_EVENT,
  TOUR_STEPS,
  availableSteps,
  hasSeenTour,
  markTourSeen,
  type TourRole,
} from '@/lib/tour';

interface UseProductTourOptions {
  role: TourRole;
  userId?: string;
  /** Start only once the page has rendered its real content (not skeletons) */
  ready: boolean;
}

/**
 * Interactive first-run tour. Auto-starts once per user and role; the account
 * menu's replay item re-runs it by dispatching START_TOUR_EVENT.
 */
export function useProductTour({ role, userId, ready }: UseProductTourOptions) {
  // Guards against two tours overlapping (for example when `ready` flips after a data reload)
  const runningRef = React.useRef(false);
  const autoStartedRef = React.useRef(false);

  const start = React.useCallback(() => {
    if (!userId || runningRef.current) return;
    const steps = availableSteps(TOUR_STEPS[role], (sel) => !!document.querySelector(sel));
    if (steps.length === 0) return;

    const tour = driver({
      showProgress: true,
      allowClose: true,
      overlayOpacity: 0.55,
      stagePadding: 6,
      stageRadius: 8,
      nextBtnText: '下一步',
      prevBtnText: '上一步',
      doneBtnText: '開始使用',
      progressText: '{{current}} / {{total}}',
      steps: steps.map((s) => ({
        element: s.selector,
        popover: { title: s.title, description: s.description, side: s.side, align: 'center' },
      })),
      onDestroyed: () => {
        runningRef.current = false;
        markTourSeen(role, userId);
      },
    });
    runningRef.current = true;
    tour.drive();
  }, [role, userId]);

  // First visit: start automatically once content is ready
  React.useEffect(() => {
    if (!ready || !userId || autoStartedRef.current || hasSeenTour(role, userId)) return;
    const timer = window.setTimeout(() => {
      autoStartedRef.current = true;
      start();
    }, 600);
    return () => window.clearTimeout(timer);
  }, [ready, role, userId, start]);

  // Manual restart from the account menu
  React.useEffect(() => {
    const handler = () => start();
    window.addEventListener(START_TOUR_EVENT, handler);
    return () => window.removeEventListener(START_TOUR_EVENT, handler);
  }, [start]);
}
