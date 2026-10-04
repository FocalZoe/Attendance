import { StateCreator } from 'zustand';
import { DomainSeat, generateGridSeats } from '@/domain/spatial';

export interface SeatConfig {
  base_width: number;
  base_height: number;
  current_period: string;
  layout_name: string;
  layout_key: string;
  gridRows: number;
  gridCols: number;
  seats: DomainSeat[];
}

export interface SeatSlice {
  seatConfig: SeatConfig;
  isSeatEditorOpen: boolean;
  setSeatConfig: (seatConfig: SeatConfig) => void;
  setIsSeatEditorOpen: (isSeatEditorOpen: boolean) => void;
}

export const createSeatSlice: StateCreator<SeatSlice> = (set) => ({
  seatConfig: {
    base_width: 640,
    base_height: 480,
    current_period: '第 1 節',
    layout_name: '預設課堂佈局',
    layout_key: 'layout1',
    gridRows: 4,
    gridCols: 5,
    seats: generateGridSeats(4, 5, 640, 480),
  },
  isSeatEditorOpen: false,

  setSeatConfig: (seatConfig) => set({ seatConfig }),
  setIsSeatEditorOpen: (isSeatEditorOpen) => set({ isSeatEditorOpen }),
});
