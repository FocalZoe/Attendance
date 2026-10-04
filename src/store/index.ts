import { create } from 'zustand';
import { AuthSlice, createAuthSlice } from './slices/authSlice';
import { CameraSlice, createCameraSlice } from './slices/cameraSlice';
import { SeatSlice, createSeatSlice } from './slices/seatSlice';

export type RootStore = AuthSlice & CameraSlice & SeatSlice;

export const useAppStore = create<RootStore>()((...a) => ({
  ...createAuthSlice(...a),
  ...createCameraSlice(...a),
  ...createSeatSlice(...a),
}));

export * from './slices/authSlice';
export * from './slices/cameraSlice';
export * from './slices/seatSlice';
