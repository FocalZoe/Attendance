// TEAM_008: 智慧多座位在座即時儀表板 (Dashboard.jsx)
// 升級重點：
// 1. 將相機考勤點名功能直接整合至「最新點名捕捉影像」卡片中，即時串流相機畫面 + MediaPipe 人員在座分析 + 一鍵點名。
// 2. 徹底移除獨立的「模擬相機考勤點名」彈窗 (CameraSimulatorModal)，操作體驗一體化。
// 3. 通報與紀錄全面對齊「幾月幾號第幾節」，清楚標註未到/缺席名單。

import React, { useState, useEffect, useRef } from 'react';
import { Camera, Users, CheckCircle, Activity, Sparkles, Clock, LayoutGrid, Settings, AlertCircle, GraduationCap, UserCheck, UserX, Calendar, RefreshCw, Eye } from 'lucide-react';
import { ObjectDetector, FilesetResolver } from '@mediapipe/tasks-vision';
import { fetchHistoryRecords, connectWebSocket } from '../services/api';
import { getSavedSeatsConfig, formatFullPeriodMessage, matchPersonsToSeats } from '../services/seatOccupancyService';
import { getApiUrl } from '../config/api';
import SeatMapEditorModal from '../components/SeatMapEditorModal';
import ImageModal from '../components/ImageModal';

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
        console.warn('[Dashboard AI Engine] MediaPipe init warning:', err);
        return null;
      }
    })();
  }
  return detectorLoadingPromise;
};

