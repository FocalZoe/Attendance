export type CameraPermissionState = 'granted' | 'prompt' | 'denied' | 'unknown';

/** Map the browser's PermissionState (or a missing Permissions API) to our state. */
export function mapPermissionState(state: PermissionState | undefined | null): CameraPermissionState {
  if (state === 'granted' || state === 'denied' || state === 'prompt') return state;
  return 'unknown';
}

/** Whether the camera should start by itself when the rollcall dialog opens. */
export function shouldAutoStartCamera(state: CameraPermissionState, usesNetworkCamera: boolean): boolean {
  return state === 'granted' && !usesNetworkCamera;
}

/** Step-by-step help shown when the browser has blocked the camera. */
export const CAMERA_BLOCKED_STEPS = [
  '按網址列左邊的鎖頭（或設定）圖示',
  '找到「相機」，改成「允許」',
  '重新整理這個頁面',
];
