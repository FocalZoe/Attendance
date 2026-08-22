// TEAM_008: 實體相機多座位在座檢測與考勤通報彈窗 (CameraSimulatorModal.jsx)
// 升級重點：
// 1. 刪除手動通報說明輸入框，自動帶入當前課堂「幾月幾號第幾節」訊息發送至後端。
// 2. 拍照快照移除時間戳記浮水印，保留原始高畫質相片。
// 3. 圖示全面採用 Lucide-react。

import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, LayoutGrid, Settings, Calendar, Clock, GraduationCap, UserCheck, UserX } from 'lucide-react';
import { ObjectDetector, FilesetResolver } from '@mediapipe/tasks-vision';
import { getApiUrl } from '../config/api.js';
import { getSavedSeatsConfig, matchPersonsToSeats, formatFullPeriodMessage } from '../services/seatOccupancyService.js';

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

  const lastDetectionsRef = useRef([]);
  const lastDetectionTimeRef = useRef(0);
  // TEAM_008: 記錄 MediaPipe 前次傳入時間戳，維護嚴格單調遞增
  const lastDetectionTimestampRef = useRef(0);

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

  // TEAM_008: 強化相機開啟與多層次智慧降級 (exact -> soft -> generic)
  const startCamera = async (deviceId) => {
    setCameraError(null);
    stopCamera();

    try {
      let stream = null;
      try {
        const constraints = {
          video: deviceId ? { deviceId: { exact: deviceId } } : { width: { ideal: 1280 }, height: { ideal: 720 } },
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err1) {
        console.warn('[CameraSimulator TEAM_008] Exact constraint failed, trying soft deviceId:', err1);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: deviceId ? { deviceId: deviceId } : { width: { ideal: 1280 }, height: { ideal: 720 } },
          });
        } catch (err2) {
          console.warn('[CameraSimulator TEAM_008] Soft constraint failed, fallback to generic video stream:', err2);
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      }

      streamRef.current = stream;

      // 監聽軌道中斷自動恢復
      stream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          console.warn('[CameraSimulator TEAM_008] Camera stream track ended. Auto restarting...');
          setCameraActive(false);
          setTimeout(() => startCamera(selectedDeviceId), 1200);
        };
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((e) => console.warn('[CameraSimulator TEAM_008] Play error:', e));
      }

      setCameraActive(true);
      await getCameraDevices();
    } catch (err) {
      console.error('[CameraSimulator TEAM_008] Open camera error:', err);
      setCameraError('無法開啟網路攝影機，請確認相機權限或連線。');
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
              // TEAM_008: MediaPipe 要求傳入 timestamp 必須嚴格單調遞增 (Monotonic)
              const safeTimestamp = Math.max(now, lastDetectionTimestampRef.current + 1);
              lastDetectionTimestampRef.current = safeTimestamp;

              const results = personDetector.detectForVideo(video, safeTimestamp);
              const newDetections = results.detections || [];
              if (newDetections.length > 0) {
                lastDetectionsRef.current = newDetections;
                lastDetectionTimeRef.current = now;
              } else if (now - lastDetectionTimeRef.current > 400) {
                lastDetectionsRef.current = [];
              }
            } catch (e) {
              console.warn('[CameraSimulator TEAM_008] MediaPipe detectForVideo exception safe handled:', e);
            }
          }

          const detections = lastDetectionsRef.current;

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

          // 1. 取得偵測到的人員邊框 (以實際視窗 pixel 為基準)
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

          // 2. 縮放座位 ROI
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

          // 3. 計算各座號狀態
          const statuses = matchPersonsToSeats(scaledSeats, detectedPersonsInView, 0.2);
          setLiveSeatStatuses(statuses);

          // 4. 繪製座位框 (在座綠色 / 未到紅色虛線)
          statuses.forEach((st) => {
            const isOcc = st.status === 'OCCUPIED';
            const { x, y, width, height } = st.roi;

            ctx.fillStyle = isOcc ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.1)';
            ctx.fillRect(x, y, width, height);

            ctx.strokeStyle = isOcc ? '#10b981' : '#ef4444';
            ctx.lineWidth = isOcc ? 2.5 : 1.8;
            ctx.setLineDash(isOcc ? [] : [6, 4]);
            ctx.strokeRect(x, y, width, height);
            ctx.setLineDash([]);

            // 座位標籤
            const label = isOcc ? `🟢 [${st.seat_id}] 在座` : `❌ [${st.seat_id}] 未到`;
            ctx.font = 'bold 12px monospace';
            const textW = ctx.measureText(label).width;

            ctx.fillStyle = isOcc ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)';
            ctx.fillRect(x, y - 22 > 0 ? y - 22 : y + 4, textW + 12, 20);

            ctx.fillStyle = isOcc ? '#0f172a' : '#ffffff';
            ctx.fillText(label, x + 6, y - 22 > 0 ? y - 8 : y + 18);
          });

          // 5. 繪製人員邊框
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

  // 純淨相機影格擷取 (不再嵌入黑色時間浮水印)
  const capturePureWebcamFrame = () => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 僅繪製純淨原始相機視訊畫面，不燒死任何黑底文字浮水印
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', 0.92);
  };

  // 發送打卡資料至後端
  const handleSendTelemetry = async () => {
    setIsSending(true);
    try {
      const base64Data = capturePureWebcamFrame();
      if (!base64Data) {
        alert('擷取相機畫面失敗。');
        setIsSending(false);
        return;
      }

      const currentConfig = getSavedSeatsConfig();
      const currentPeriodName = currentConfig.current_period || '第 1 節';
      const formattedMessage = formatFullPeriodMessage(currentPeriodName);

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
          message: formattedMessage, // 儲存為「幾月幾號第幾節」(例如：8月21日 第 1 節)
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
  const vacantSeatsCount = liveSeatStatuses.filter((s) => s.status === 'VACANT').length;
  const totalConfiguredSeats = seatConfig.seats.length;
  const periodTitle = formatFullPeriodMessage(seatConfig.current_period);

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
        gap: '18px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
        border: '1px solid var(--glass-border)',
      }}>

        {/* 標題與操作 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <LayoutGrid size={26} color="var(--accent-primary)" />
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                模擬相機考勤點名
                <span style={{ fontSize: '0.8rem', background: 'rgba(59, 130, 246, 0.2)', color: '#38bdf8', padding: '2px 10px', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.4)' }}>
                  {periodTitle}
                </span>
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                即時比對座位區域與人員在座/未到狀態 (已設置 {totalConfiguredSeats} 個座位)
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onOpenSeatEditor && (
              <button
                onClick={onOpenSeatEditor}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-primary)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                <Settings size={14} /> 編輯座位/節次
              </button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <X size={22} />
            </button>
          </div>
        </div>

        {/* 即時在座與未到摘要條 */}
        <div style={{ display: 'flex', gap: '12px', background: 'rgba(15, 23, 42, 0.6)', padding: '10px 16px', borderRadius: '10px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>點名概況：</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <UserCheck size={16} /> 在座: {occupiedSeatsCount}
            </span>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: vacantSeatsCount > 0 ? '#ef4444' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <UserX size={16} /> 未到: {vacantSeatsCount}
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
                  background: s.status === 'OCCUPIED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.15)',
                  color: s.status === 'OCCUPIED' ? '#10b981' : '#ef4444',
                  border: `1px solid ${s.status === 'OCCUPIED' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.3)'}`,
                  fontWeight: 600,
                }}
              >
                {s.seat_id}: {s.status === 'OCCUPIED' ? '🟢 在座' : '❌ 未到'}
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
                <p>正在啟動網路相機與在座分析模組...</p>
              )}
            </div>
          )}
        </div>

        {/* 裝置選擇與通報按鈕列 (已刪除通報說明輸入框) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Camera size={16} color="var(--accent-primary)" />
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155', fontSize: '0.85rem' }}
            >
              {devices.map((d, index) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `相機 #${index + 1}`}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
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
              {isSending ? '通報中...' : `📸 記錄點名 (${periodTitle})`}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CameraSimulatorModal;