const Dashboard = () => {
  const [records, setRecords] = useState([]);
  const [latestRecord, setLatestRecord] = useState(null);
  const [isSeatEditorOpen, setIsSeatEditorOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [seatConfig, setSeatConfig] = useState(getSavedSeatsConfig());

  // 鏡頭相關 state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [liveSeatStatuses, setLiveSeatStatuses] = useState([]);

  // 畫面檢視模式：'live' (即時鏡頭點名) | 'latest' (最新通報照片)
  const [previewTab, setPreviewTab] = useState('live');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameIdRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);
  const lastDetectionsRef = useRef([]);
  const lastDetectionTimeRef = useRef(0);

  // 取得可用相機裝置清單
  const getCameraDevices = async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices.filter((d) => d.kind === 'videoinput');
      setDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
    } catch (err) {
      console.warn('[Dashboard] Enumerate devices error:', err);
    }
  };

  // 啟動相機
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
      console.error('[Dashboard] Start camera error:', err);
      setCameraError('無法啟動相機，請確認已授權鏡頭存取。');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    lastDetectionsRef.current = [];
  };

  // 即時 AI 人員偵測與座位在座狀態計算
  useEffect(() => {
    if (!cameraActive || previewTab !== 'live') return;

    let active = true;
    let personDetector = null;

    getSharedPersonDetector().then((detector) => {
      if (active) {
        personDetector = detector;
      }
    });

    const currentSeats = getSavedSeatsConfig();
    setSeatConfig(currentSeats);

    const renderAiOverlay = () => {
      const overlay = overlayCanvasRef.current;
      const video = videoRef.current;

      if (overlay && video && video.readyState >= 2 && video.videoWidth > 0) {
        const cWidth = video.clientWidth || 640;
        const cHeight = video.clientHeight || 480;

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
            } catch (e) {}
          }

          const detections = lastDetectionsRef.current;
          const vWidth = video.videoWidth;
          const vHeight = video.videoHeight;
          const scaleX = cWidth / vWidth;
          const scaleY = cHeight / vHeight;

          // 1. 偵測到的人員邊框 (以 client 像素為基準)
          const detectedPersonsInView = detections.map((det) => {
            const { originX, originY, width, height } = det.boundingBox;
            return {
              x: originX * scaleX,
              y: originY * scaleY,
              width: width * scaleX,
              height: height * scaleY,
              confidence: det.categories[0]?.score || 0.95,
            };
          });

          // 2. 座位百分比轉為 client 像素座標
          const scaledSeats = currentSeats.seats.map((seat) => {
            const roi = seat.roi;
            const xPct = typeof roi.x_pct === 'number' ? roi.x_pct : (roi.x / 640) * 100;
            const yPct = typeof roi.y_pct === 'number' ? roi.y_pct : (roi.y / 480) * 100;
            const wPct = typeof roi.width_pct === 'number' ? roi.width_pct : ((roi.width || 100) / 640) * 100;
            const hPct = typeof roi.height_pct === 'number' ? roi.height_pct : ((roi.height || 80) / 480) * 100;

            return {
              ...seat,
              roi: {
                x: (xPct / 100) * cWidth,
                y: (yPct / 100) * cHeight,
                width: (wPct / 100) * cWidth,
                height: (hPct / 100) * cHeight,
              },
            };
          });

          // 3. 計算即時在座狀態
          const statuses = matchPersonsToSeats(scaledSeats, detectedPersonsInView, 0.2);
          setLiveSeatStatuses(statuses);

          // 4. 繪製座位標註框 (在座綠色 / 未到紅色虛線)
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

            // 標籤
            const label = isOcc ? `🟢 [${st.seat_id}] 在座` : `❌ [${st.seat_id}] 未到`;
            ctx.font = 'bold 12px monospace';
            const textW = ctx.measureText(label).width;

            ctx.fillStyle = isOcc ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)';
            ctx.fillRect(x, y - 22 > 0 ? y - 22 : y + 4, textW + 12, 20);

            ctx.fillStyle = isOcc ? '#0f172a' : '#ffffff';
            ctx.fillText(label, x + 6, y - 22 > 0 ? y - 8 : y + 18);
          });

          // 5. 繪製人員邊框 (藍色虛線)
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
  }, [cameraActive, previewTab]);

  // 載入歷史紀錄
  const loadRecords = async () => {
    const data = await fetchHistoryRecords({ limit: 20 });
    setRecords(data);
    if (data.length > 0) {
      setLatestRecord(data[0]);
    }
  };

  useEffect(() => {
    loadRecords();
    setSeatConfig(getSavedSeatsConfig());
    startCamera(selectedDeviceId);

    // 訂閱 WebSocket 即時考勤通報廣播
    const cleanupWs = connectWebSocket((event) => {
      if (event && (event.type === 'NEW_ATTENDANCE_RECORD' || event.data)) {
        const newRecord = event.data || event.record;
        if (newRecord) {
          console.log('[Dashboard] 收到即時座位考勤通知:', newRecord);
          setLatestRecord(newRecord);
          setRecords((prev) => [newRecord, ...prev.filter((r) => r.id !== newRecord.id)].slice(0, 20));
        }
      }
    });

    return () => {
      stopCamera();
      cleanupWs();
    };
  }, [selectedDeviceId]);

  // 拍照並發送點名
  const handleTriggerAttendance = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsSending(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        alert('擷取畫面失敗');
        setIsSending(false);
        return;
      }

      // 純淨相片截圖
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64Data = canvas.toDataURL('image/jpeg', 0.92);

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
          message: formattedMessage,
          file: base64Data,
          timestamp: new Date().toISOString(),
          detected_persons: detectedPersonsPayload,
          seats: currentConfig.seats,
        }),
      });

      if (response.ok) {
        await loadRecords();
      } else {
        const errorJson = await response.json().catch(() => ({}));
        alert(`點名通報失敗 (${response.status}): ${errorJson.error || '伺服器回應異常'}`);
      }
    } catch (err) {
      console.error('[Telemetry Exception]', err);
      alert('通報異常，請確認後端服務是否正常運作。');
    } finally {
      setIsSending(false);
    }
  };

  const formatFullDateTime = (dateStr) => {
    if (!dateStr) return '暫無通報';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '暫無通報';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
  };

  // 解析最新一筆紀錄的 AI 座位在座狀態
  let latestAiAnalysis = latestRecord?.ai_analysis;
  if (typeof latestAiAnalysis === 'string') {
    try {
      latestAiAnalysis = JSON.parse(latestAiAnalysis);
    } catch (e) {
      latestAiAnalysis = null;
    }
  }

  const currentTotalSeats = latestAiAnalysis?.total_seats || seatConfig.seats.length;
  const currentOccupiedCount = typeof latestAiAnalysis?.occupied_count === 'number' ? latestAiAnalysis.occupied_count : 0;
  const currentVacantCount = typeof latestAiAnalysis?.vacant_count === 'number' ? latestAiAnalysis.vacant_count : Math.max(0, currentTotalSeats - currentOccupiedCount);
  const currentAttendanceRate = latestAiAnalysis?.attendance_rate || (currentTotalSeats > 0 ? `${((currentOccupiedCount / currentTotalSeats) * 100).toFixed(1)}%` : '0.0%');

  const currentPeriodTitle = formatFullPeriodMessage(seatConfig.current_period);

  return (
    <div className="animate-fade-in">
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <header style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            課堂考勤即時儀表板 <Sparkles color="var(--accent-primary)" size={24} />
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            即時鏡頭智慧點名與缺席座號追蹤 (當前課堂：<strong style={{ color: '#38bdf8' }}>{currentPeriodTitle}</strong>)
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {/* 座位劃位設定按鈕 */}
          <button
            onClick={() => setIsSeatEditorOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)',
              color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px',
              fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)',
              transition: 'transform 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            <Settings size={18} />
            課堂與座位設置 ({seatConfig.seats.length} 席 · {seatConfig.current_period || '第 1 節'})
          </button>
        </div>
      </header>

      {/* 統計卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <div className="glass-panel stat-card" style={{ borderTop: '4px solid var(--accent-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-title">應到座位總數</div>
              <div className="stat-value">{currentTotalSeats} <span style={{ fontSize: '1rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>席</span></div>
            </div>
            <div style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', color: 'var(--accent-primary)' }}>
              <LayoutGrid size={24} />
            </div>
          </div>
        </div>

        <div className="glass-panel stat-card" style={{ borderTop: '4px solid var(--success)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-title">實到在座率</div>
              <div className="stat-value" style={{ color: currentOccupiedCount > 0 ? 'var(--success)' : 'var(--text-secondary)' }}>
                {currentAttendanceRate}
                <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-secondary)', marginLeft: '8px' }}>
                  ({currentOccupiedCount}/{currentTotalSeats} 席)
                </span>
              </div>
            </div>
            <div style={{ padding: '12px', background: 'var(--success-bg)', borderRadius: '12px', color: 'var(--success)' }}>
              <UserCheck size={24} />
            </div>
          </div>
        </div>

        <div className="glass-panel stat-card" style={{ borderTop: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-title">未到/缺席人數</div>
              <div className="stat-value" style={{ color: currentVacantCount > 0 ? '#ef4444' : 'var(--text-secondary)' }}>
                {currentVacantCount} <span style={{ fontSize: '1rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>席</span>
              </div>
            </div>
            <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px', color: '#ef4444' }}>
              <UserX size={24} />
            </div>
          </div>
        </div>

        <div className="glass-panel stat-card" style={{ borderTop: '4px solid #8b5cf6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-title">最後點名時間</div>
              <div className="stat-value" style={{ fontSize: '1.05rem', color: '#8b5cf6', fontWeight: 700, whiteSpace: 'nowrap', marginTop: '6px' }}>
                {formatFullDateTime(latestRecord?.create_at)}
              </div>
            </div>
            <div style={{ padding: '12px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '12px', color: '#8b5cf6' }}>
              <Clock size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* 主體區塊：即時相機點名捕捉影像 (左側) 與 即時通報紀錄 (右側) */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '24px', minHeight: '540px' }}>
        {/* 最新點名捕捉影像卡片 (內建相機與即時點名功能) */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          {/* 卡片標題與即時模式切換 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Camera size={22} color="var(--accent-primary)" />
              <h2 style={{ fontSize: '1.2rem', margin: 0 }}>最新點名捕捉影像</h2>
            </div>

            {/* 即時鏡頭 / 最後通報 切換 Tab */}
            <div style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '8px' }}>
              <button
                onClick={() => setPreviewTab('live')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: previewTab === 'live' ? 'var(--accent-primary)' : 'transparent',
                  color: previewTab === 'live' ? '#fff' : 'var(--text-secondary)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: cameraActive ? '#10b981' : '#ef4444' }} />
                即時鏡頭 (Live)
              </button>

              <button
                onClick={() => setPreviewTab('latest')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: previewTab === 'latest' ? 'var(--accent-primary)' : 'transparent',
                  color: previewTab === 'latest' ? '#fff' : 'var(--text-secondary)',
                  border: 'none',
                }}
              >
                最後通報相片
              </button>
            </div>
          </div>

          {/* 視訊畫面 / 照片顯示區 */}
          <div
            style={{
              flex: 1,
              position: 'relative',
              borderRadius: '12px',
              overflow: 'hidden',
              background: '#090d16',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '340px',
            }}
          >
            {previewTab === 'live' ? (
              <>
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
                    <Camera size={44} style={{ opacity: 0.35, marginBottom: '8px' }} />
                    <p>{cameraError || '正在連線網路相機與在座分析模組...'}</p>
                  </div>
                )}
              </>
            ) : (
              // 檢視最後通報相片
              latestRecord ? (
                <div key={latestRecord.id} className="animate-fade-in" style={{ textAlign: 'center', padding: '16px' }}>
                  <div style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }} onClick={() => setSelectedRecord(latestRecord)}>
                    <img
                      src={latestRecord.file_url}
                      alt={latestRecord.message}
                      style={{ maxWidth: '340px', maxHeight: '240px', borderRadius: '14px', border: '2.5px solid var(--success)', objectFit: 'cover', background: 'rgba(255,255,255,0.05)' }}
                    />
                    <div style={{ position: 'absolute', top: '-8px', left: '-8px', width: '24px', height: '24px', borderTop: '3.5px solid var(--success)', borderLeft: '3.5px solid var(--success)', borderRadius: '6px 0 0 0' }} />
                    <div style={{ position: 'absolute', bottom: '-8px', right: '-8px', width: '24px', height: '24px', borderBottom: '3.5px solid var(--success)', borderRight: '3.5px solid var(--success)', borderRadius: '0 0 6px 0' }} />
                  </div>
                  <div style={{ marginTop: '12px' }}>
                    <h4 style={{ fontSize: '1.1rem', color: 'var(--accent-primary)', margin: '0 0 4px 0' }}>{latestRecord.message}</h4>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{formatFullDateTime(latestRecord.create_at)}</span>
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
                  <p>尚未有任何通報紀錄</p>
                </div>
              )
            )}
          </div>

          {/* 底部控制器：相機切換 + 📸 即時點名記錄按鈕 */}
          <div style={{ marginTop: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Camera size={16} color="var(--accent-primary)" />
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                style={{ padding: '7px 12px', borderRadius: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155', fontSize: '0.82rem' }}
              >
                {devices.map((d, index) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `鏡頭 #${index + 1}`}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              {latestRecord && (
                <button
                  onClick={() => setSelectedRecord(latestRecord)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)',
                    color: 'white', borderRadius: '8px', fontSize: '0.85rem', cursor: 'pointer',
                  }}
                >
                  <Eye size={15} /> 觀看大圖
                </button>
              )}

              <button
                onClick={handleTriggerAttendance}
                disabled={isSending || !cameraActive}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '9px 20px', borderRadius: '8px',
                  background: 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)',
                  color: '#fff', fontWeight: 600, fontSize: '0.88rem',
                  border: 'none', cursor: isSending || !cameraActive ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)',
                  transition: 'transform 0.2s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                <Camera size={16} />
                {isSending ? '通報點名中...' : `📸 立即記錄點名 (${currentPeriodTitle})`}
              </button>
            </div>
          </div>
        </div>

        {/* 即時動態通報紀錄簿 (右側) */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <Activity size={22} color="var(--accent-primary)" />
            <h2 style={{ fontSize: '1.2rem' }}>即時通報紀錄簿</h2>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '440px' }}>
            {records.map((rec) => {
              let recAi = rec.ai_analysis;
              if (typeof recAi === 'string') {
                try {
                  recAi = JSON.parse(recAi);
                } catch (e) {}
              }

              const recStatuses = Array.isArray(recAi?.seat_statuses) ? recAi.seat_statuses : [];
              const recVacantSeats = recStatuses.filter((s) => s.status === 'VACANT').map((s) => s.seat_id);
              const recRate = recAi?.attendance_rate || '0.0%';

              return (
                <div
                  key={rec.id}
                  className="animate-fade-in"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 16px', background: 'rgba(255,255,255,0.03)',
                    borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer', transition: 'background 0.2s',
                  }}
                  onClick={() => setSelectedRecord(rec)}
                  onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                  onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                >
                  <img
                    src={rec.file_url}
                    alt={rec.message}
                    style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover', background: '#000' }}
                  />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <GraduationCap size={16} />
                      {rec.message}
                    </div>

                    {/* 缺席座號提示 */}
                    <div style={{ fontSize: '0.78rem', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {recVacantSeats.length > 0 ? (
                        <span style={{ color: '#ef4444', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <UserX size={13} /> 未到: {recVacantSeats.join(', ')} ({recVacantSeats.length} 席)
                        </span>
                      ) : (
                        <span style={{ color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <UserCheck size={13} /> 全員在座
                        </span>
                      )}
                      <span style={{ color: 'var(--text-secondary)' }}>· 在座率 {recRate}</span>
                    </div>

                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {new Date(rec.create_at).toLocaleTimeString('zh-TW', { hour12: false })}
                    </div>
                  </div>

                  <div style={{ color: recVacantSeats.length > 0 ? '#ef4444' : 'var(--success)' }}>
                    {recVacantSeats.length > 0 ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
                  </div>
                </div>
              );
            })}

            {records.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 0' }}>
                尚無通報紀錄
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 座位劃位設定 Modal */}
      <SeatMapEditorModal
        isOpen={isSeatEditorOpen}
        onClose={() => setIsSeatEditorOpen(false)}
        onSaveSuccess={(newConfig) => {
          setSeatConfig(newConfig);
        }}
      />

      {/* 圖片大圖檢視 Modal */}
      <ImageModal
        record={selectedRecord}
        imageUrl={typeof selectedRecord === 'string' ? selectedRecord : selectedRecord?.file_url}
        onClose={() => setSelectedRecord(null)}
      />
    </div>
  );
};

export default Dashboard;
