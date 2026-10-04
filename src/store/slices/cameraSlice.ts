import { StateCreator } from 'zustand';

export interface CameraDevice {
  deviceId: string;
  label: string;
}

export interface CameraSlice {
  devices: CameraDevice[];
  selectedDeviceId: string;
  cameraActive: boolean;
  cameraError: string | null;
  previewTab: 'live' | 'latest';
  setDevices: (devices: CameraDevice[]) => void;
  setSelectedDeviceId: (selectedDeviceId: string) => void;
  setCameraActive: (cameraActive: boolean) => void;
  setCameraError: (cameraError: string | null) => void;
  setPreviewTab: (previewTab: 'live' | 'latest') => void;
}

export const createCameraSlice: StateCreator<CameraSlice> = (set) => ({
  devices: [],
  selectedDeviceId: '',
  cameraActive: false,
  cameraError: null,
  previewTab: 'live',

  setDevices: (devices) => set({ devices }),
  setSelectedDeviceId: (selectedDeviceId) => set({ selectedDeviceId }),
  setCameraActive: (cameraActive) => set({ cameraActive }),
  setCameraError: (cameraError) => set({ cameraError }),
  setPreviewTab: (previewTab) => set({ previewTab }),
});
