// TEAM_008: 實體相機多座位在座檢測與考勤通報彈窗 (CameraSimulatorModal.jsx)
// 核心升級：
// 1. 徹底去除人臉辨識，採用 MediaPipe ObjectDetector (Person 人體類別) 或在座人員追蹤，保護個資隱私。
// 2. 實時疊加視覺化座位區域 (Seat ROIs) 與在位狀態 (🟢 OCCUPIED / ⚪ VACANT)。
// 3. 拍照時將原始影像、真實人員座標與座位配置打包發送至後端 /api/telemetry。

import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Send, VideoOff, CheckCircle2, AlertCircle, LayoutGrid, Users, Sparkles, Settings } from 'lucide-react';
import { ObjectDetector, FilesetResolver } from '@mediapipe/tasks-vision';
import { getApiUrl } from '../config/api.js';
import { getSavedSeatsConfig, matchPersonsToSeats } from '../services/seatOccupancyService.js';

let detectorInstance = null;
let detectorLoadingPromise = null;

const getSharedPersonDetector = async () => {
  if (detectorInstance) return detectorInstance;
  if (!detectorLoadingPromise) {
    detectorLoadingPromise = (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
        );
        const detector = await ObjectDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          scoreThreshold: 0.35,
          categoryAllowlist: ['person'],
        });
        detectorInstance = detector;
        return detector;
      } catch (err) {
        console.warn('[TEAM_008 AI Engine] MediaPipe ObjectDetector init warning:', err);
        return null;
      }
    })();
  }
  return detectorLoadingPromise;
};

