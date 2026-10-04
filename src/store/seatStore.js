import { create } from 'zustand';
import { getSavedSeatsConfig } from '../services/seatOccupancyService';

export const useSeatStore = create((set) => ({
  seatConfig: getSavedSeatsConfig(),
  isSeatEditorOpen: false,

  setSeatConfig: (seatConfig) => set({ seatConfig }),
  setIsSeatEditorOpen: (isSeatEditorOpen) => set({ isSeatEditorOpen }),
  refreshSeatConfig: () => set({ seatConfig: getSavedSeatsConfig() }),
}));
