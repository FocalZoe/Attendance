import { useEffect, useRef } from 'react';
import { checkScheduleTrigger, getNextUpcomingSchedule } from '../services/scheduleService';
import { useScheduleStore } from '../store/scheduleStore';

export const useAutoRollcall = ({ onTrigger, isCameraActive }) => {
  const { scheduleConfig } = useScheduleStore();
  const lastTriggeredKeyRef = useRef(null);

  useEffect(() => {
    if (!scheduleConfig?.enabled) return;

    const checkTimer = setInterval(() => {
      const triggerResult = checkScheduleTrigger(scheduleConfig, lastTriggeredKeyRef.current);
      if (triggerResult && triggerResult.shouldTrigger) {
        lastTriggeredKeyRef.current = triggerResult.triggerKey;
        console.log(
          `⏰ [useAutoRollcall] 命中定時自動點名排程: ${triggerResult.schedule.time} (${triggerResult.schedule.period})`
        );
        if (onTrigger) {
          onTrigger(triggerResult.schedule.period);
        }
      }
    }, 1000);

    return () => clearInterval(checkTimer);
  }, [scheduleConfig, isCameraActive, onTrigger]);

  const nextUpcoming = getNextUpcomingSchedule(scheduleConfig);

  return {
    scheduleConfig,
    nextUpcoming,
  };
};
