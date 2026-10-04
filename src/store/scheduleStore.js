import { create } from 'zustand';
import { getSavedSchedulesConfig } from '../services/scheduleService';

export const useScheduleStore = create((set) => ({
  scheduleConfig: getSavedSchedulesConfig(),
  isScheduleModalOpen: false,

  setScheduleConfig: (scheduleConfig) => set({ scheduleConfig }),
  setIsScheduleModalOpen: (isScheduleModalOpen) => set({ isScheduleModalOpen }),
  refreshScheduleConfig: () => set({ scheduleConfig: getSavedSchedulesConfig() }),
}));