export const CameraSimulatorModal = ({ isOpen, onClose, onSuccess, onOpenSeatEditor }) => {
  const [message, setMessage] = useState('教室 301 座位點名通報');
  const [isSending, setIsSending] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [isAiLoaded, setIsAiLoaded] = useState(false);
  const [seatConfig, setSeatConfig] = useState(getSavedSeatsConfig());
  const [liveSeatStatuses, setLiveSeatStatuses] = useState([]);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameIdRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);

  // 快取人員偵測結果避免影格微小間隙閃爍
  const lastDetectionsRef = useRef([]);
  const lastDetectionTimeRef = useRef(0);

  const getCameraDevices = async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices.filter((device) => device.kind === 'videoinput');
      setDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
    } catch (err) {
      console.warn('[CameraSimulator] Enumerate devices error:', err);
    }
  };

  const startCamera = async (deviceId) => {
    setCameraError(null);
    stopCamera();

    try {
      const constraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : { width: { ideal: 1280 }, height: { ideal: 720 } },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      setCameraActive(true);
      await getCameraDevices();
    } catch (err) {
      console.error('[CameraSimulator] Open camera error:', err);
      setCameraError('無法開啟網路攝像機，請確認已授權相機存取權限。');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    lastDetectionsRef.current = [];
  };

  // 即時 AI 人體與多座位重疊疊加渲染
  useEffect(() => {
    if (!cameraActive) return;

    let active = true;
    let personDetector = null;

    getSharedPersonDetector().then((detector) => {
      if (active) {
        personDetector = detector;
        setIsAiLoaded(true);
      }
    });

    const currentSeats = getSavedSeatsConfig();
    setSeatConfig(currentSeats);

    const renderAiOverlay = () => {
      const overlay = overlayCanvasRef.current;
      const video = videoRef.current;

      if (overlay && video && video.readyState >= 2 && video.videoWidth > 0) {
        const cWidth = video.clientWidth || 640;
        const cHeight = video.clientHeight || 360;

        if (overlay.width !== cWidth || overlay.height !== cHeight) {
          overlay.width = cWidth;
          overlay.height = cHeight;
        }

        const ctx = overlay.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, overlay.width, overlay.height);

          const now = performance.now();
          if (personDetector && video.currentTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = video.currentTime;
            try {
              const results = personDetector.detectForVideo(video, now);
              const newDetections = results.detections || [];
              if (newDetections.length > 0) {
                lastDetectionsRef.current = newDetections;
                lastDetectionTimeRef.current = now;
              } else if (now - lastDetectionTimeRef.current > 400) {
                lastDetectionsRef.current = [];
              }
            } catch (e) {
              // 容錯
            }
          }

          const detections = lastDetectionsRef.current;

          // 計算映射比例 (object-fit: cover)
          const vWidth = video.videoWidth;
          const vHeight = video.videoHeight;
          const videoAspect = vWidth / vHeight;
          const containerAspect = cWidth / cHeight;

          let renderW, renderH, offsetX, offsetY;
          if (containerAspect > videoAspect) {
            renderW = cWidth;
            renderH = cWidth / videoAspect;
            offsetX = 0;
            offsetY = (cHeight - renderH) / 2;
          } else {
            renderH = cHeight;
            renderW = cHeight * videoAspect;
            offsetX = (cWidth - renderW) / 2;
            offsetY = 0;
          }

          const scale = renderW / vWidth;

          // 1. 取得偵測到的人體邊框 (以容器實際 pixel 為基準)
          const detectedPersonsInView = detections.map((det) => {
            const { originX, originY, width, height } = det.boundingBox;
            const score = det.categories[0]?.score || 0.95;
            return {
              x: offsetX + originX * scale,
              y: offsetY + originY * scale,
              width: width * scale,
              height: height * scale,
              confidence: score,
            };
          });

          // 2. 將配置的座位 ROI (基準 640x360) 縮放至當前容器大小
          const scaleBaseX = cWidth / (currentSeats.base_width || 640);
          const scaleBaseY = cHeight / (currentSeats.base_height || 360);

          const scaledSeats = currentSeats.seats.map((seat) => ({
            ...seat,
            roi: {
              x: seat.roi.x * scaleBaseX,
              y: seat.roi.y * scaleBaseY,
              width: seat.roi.width * scaleBaseX,
              height: seat.roi.height * scaleBaseY,
            },
          }));

          // 3. 計算各座號在座狀態
          const statuses = matchPersonsToSeats(scaledSeats, detectedPersonsInView, 0.2);
          setLiveSeatStatuses(statuses);

          // 4. 繪製座位區域框 (Seat ROIs)
          statuses.forEach((st) => {
            const isOcc = st.status === 'OCCUPIED';
            const { x, y, width, height } = st.roi;

            // 座位框背景與邊線
            ctx.fillStyle = isOcc ? 'rgba(16, 185, 129, 0.18)' : 'rgba(148, 163, 184, 0.08)';
            ctx.fillRect(x, y, width, height);

            ctx.strokeStyle = isOcc ? '#10b981' : 'rgba(148, 163, 184, 0.5)';
            ctx.lineWidth = isOcc ? 2.5 : 1.5;
            ctx.setLineDash(isOcc ? [] : [6, 4]);
            ctx.strokeRect(x, y, width, height);
            ctx.setLineDash([]);

            // 座位標籤 (座號 + 狀態)
            const label = isOcc ? `🟢 [${st.seat_id}] 在座` : `⚪ [${st.seat_id}] 空位`;
            ctx.font = 'bold 12px monospace';
            const textW = ctx.measureText(label).width;

            ctx.fillStyle = isOcc ? 'rgba(16, 185, 129, 0.95)' : 'rgba(30, 41, 59, 0.85)';
            ctx.fillRect(x, y - 22 > 0 ? y - 22 : y + 4, textW + 12, 20);

            ctx.fillStyle = isOcc ? '#0f172a' : '#94a3b8';
            ctx.fillText(label, x + 6, y - 22 > 0 ? y - 8 : y + 18);
          });

          // 5. 繪製偵測到的人員邊框 (科技感淡藍色框)
          detectedPersonsInView.forEach((p) => {
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(p.x, p.y, p.width, p.height);
            ctx.setLineDash([]);
          });
        }
      }

      if (active) {
        animFrameIdRef.current = requestAnimationFrame(renderAiOverlay);
      }
    };

    renderAiOverlay();

    return () => {
      active = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [cameraActive]);

  useEffect(() => {
    if (isOpen) {
      setSeatConfig(getSavedSeatsConfig());
      startCamera(selectedDeviceId);
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, selectedDeviceId]);

  if (!isOpen) return null;

  // 擷取相機影格
  const captureWebcamFrame = () => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 加上隱私考勤浮水印
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(10, canvas.height - 42, 480, 32);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`CAM-01 | ${new Date().toLocaleString('zh-TW')} | Privacy-Safe Seat Occupancy`, 20, canvas.height - 20);

    return canvas.toDataURL('image/jpeg', 0.88);
  };

  // 發送打卡資料至後端
  const handleSendTelemetry = async () => {
    setIsSending(true);
    try {
      const base64Data = captureWebcamFrame();
      if (!base64Data) {
        alert('擷取相機畫面失敗。');
        setIsSending(false);
        return;
      }

      // 整理人員邊框與座位配置
      const currentConfig = getSavedSeatsConfig();
      const detectedPersonsPayload = (lastDetectionsRef.current || []).map((det) => ({
        x: Math.round(det.boundingBox.originX),
        y: Math.round(det.boundingBox.originY),
        width: Math.round(det.boundingBox.width),
        height: Math.round(det.boundingBox.height),
        confidence: det.categories[0]?.score || 0.95,
      }));

      const targetApiUrl = getApiUrl('/api/telemetry');

      const response = await fetch(targetApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message,
          file: base64Data,
          timestamp: new Date().toISOString(),
          detected_persons: detectedPersonsPayload,
          seats: currentConfig.seats,
        }),
      });

      if (response.ok) {
        if (onSuccess) onSuccess();
        if (onClose) onClose();
      } else {
        const errorJson = await response.json().catch(() => ({}));
        alert(`通報失敗 (${response.status}): ${errorJson.error || errorJson.details || '伺服器回應異常'}`);
      }
    } catch (err) {
      console.error('[Telemetry Exception]', err);
      alert(`發送時發生異常，請確認端點能否連線 (${getApiUrl('/api/telemetry')})`);
    } finally {
      setIsSending(false);
    }
  };

  const occupiedSeatsCount = liveSeatStatuses.filter((s) => s.status === 'OCCUPIED').length;
  const totalConfiguredSeats = seatConfig.seats.length;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
    }}>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div style={{
        width: '100%',
        maxWidth: '720px',
        padding: '24px',
        background: '#1e293b',
        borderRadius: '16px',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
        border: '1px solid var(--glass-border)',
      }}>

        {/* 標題與操作 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <LayoutGrid size={26} color="var(--accent-primary)" />
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                模擬廣角相機 (多座位在座檢測)
                {isAiLoaded && (
                  <span style={{ fontSize: '0.75rem', background: '#0284c7', color: '#e0f2fe', padding: '2px 8px', borderRadius: '12px' }}>
                    隱私安全模式
                  </span>
                )}
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                即時比對座位區域與人員佔用狀態 (已設置 {totalConfiguredSeats} 個座位)
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onOpenSeatEditor && (
              <button
                onClick={onOpenSeatEditor}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-primary)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                <Settings size={14} /> 編輯座位地圖
              </button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <X size={22} />
            </button>
          </div>
        </div>

        {/* 即時即位摘要條 */}
        <div style={{ display: 'flex', gap: '12px', background: 'rgba(15, 23, 42, 0.6)', padding: '10px 16px', borderRadius: '10px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>即時在座統計：</span>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: occupiedSeatsCount > 0 ? '#10b981' : '#94a3b8' }}>
              {occupiedSeatsCount} / {totalConfiguredSeats} 席在座 ({totalConfiguredSeats > 0 ? ((occupiedSeatsCount / totalConfiguredSeats) * 100).toFixed(0) : 0}%)
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {liveSeatStatuses.map((s) => (
              <span
                key={s.seat_id}
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: s.status === 'OCCUPIED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.15)',
                  color: s.status === 'OCCUPIED' ? '#10b981' : '#94a3b8',
                  border: `1px solid ${s.status === 'OCCUPIED' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(148, 163, 184, 0.2)'}`,
                  fontWeight: 600,
                }}
              >
                {s.seat_id}: {s.status === 'OCCUPIED' ? '🟢 有人' : '⚪ 空位'}
              </span>
            ))}
          </div>
        </div>

        {/* 相機畫面容器 */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: '360px',
          borderRadius: '12px',
          overflow: 'hidden',
          background: '#090d16',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: cameraActive ? 'block' : 'none' }}
          />

          {cameraActive && (
            <canvas
              ref={overlayCanvasRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 2,
              }}
            />
          )}

          {!cameraActive && (
            <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
              {cameraError ? (
                <p style={{ color: '#ef4444' }}>{cameraError}</p>
              ) : (
                <p>正在啟動網路相機與隱私安全在座分析模組...</p>
              )}
            </div>
          )}
        </div>

        {/* 裝置與訊息輸入 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>選擇相機鏡頭</label>
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155' }}
            >
              {devices.map((d, index) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `相機 #${index + 1}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>通報說明 (Message)</label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155' }}
            />
          </div>
        </div>

        {/* 送出與操作按鈕 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: '8px', background: '#334155', color: '#fff', border: 'none', cursor: 'pointer' }}>
            取消
          </button>
          <button
            onClick={handleSendTelemetry}
            disabled={isSending || !cameraActive}
            style={{
              padding: '10px 22px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)',
              color: '#fff',
              fontWeight: 'bold',
              border: 'none',
              cursor: isSending || !cameraActive ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)',
              transition: 'transform 0.2s',
            }}
          >
            {isSending ? '通報分析中...' : `📸 拍照並記錄在座點名 (${occupiedSeatsCount}/${totalConfiguredSeats} 席在座)`}
          </button>
        </div>

      </div>
    </div>
  );
};

export default CameraSimulatorModal;
