import * as React from 'react';
import { mapPermissionState, type CameraPermissionState } from '@/lib/camera-permission';

/**
 * Tracks the browser's camera permission and exposes request() to trigger the
 * permission prompt up front. request() opens the camera only long enough to
 * ask, then stops every track immediately.
 */
export function useCameraPermission() {
  const [state, setState] = React.useState<CameraPermissionState>('unknown');
  const statusRef = React.useRef<PermissionStatus | null>(null);

  const check = React.useCallback(async () => {
    try {
      if (!navigator.permissions?.query) {
        setState('unknown');
        return;
      }
      const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
      statusRef.current = status;
      setState(mapPermissionState(status.state));
      status.onchange = () => setState(mapPermissionState(status.state));
    } catch {
      // Some browsers (e.g. Safari) do not support querying "camera"
      setState('unknown');
    }
  }, []);

  React.useEffect(() => {
    check();
    return () => {
      if (statusRef.current) statusRef.current.onchange = null;
    };
  }, [check]);

  /** Returns true when the user allowed the camera */
  const request = React.useCallback(async (): Promise<boolean> => {
    if (!navigator.mediaDevices?.getUserMedia) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      stream.getTracks().forEach((t) => t.stop());
      setState('granted');
      return true;
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') setState('denied');
      return false;
    }
  }, []);

  return { state, request, recheck: check };
}
