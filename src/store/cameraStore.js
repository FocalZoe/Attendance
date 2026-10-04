import { create } from 'zustand';
import { isMobileDevice } from '../services/cameraDeviceService';

export const useCameraStore = create((set) => ({
  devices: [],
  selectedDeviceId: '',
  cameraActive: false,
  cameraError: null,
  previewTab: isMobileDevice() ? 'latest' : 'live',

  setDevices: (devices) => set({ devices }),
  setSelectedDeviceId: (selectedDeviceId) => set({ selectedDeviceId }),
  setCameraActive: (cameraActive) => set({ cameraActive }),
  setCameraError: (cameraError) => set({ cameraError }),
  setPreviewTab: (previewTab) => set({ previewTab }),
}));
