// ==============================================================================
// 班級自動化點名系統 - 裝置偵測與相機來源管理服務 (cameraDeviceService.js)
// 支援判斷電腦端 (Desktop) 與手機端 (Mobile)，嚴格枚舉真實硬體視訊裝置 (OBS/Webcam)
// 嚴禁假資料：徹底移除任何虛擬假相機與 Canvas 模擬串流
// ==============================================================================

/**
 * 智慧偵測當前終端設備是否為行動裝置 (手機或平板)
 * @returns {boolean} true: 手機/平板端, false: 電腦 PC/Mac
 */
export const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;

  // 1. 現代瀏覽器 userAgentData
  if (navigator.userAgentData?.mobile) {
    return true;
  }

  // 2. 傳統 User-Agent 關鍵字比對
  const ua = navigator.userAgent || navigator.vendor || window.opera || '';
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
 * 取得電腦端可用之真實相機來源清單 (100% 來自真實硬體設備，如 OBS Virtual Camera、Webcam)
 * @returns {Promise<Array<{ id: string, name: string, deviceId: string }>>}
 */
export const getDesktopCameraSources = async () => {
  const sources = [];

  try {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices.filter((d) => d.kind === 'videoinput');

      videoInputs.forEach((d, index) => {
        const rawLabel = d.label || '';
        const displayName = rawLabel ? `🎥 ${rawLabel}` : `🎥 視訊相機 #${index + 1}`;
        sources.push({
          id: d.deviceId,
          name: displayName,
          deviceId: d.deviceId,
        });
      });
    }
  } catch (err) {
    console.warn('[CameraDeviceService] 枚舉鏡頭裝置失敗:', err);
  }

  // 若系統尚未授權或無標籤，提供預設選項供調用 getUserMedia
  if (sources.length === 0) {
    sources.push({
      id: 'default_webcam',
      name: '🎥 預設視訊鏡頭 (Default Camera)',
      deviceId: '',
    });
  }

  return sources;
};

/**
 * 啟動相機串流 (100% 真實硬體攝影鏡頭，具備三層解析度降級容錯引擎)
 * @param {string} sourceId - 裝置 ID 或 'default_webcam'
 * @returns {Promise<MediaStream>}
 */
export const acquireCameraStream = async (sourceId) => {
  const isDefault = !sourceId || sourceId === 'default_webcam';

  // 第一層：exact deviceId (優先嘗試 1080p 高畫質)
  try {
    const constraints = {
      video: isDefault
        ? { width: { ideal: 1920 }, height: { ideal: 1080 } }
        : { deviceId: { exact: sourceId }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    };
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err1) {
    console.warn('[CameraDeviceService] 1080p exact constraint 失敗，降級至 720p soft constraint:', err1);
    
    // 第二層：soft deviceId (降級至 720p 寬容解析度)
    try {
      const fallbackConstraints = {
        video: isDefault
          ? { width: { ideal: 1280 }, height: { ideal: 720 } }
          : { deviceId: sourceId, width: { ideal: 1280 }, height: { ideal: 720 } },
      };
      return await navigator.mediaDevices.getUserMedia(fallbackConstraints);
    } catch (err2) {
      console.warn('[CameraDeviceService] 720p soft constraint 失敗，降級至標準通用視訊:', err2);
      
      // 第三層：generic video: true (瀏覽器底層預設視訊)
      return await navigator.mediaDevices.getUserMedia({ video: true });
    }
  }
};
