// TEAM_008: 智慧多座位在座即時儀表板 (Dashboard.jsx)
// 升級重點：
// 1. 最新點名捕捉影像容器高度固定一致 (height: 440px)，切換 Tab 零跳動。
// 2. 即時鏡頭等比例縮放相機畫面與劃位資訊，無相機時禁用點名按鈕。
// 3. 最後通報相片中間顯示訊息與未到人數（不顯示時間），左下角清楚呈現「最後紀錄：時間」。

import React, { useState, useEffect, useRef } from 'react';
import { Camera, CheckCircle, Activity, Sparkles, Clock, LayoutGrid, Settings, AlertCircle, GraduationCap, UserCheck, UserX, RefreshCw, Eye, AlertTriangle, Timer, Smartphone, Bell } from 'lucide-react';
import { ObjectDetector, FilesetResolver } from '@mediapipe/tasks-vision';
import { fetchHistoryRecords, sendTelemetry, connectWebSocket } from '../services/api';
import { getSavedSeatsConfig, formatFullPeriodMessage, matchPersonsToSeats, SeatTemporalTracker } from '../services/seatOccupancyService';
import { getSavedSchedulesConfig, checkScheduleTrigger, getNextUpcomingSchedule } from '../services/scheduleService';
import { isMobileDevice, getDesktopCameraSources, acquireCameraStream } from '../services/cameraDeviceService';
import SeatMapEditorModal from '../components/SeatMapEditorModal';
import ScheduleModal from '../components/ScheduleModal';
import ImageModal from '../components/ImageModal';
import ErrorBoundary from '../components/ErrorBoundary';

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
          scoreThreshold: 0.10,
          maxResults: 50,
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
  // 智慧偵測當前終端是否為行動裝置
  const [isMobile] = useState(isMobileDevice());

  const [records, setRecords] = useState([]);
  const [latestRecord, setLatestRecord] = useState(null);
  const [isSeatEditorOpen, setIsSeatEditorOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleConfig, setScheduleConfig] = useState(getSavedSchedulesConfig());
  const [autoRollcallToast, setAutoRollcallToast] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [seatConfig, setSeatConfig] = useState(getSavedSeatsConfig());

  // 排程執行防重複觸發 Ref
  const lastTriggeredKeyRef = useRef(null);
  const isAutoSendingRef = useRef(false);

  // 鏡頭相關 state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [isSending, setIsSending] = useState(false);

  // 畫面檢視模式：手機端固定為 'latest' (最後通報相片)，電腦端預設為 'live' (即時鏡頭)
  const [previewTab, setPreviewTab] = useState(() => (isMobileDevice() ? 'latest' : 'live'));

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
  // 跨幀時間序列遲滯防抖追蹤器 (預設 800ms 平滑緩衝，根除畫面跳爍與瞬態漏檢)
  const seatTrackerRef = useRef(new SeatTemporalTracker({ holdOffMs: 800 }));
  const latestSmoothedStatusesRef = useRef([]);

  // 取得電腦端可用之相機裝置清單 (Webcam + Ameba 網路相機)
  const getCameraDevices = async () => {
    if (isMobile) return;
    try {
      const sources = await getDesktopCameraSources();
      setDevices(sources);
      if (sources.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(sources[0].id);
      }
    } catch (err) {
      console.warn('[Dashboard] Enumerate devices error:', err);
    }
  };

  // 啟動相機 (僅電腦端執行，支援 Webcam 與 Ameba 網路相機分流)
  const startCamera = async (deviceId) => {
    if (isMobile) return;
    setCameraError(null);
    stopCamera();

    try {
      const stream = await acquireCameraStream(deviceId);
      streamRef.current = stream;
      setCameraStream(stream);

      // 綁定視訊軌道事件（中斷自動重連）
      stream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          console.warn('[Dashboard] Camera stream track ended. Auto restart...');
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
        videoRef.current.play().catch((e) => console.warn('[Dashboard] Video play warning:', e));
      }

      setCameraActive(true);
      await getCameraDevices();
    } catch (err) {
      console.error('[Dashboard] Start camera error:', err);
      setCameraError('尚未啟動相機鏡頭（相機被佔用或權限未開啟）');
      setCameraActive(false);
      setCameraStream(null);
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
    setCameraStream(null);
    setCameraActive(false);
    lastDetectionsRef.current = [];
    if (seatTrackerRef.current) {
      seatTrackerRef.current.reset();
    }
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
              console.warn('[Dashboard TEAM_008] MediaPipe detectForVideo exception safe handled:', e);
            }
          }

          const detections = lastDetectionsRef.current;
          const vWidth = video.videoWidth;
          const vHeight = video.videoHeight;
          const scaleX = cWidth / vWidth;
          const scaleY = cHeight / vHeight;

          // 1. 偵測到的人員邊框 (以 client 像素為基準，實施透視分層自適應門檻與形態防偽)
          const detectedPersonsInView = detections
            .filter((det) => {
              const { originY, width, height } = det.boundingBox;
              const score = det.categories[0]?.score || 0;
              const yNorm = originY / (vHeight || 1);
              const aspectRatio = height / (width || 1);

              // 透視分層自適應動態門檻與坐姿形態防偽：
              // 遠景區域 (yNorm <= 0.50，第 1、2 排)：
              // 遠景學生下半身受課桌完全遮擋，且雙肘伏案大開寫字 (如 5 號座) 時長寬比約 0.42~0.55；
              // 故遠景門檻設為 0.10，形態過濾設為 aspectRatio >= 0.40，確保伏案背影學生 100% 召回。
              // 近景區域 (yNorm > 0.50，第 3、4 排)：
              // 近景坐姿特徵清晰，維持標準嚴格門檻 0.22，形態嚴格要求 aspectRatio >= 0.60，徹底杜絕椅背外套與桌上書包雜物假陽性。
              if (yNorm <= 0.50) {
                return score >= 0.10 && aspectRatio >= 0.40;
              } else {
                return score >= 0.22 && aspectRatio >= 0.60;
              }
            })
            .map((det) => {
              const { originX, originY, width, height } = det.boundingBox;
              return {
                x: originX * scaleX,
                y: originY * scaleY,
                width: width * scaleX,
                height: height * scaleY,
                confidence: det.categories[0]?.score || 0.95,
              };
            });

          // 2. 座位百分比轉為 client 像素座標 (等比例精準映射)
          const freshConfig = getSavedSeatsConfig();
          const scaledSeats = freshConfig.seats.map((seat) => {
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

          // 3. 計算即時在座狀態 (含跨幀遲滯防抖平滑)
          const rawStatuses = matchPersonsToSeats(scaledSeats, detectedPersonsInView);
          const statuses = seatTrackerRef.current.update(rawStatuses, now);
          latestSmoothedStatusesRef.current = statuses;

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

  // TEAM_008: 自動檢查並確保 Video srcObject 串流持續綁定與分頁喚醒重播放
  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        console.log('[Dashboard TEAM_008] Re-attaching streamRef to videoRef.current');
        videoRef.current.srcObject = streamRef.current;
      }
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [cameraActive, previewTab]);

  // TEAM_008: 分頁恢復焦點與背景喚醒自動恢復畫面播放
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && cameraActive && streamRef.current) {
        console.log('[Dashboard TEAM_008] Tab reactivated, ensuring camera playback...');
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
  }, [cameraActive]);

  useEffect(() => {
    loadRecords();
    setSeatConfig(getSavedSeatsConfig());
    if (!isMobile) {
      startCamera(selectedDeviceId);
    }

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
  }, [selectedDeviceId, isMobile]);

  // 定時自動點名排程常駐監聽心跳 (每秒檢查一次)
  useEffect(() => {
    const checkTimer = setInterval(() => {
      const triggerResult = checkScheduleTrigger(scheduleConfig, lastTriggeredKeyRef.current);
      if (triggerResult && triggerResult.shouldTrigger) {
        lastTriggeredKeyRef.current = triggerResult.triggerKey;
        console.log(`⏰ [Dashboard] 命中定時自動點名排程: ${triggerResult.schedule.time} (${triggerResult.schedule.period})`);
        executeRollcall(triggerResult.schedule.period, true);
      }
    }, 1000);

    return () => clearInterval(checkTimer);
  }, [scheduleConfig, cameraActive]);

  // 拍照並發送點名 (支援手動點名與定時自動點名)
  const executeRollcall = async (targetPeriodName = null, isAuto = false) => {
    if (!videoRef.current || !canvasRef.current || !cameraActive) {
      if (isAuto) {
        console.warn('[Dashboard AutoSchedule] 定時點名時間已到，但相機尚未啟動或處於關閉狀態。');
      }
      return;
    }
    if (isSending || isAutoSendingRef.current) return;

    setIsSending(true);
    if (isAuto) isAutoSendingRef.current = true;

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        if (!isAuto) alert('擷取畫面失敗');
        return;
      }

      // 純淨相片截圖 (完全依相機真實尺寸)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64Data = canvas.toDataURL('image/jpeg', 0.92);

      const currentConfig = getSavedSeatsConfig();
      const currentPeriodName = targetPeriodName || currentConfig.current_period || '第 1 節';
      const formattedMessage = formatFullPeriodMessage(currentPeriodName);

      const vHeight = video.videoHeight || 480;
      const detectedPersonsPayload = (lastDetectionsRef.current || [])
        .filter((det) => {
          const { originY, width, height } = det.boundingBox;
          const score = det.categories[0]?.score || 0;
          const yNorm = originY / (vHeight || 1);
          const aspectRatio = height / (width || 1);

          // 透視分層自適應動態門檻與坐姿形態防偽
          if (yNorm <= 0.50) {
            return score >= 0.10 && aspectRatio >= 0.40;
          } else {
            return score >= 0.22 && aspectRatio >= 0.60;
          }
        })
        .map((det) => ({
          x: Math.round(det.boundingBox.originX),
          y: Math.round(det.boundingBox.originY),
          width: Math.round(det.boundingBox.width),
          height: Math.round(det.boundingBox.height),
          confidence: det.categories[0]?.score || 0.95,
        }));

      // 使用統一 API 模組發送當下劃位
      const result = await sendTelemetry({
        message: formattedMessage,
        file: base64Data,
        timestamp: new Date().toISOString(),
        detected_persons: detectedPersonsPayload,
        seats: currentConfig.seats,
      });

      console.log(`[Dashboard ${isAuto ? 'Auto-Schedule' : 'Manual'}] 點名通報成功，Database 回傳紀錄:`, result);

      if (result && result.record) {
        setLatestRecord(result.record);
        setRecords((prev) => [result.record, ...prev.filter((r) => r.id !== result.record.id)].slice(0, 20));
      } else {
        await loadRecords();
      }

      if (isAuto) {
        const nowTimeStr = new Date().toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' });
        setAutoRollcallToast({
          period: currentPeriodName,
          time: nowTimeStr,
        });
        setTimeout(() => setAutoRollcallToast(null), 6000);
      }
    } catch (err) {
      console.error('[Telemetry Exception]', err);
      if (!isAuto) {
        alert(`通報異常: ${err?.message || '請確認伺服器連線狀態'}`);
      }
    } finally {
      setIsSending(false);
      if (isAuto) isAutoSendingRef.current = false;
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

  // 解析最新通報記錄的未到座號
  const latestStatuses = Array.isArray(latestAiAnalysis?.seat_statuses) ? latestAiAnalysis.seat_statuses : [];
  const latestVacantSeatIds = latestStatuses.filter((s) => s.status === 'VACANT').map((s) => s.seat_id);

  const currentPeriodTitle = formatFullPeriodMessage(seatConfig.current_period);
  const nextUpcoming = getNextUpcomingSchedule(scheduleConfig);

  return (
    <div className="animate-fade-in">
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* 自動點名成功即時通知 Banner */}
      {autoRollcallToast && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(5, 150, 105, 0.95))',
            color: '#fff',
            padding: '14px 20px',
            borderRadius: '12px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
            animation: 'fadeIn 0.3s ease-out',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
            <Bell size={20} />
            <span>⏰ [{autoRollcallToast.time}] <strong>{autoRollcallToast.period}</strong> 定時自動點名通報已成功執行並儲存！</span>
          </div>
          <button
            onClick={() => setAutoRollcallToast(null)}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.8, fontSize: '1rem' }}
          >
            ✕
          </button>
        </div>
      )}

      <header className="page-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            課堂考勤即時儀表板 <Sparkles color="var(--accent-primary)" size={24} />
          </h1>
          <p style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span>即時鏡頭智慧點名與缺席座號追蹤 (當前課堂：<strong style={{ color: '#38bdf8' }}>{currentPeriodTitle}</strong>)</span>
            {isMobile && (
              <span style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.15)', color: '#38bdf8', border: '1px solid rgba(59, 130, 246, 0.3)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Smartphone size={13} /> 巡堂查驗模式 (唯讀)
              </span>
            )}
          </p>
        </div>

        {/* 電腦端具備完整管理權限；手機端只能檢視，隱藏設定按鈕 */}
        {!isMobile && (
          <div className="header-actions" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {/* 定時自動點名排程按鈕 */}
            <button
              onClick={() => setIsScheduleModalOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: scheduleConfig.enabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.06)',
                color: scheduleConfig.enabled ? '#10b981' : 'var(--text-secondary)',
                border: `1px solid ${scheduleConfig.enabled ? 'rgba(16, 185, 129, 0.4)' : 'var(--glass-border)'}`,
                padding: '10px 18px', borderRadius: '10px',
                fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
                boxShadow: scheduleConfig.enabled ? '0 0 12px rgba(16, 185, 129, 0.2)' : 'none',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <Clock size={18} />
              {scheduleConfig.enabled
                ? `自動點名 (${scheduleConfig.schedules.filter((s) => s.enabled).length} 個時段)`
                : '自動點名 (已暫停)'}
            </button>

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
        )}
      </header>

      {/* 下一次排程時間提示標籤 (手機端唯讀顯示，電腦端可點擊編輯) */}
      {scheduleConfig.enabled && nextUpcoming && (
        <div
          onClick={isMobile ? undefined : () => setIsScheduleModalOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(59, 130, 246, 0.12)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            color: '#93c5fd',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '0.82rem',
            marginBottom: '18px',
            cursor: isMobile ? 'default' : 'pointer',
            transition: 'background 0.2s',
            maxWidth: '100%',
            boxSizing: 'border-box',
          }}
          onMouseOver={(e) => {
            if (!isMobile) e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
          }}
          onMouseOut={(e) => {
            if (!isMobile) e.currentTarget.style.background = 'rgba(59, 130, 246, 0.12)';
          }}
        >
          <Timer size={15} color="#60a5fa" style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            定時排程：下一次自動點名將於 <strong>{nextUpcoming.formattedText}</strong> 自動執行
          </span>
        </div>
      )}

      {/* 統計卡片自適應網格 */}
      <div className="stat-cards-grid">
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
            <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.15)', borderRadius: '12px', color: '#ef4444' }}>
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

      {/* 主體區塊：最新點名捕捉影像 (左側) 與 即時通報紀錄簿 (右側) - 支援 RWD 自適應堆疊 */}
      <div className="dashboard-main-grid">
        {/* 最新點名捕捉影像卡片 */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          {/* 卡片標題與分頁切換 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Camera size={22} color="var(--accent-primary)" />
              <h2 style={{ fontSize: '1.2rem', margin: 0 }}>最新點名捕捉影像</h2>
              {isMobile && (
                <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.15)', color: '#38bdf8', fontWeight: 600 }}>
                  最後通報相片
                </span>
              )}
            </div>

            {/* 即時鏡頭 / 最後通報 切換 Tab (僅電腦端可切換即時相機，手機端鎖定通報相片) */}
            {!isMobile && (
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
            )}
          </div>

          {/* 視訊畫面 / 照片顯示區 (響應式容器) */}
          <div className="camera-preview-container">
            {/* TEAM_008: 即時相機視訊區塊 (常駐 DOM 避免切換 Tab 時被 React 卸載導致 srcObject 遺失與黑屏) */}
            <div style={{ position: 'relative', width: '100%', height: '100%', display: previewTab === 'live' ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={(e) => {
                  const target = e.currentTarget;
                  if (target.videoWidth > 0 && target.videoHeight > 0) {
                    setCamAspect(target.videoWidth / target.videoHeight);
                  }
                }}
                style={{
                  display: cameraActive ? 'block' : 'none',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                }}
              />

              {cameraActive && (
                <canvas
                  ref={overlayCanvasRef}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none',
                    zIndex: 2,
                  }}
                />
              )}

              {!cameraActive && (
                <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.15)', borderRadius: '50%', color: '#ef4444' }}>
                    <AlertTriangle size={36} />
                  </div>
                  <h4 style={{ color: '#ef4444', margin: '4px 0 0 0' }}>尚未啟動相機鏡頭</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>{cameraError || '請選擇鏡頭或授權攝影機存取以開啟即時預覽。'}</p>
                </div>
              )}
            </div>

            {/* TEAM_008: 最後通報相片區塊 (切換為 latest 時顯示) */}
            <div style={{ position: 'relative', width: '100%', height: '100%', display: previewTab === 'latest' ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center' }}>
              {latestRecord ? (
                <div key={latestRecord.id} className="animate-fade-in" style={{ textAlign: 'center', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', boxSizing: 'border-box' }}>
                  <div style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }} onClick={() => setSelectedRecord(latestRecord)}>
                    <img
                      src={latestRecord.file_url}
                      alt={latestRecord.message}
                      style={{ maxWidth: '380px', maxHeight: '280px', borderRadius: '12px', border: '2.5px solid var(--success)', objectFit: 'contain', background: 'rgba(255,255,255,0.05)' }}
                    />
                    <div style={{ position: 'absolute', top: '-6px', left: '-6px', width: '20px', height: '20px', borderTop: '3.5px solid var(--success)', borderLeft: '3.5px solid var(--success)', borderRadius: '6px 0 0 0' }} />
                    <div style={{ position: 'absolute', bottom: '-6px', right: '-6px', width: '20px', height: '20px', borderBottom: '3.5px solid var(--success)', borderRight: '3.5px solid var(--success)', borderRadius: '0 0 6px 0' }} />
                  </div>

                  {/* 中間文字區域：只顯示訊息與未到幾員 */}
                  <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <h4 style={{ fontSize: '1.2rem', color: 'var(--accent-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                      <GraduationCap size={20} />
                      {latestRecord.message}
                    </h4>

                    {/* 未到/缺席與實到人數標籤 */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '2px' }}>
                      {latestVacantSeatIds.length > 0 ? (
                        <span style={{ fontSize: '0.85rem', padding: '3px 12px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <UserX size={14} /> 未到: {latestVacantSeatIds.join(', ')} (共 {latestVacantSeatIds.length} 席)
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.85rem', padding: '3px 12px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.4)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <UserCheck size={14} /> 全員在座 (共 {currentTotalSeats} 席)
                        </span>
                      )}

                      <span style={{ fontSize: '0.85rem', padding: '3px 12px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.15)', color: '#38bdf8', border: '1px solid rgba(59, 130, 246, 0.3)', fontWeight: 600 }}>
                        在座率: {currentAttendanceRate} ({currentOccupiedCount}/{currentTotalSeats} 席)
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
                  <Camera size={44} style={{ opacity: 0.3, marginBottom: '10px' }} />
                  <p style={{ margin: 0 }}>尚未有任何通報紀錄</p>
                </div>
              )}
            </div>
          </div>

          {/* 底部控制器 */}
          <div style={{ marginTop: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            {!isMobile && previewTab === 'live' ? (
              // 電腦即時鏡頭模式：顯示相機裝置切換（Webcam / Ameba）與「立即記錄點名」按鈕 (無相機時禁用)
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: '1 1 auto' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 auto', minWidth: '180px' }}>
                    <Camera size={16} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                    <select
                      value={selectedDeviceId}
                      onChange={(e) => {
                        const nextId = e.target.value;
                        setSelectedDeviceId(nextId);
                        startCamera(nextId);
                      }}
                      style={{ padding: '7px 12px', borderRadius: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155', fontSize: '0.82rem', width: '100%', maxWidth: '280px' }}
                    >
                      {devices.map((d) => (
                        <option key={d.id || d.deviceId} value={d.id || d.deviceId}>
                          {d.name || d.label || `鏡頭 (${d.deviceId})`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* TEAM_008: 新增重啟/重新整理相機按鈕 */}
                  <button
                    onClick={() => startCamera(selectedDeviceId)}
                    title="重新載入相機串流"
                    style={{
                      padding: '7px 12px',
                      borderRadius: '8px',
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: 'var(--accent-primary)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <RefreshCw size={14} /> 重新整理鏡頭
                  </button>
                </div>

                <button
                  onClick={() => executeRollcall(null, false)}
                  disabled={isSending || !cameraActive}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    padding: '9px 22px', borderRadius: '8px',
                    background: cameraActive && !isSending ? 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)' : '#334155',
                    color: cameraActive && !isSending ? '#fff' : '#94a3b8',
                    fontWeight: 600, fontSize: '0.88rem',
                    border: 'none', cursor: isSending || !cameraActive ? 'not-allowed' : 'pointer',
                    boxShadow: cameraActive && !isSending ? '0 4px 14px rgba(59, 130, 246, 0.35)' : 'none',
                    transition: 'all 0.2s',
                    flex: '1 1 auto',
                    minWidth: '200px',
                    opacity: cameraActive && !isSending ? 1 : 0.6,
                  }}
                  onMouseOver={(e) => {
                    if (cameraActive && !isSending) e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseOut={(e) => {
                    if (cameraActive && !isSending) e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <Camera size={16} />
                  {!cameraActive
                    ? '請先開啟相機'
                    : isSending
                      ? '通報點名中...'
                      : `📸 立即記錄點名 (${currentPeriodTitle})`}
                </button>
              </>
            ) : (
              // 最後通報相片模式：左下角寫「最後紀錄：時間」，右下角為「觀看大圖」按鈕
              <>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <Clock size={15} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                  <span>
                    {latestRecord
                      ? `最後紀錄：${formatFullDateTime(latestRecord.create_at)}`
                      : '尚無點名照片'}
                  </span>
                </div>

                {latestRecord && (
                  <button
                    onClick={() => setSelectedRecord(latestRecord)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '9px 20px', background: 'var(--accent-primary)',
                      color: 'white', borderRadius: '8px', fontSize: '0.88rem', fontWeight: 600,
                      border: 'none', cursor: 'pointer', marginLeft: 'auto',
                      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                      transition: 'transform 0.2s',
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                  >
                    <Eye size={16} /> 觀看大圖
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* 即時動態通報紀錄簿 (右側) */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <Activity size={22} color="var(--accent-primary)" />
            <h2 style={{ fontSize: '1.2rem' }}>即時通報紀錄簿</h2>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '460px' }}>
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

      {/* 座位劃位設定 Modal (配備 ErrorBoundary 防護) */}
      <ErrorBoundary compact onReset={() => setIsSeatEditorOpen(false)}>
        <SeatMapEditorModal
          isOpen={isSeatEditorOpen}
          onClose={() => setIsSeatEditorOpen(false)}
          onSaveSuccess={(newConfig) => {
            setSeatConfig(newConfig);
          }}
          activeStream={cameraStream || streamRef.current}
          parentCameraActive={cameraActive}
          currentDeviceId={selectedDeviceId}
          onDeviceChange={(newId) => {
            setSelectedDeviceId(newId);
            startCamera(newId);
          }}
        />
      </ErrorBoundary>

      {/* 定時自動點名排程 Modal */}
      <ScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        onConfigChange={(newCfg) => {
          setScheduleConfig(newCfg);
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
