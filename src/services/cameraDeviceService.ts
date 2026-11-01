// ==============================================================================
// 班級自動化點名系統 - 裝置偵測與相機來源分流管理服務 (cameraDeviceService.ts)
// 支援 Webcam 實體鏡頭 (3 層容錯降級) 與 Ameba 網路相機虛擬串流
// ==============================================================================

export const AMEBA_DEVICE_ID = 'device_ameba_network_cam';

export interface CameraSource {
  id: string;
  type: 'webcam' | 'ameba';
  name: string;
  deviceId: string;
}

/**
 * 智慧偵測當前終端設備是否為行動裝置 (手機或平板)
 */
export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;

  // 1. 現代瀏覽器 userAgentData
  const nav = navigator as unknown as { userAgentData?: { mobile?: boolean } };
  if (nav.userAgentData?.mobile) {
    return true;
  }

  // 2. 傳統 User-Agent 關鍵字比對
  const ua = navigator.userAgent || navigator.vendor || '';
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true;
  }

  // 3. iPadOS 偽裝為 MacIntel 且具觸控點
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) {
    return true;
  }

  // 4. 具備觸控點且螢幕寬度小於 1024px
  const hasTouch = 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
  if (hasTouch && window.innerWidth < 1024) {
    return true;
  }

  return false;
};

/**
 * 取得電腦端可用之相機來源清單 (包含實體 Webcam 與 Ameba 網路鏡頭)
 */
export const getDesktopCameraSources = async (): Promise<CameraSource[]> => {
  const sources: CameraSource[] = [];

  try {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices.filter((d) => d.kind === 'videoinput');

      videoInputs.forEach((d, index) => {
        const rawLabel = d.label || '';
        const displayName = rawLabel ? `🎥 ${rawLabel}` : `🎥 Webcam 視訊鏡頭 #${index + 1}`;
        sources.push({
          id: d.deviceId,
          type: 'webcam',
          name: displayName,
          deviceId: d.deviceId,
        });
      });
    }
  } catch (err) {
    console.warn('[CameraDeviceService] 枚舉鏡頭裝置失敗:', err);
  }

  // 若無偵測到任何實體鏡頭，提供預設 Webcam 項目
  if (sources.length === 0) {
    sources.push({
      id: 'default_webcam',
      type: 'webcam',
      name: '🎥 預設視訊鏡頭 (Default Webcam)',
      deviceId: '',
    });
  }

  // 新增 Ameba 網路相機模擬選項
  sources.push({
    id: AMEBA_DEVICE_ID,
    type: 'ameba',
    name: '📡 Ameba 網路相機 (Ameba IP Camera 測試串流)',
    deviceId: AMEBA_DEVICE_ID,
  });

  return sources;
};

/**
 * 建立 Ameba 網路相機的虛擬模擬視訊串流 (Canvas 30fps 測試圖訊)
 */
export const createAmebaCanvasStream = (ipAddress: string = '192.168.1.100'): MediaStream | null => {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');

  let frameCount = 0;
  const drawAmebaTestPattern = () => {
    if (!ctx) return;
    frameCount++;

    // 背景深色科技漸層
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#1e293b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 科技網格線
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.15)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // 動態掃描線
    const scanY = (frameCount * 3) % canvas.height;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, scanY);
    ctx.lineTo(canvas.width, scanY);
    ctx.stroke();

    // 中央標題與狀態
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('📡 AMEBA IP CAMERA STREAM', canvas.width / 2, canvas.height / 2 - 40);

    ctx.fillStyle = '#10b981';
    ctx.font = '22px monospace';
    ctx.fillText('STATUS: ONLINE · 1280×720 @30FPS · RTSP/MJPEG', canvas.width / 2, canvas.height / 2 + 10);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px monospace';
    ctx.fillText(`TIME: ${new Date().toISOString()} · FRAME #${frameCount}`, canvas.width / 2, canvas.height / 2 + 50);

    // 模擬在座人體方塊 (提供視覺測試)
    ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.strokeRect(300, 280, 200, 320);
    ctx.fillRect(300, 280, 200, 320);

    ctx.strokeRect(780, 280, 200, 320);
    ctx.fillRect(780, 280, 200, 320);
  };

  const stream: MediaStream | null = (canvas as HTMLCanvasElement & { captureStream?(fps: number): MediaStream }).captureStream
    ? (canvas as HTMLCanvasElement & { captureStream(fps: number): MediaStream }).captureStream(30)
    : null;

  if (!stream) {
    return null;
  }

  const timer = setInterval(drawAmebaTestPattern, 33);
  const videoTrack = stream.getVideoTracks()[0];
  if (videoTrack) {
    const origStop = videoTrack.stop.bind(videoTrack);
    videoTrack.stop = () => {
      clearInterval(timer);
      origStop();
    };
  }

  return stream;
};

/**
 * 啟動相機串流 (支援 Webcam 與 Ameba 網路相機分流，三層容錯降級)
 */
export const acquireCameraStream = async (sourceId: string, amebaIp: string = '192.168.1.100'): Promise<MediaStream> => {
  // 1. 若選擇 Ameba 網路相機
  if (sourceId === AMEBA_DEVICE_ID) {
    const amebaStream = createAmebaCanvasStream(amebaIp);
    if (amebaStream) return amebaStream;
  }

  // 2. 若選擇實體 Webcam (三層容錯降級)
  const isDefault = !sourceId || sourceId === 'default_webcam';

  // 第一層：exact deviceId 理想 1080p
  try {
    const constraints: MediaStreamConstraints = {
      video: isDefault
        ? { width: { ideal: 1920 }, height: { ideal: 1080 } }
        : { deviceId: { exact: sourceId }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    };
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err1) {
    console.warn('[CameraDeviceService] Exact deviceId 失敗，降級為 soft 限制:', err1);
    // 第二層：soft deviceId 理想 720p
    try {
      const fallbackConstraints: MediaStreamConstraints = {
        video: isDefault
          ? { width: { ideal: 1280 }, height: { ideal: 720 } }
          : { deviceId: sourceId, width: { ideal: 1280 }, height: { ideal: 720 } },
      };
      return await navigator.mediaDevices.getUserMedia(fallbackConstraints);
    } catch (err2) {
      console.warn('[CameraDeviceService] Soft 限制失敗，降級為基本 video:', err2);
      // 第三層：基本 video: true
      return await navigator.mediaDevices.getUserMedia({ video: true });
    }
  }
};

/**
 * 釋放並關閉相機 MediaStream
 */
export const stopMediaStream = (stream: MediaStream | null): void => {
  if (!stream) return;
  try {
    stream.getTracks().forEach((track) => {
      track.stop();
    });
  } catch (err) {
    console.warn('[CameraDeviceService] 關閉媒體串流時發生警告:', err);
  }
};

