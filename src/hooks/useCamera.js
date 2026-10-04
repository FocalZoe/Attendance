import { useState, useRef, useEffect, useCallback } from 'react';
import { isMobileDevice, getDesktopCameraSources, acquireCameraStream } from '../services/cameraDeviceService';
import { useCameraStore } from '../store/cameraStore';

export const useCamera = (videoRef) => {
  const isMobile = isMobileDevice();
  const {
    devices,
    setDevices,
    selectedDeviceId,
    setSelectedDeviceId,
    cameraActive,
    setCameraActive,
    cameraError,
    setCameraError,
  } = useCameraStore();

  const [cameraStream, setCameraStream] = useState(null);
  const streamRef = useRef(null);

  const getCameraDevices = useCallback(async () => {
    if (isMobile) return;
    try {
      const sources = await getDesktopCameraSources();
      setDevices(sources);
      if (sources.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(sources[0].id);
      }
    } catch (err) {
      console.warn('[useCamera] Enumerate devices error:', err);
    }
  }, [isMobile, selectedDeviceId, setDevices, setSelectedDeviceId]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraStream(null);
    setCameraActive(false);
  }, [setCameraActive]);

  const startCamera = useCallback(
    async (deviceId) => {
      if (isMobile) return;
      setCameraError(null);
      stopCamera();

      try {
        const stream = await acquireCameraStream(deviceId);
        streamRef.current = stream;
        setCameraStream(stream);

        stream.getVideoTracks().forEach((track) => {
          track.onended = () => {
            console.warn('[useCamera] Track ended. Restarting...');
            setCameraActive(false);
            setCameraStream(null);
            setTimeout(() => {
              if (!isMobile) startCamera(selectedDeviceId);
            }, 1200);
          };
          track.onunmute = () => {
            if (videoRef.current && videoRef.current.paused) {
              videoRef.current.play().catch(() => {});
            }
          };
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((e) => console.warn('[useCamera] Play warning:', e));
        }

        setCameraActive(true);
        await getCameraDevices();
      } catch (err) {
        console.error('[useCamera] Start camera error:', err);
        setCameraError('尚未啟動相機鏡頭（相機被佔用或權限未開啟）');
        setCameraActive(false);
        setCameraStream(null);
      }
    },
    [isMobile, selectedDeviceId, setCameraActive, setCameraError, stopCamera, videoRef, getCameraDevices]
  );

  // Tab 焦點/喚醒監聽重連
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && cameraActive && streamRef.current) {
        if (videoRef.current && videoRef.current.paused) {
          videoRef.current.play().catch(() => {});
        }
      }
    };
    const handleFocus = () => handleVisibilityChange();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [cameraActive, videoRef]);

  // 確保 videoRef srcObject 綁定
  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [cameraActive, videoRef]);

  // 初始化啟動
  useEffect(() => {
    if (!isMobile) {
      startCamera(selectedDeviceId);
    }
    return () => {
      stopCamera();
    };
  }, [isMobile, selectedDeviceId, startCamera, stopCamera]);

  return {
    isMobile,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    cameraActive,
    cameraStream,
    cameraError,
    startCamera,
    stopCamera,
    getCameraDevices,
  };
};
