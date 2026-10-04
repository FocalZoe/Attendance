// ==============================================================================
// 智慧多座位在座即時儀表板 (Dashboard.jsx)
// 架構升級：
// 1. 職責分離：抽離 useCamera, useMediaPipe, useSeatAnalysis, useAutoRollcall
// 2. 全域狀態：整合 Zustand (useAuthStore, useCameraStore, useSeatStore, useScheduleStore)
// 3. 渲染效能：切分 CameraPreview, AttendanceRecordsList, StatCards 獨立子元件
// ==============================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LayoutGrid, Clock, GraduationCap, Smartphone, Timer } from 'lucide-react';
import { fetchHistoryRecords, sendTelemetry, connectWebSocket } from '../services/api';
import {
  formatFullPeriodMessage,
  switchActiveClassLayout,
  getSavedSeatsConfig,
} from '../services/seatOccupancyService';
import { getSavedSchedulesConfig } from '../services/scheduleService';

// Zustand Stores
import { useAuthStore } from '../store/authStore';
import { useCameraStore } from '../store/cameraStore';
import { useSeatStore } from '../store/seatStore';
import { useScheduleStore } from '../store/scheduleStore';

// Custom Hooks
import { useCamera } from '../hooks/useCamera';
import { useMediaPipe } from '../hooks/useMediaPipe';
import { useSeatAnalysis } from '../hooks/useSeatAnalysis';
import { useAutoRollcall } from '../hooks/useAutoRollcall';

// UI Sub-components
import CameraPreview from '../components/dashboard/CameraPreview';
import AttendanceRecordsList from '../components/dashboard/AttendanceRecordsList';
import StatCards from '../components/dashboard/StatCards';

// Modals
import SeatMapEditorModal from '../components/SeatMapEditorModal';
import ScheduleModal from '../components/ScheduleModal';
import ImageModal from '../components/ImageModal';
import ErrorBoundary from '../components/ErrorBoundary';
import LoginModal from '../components/LoginModal';
import Toast from '../components/Toast';

const Dashboard = ({ onOpenLogin }) => {
  // 全域狀態 Store 綁定
  const { session, setSession, isLoginModalOpen, openLoginModal, closeLoginModal } = useAuthStore();
  const {
    previewTab,
    setPreviewTab,
    selectedDeviceId,
    setSelectedDeviceId,
  } = useCameraStore();
  const { seatConfig, setSeatConfig, isSeatEditorOpen, setIsSeatEditorOpen } = useSeatStore();
  const { isScheduleModalOpen, setIsScheduleModalOpen, setScheduleConfig } = useScheduleStore();

  // 本地狀態
  const [records, setRecords] = useState([]);
  const [latestRecord, setLatestRecord] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [autoRollcallToast, setAutoRollcallToast] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const isAutoSendingRef = useRef(false);

  // DOM 參照
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const animFrameIdRef = useRef(null);

  // 1. 相機管理 Hook
  const {
    isMobile,
    devices,
    cameraActive,
    cameraStream,
    cameraError,
    startCamera,
  } = useCamera(videoRef);

  // 2. MediaPipe AI 人員偵測 Hook
  const { detectFrame, lastDetectionsRef } = useMediaPipe();

  // 3. 空間幾何與座位防抖追蹤 Hook
  const {
    processDetectedPersons,
    scaleSeatsToClient,
    computeSeatStatuses,
    renderOverlay,
  } = useSeatAnalysis(800);

  // 即時 AI 人員偵測與座位覆蓋層渲染循環 (RAF)
  useEffect(() => {
    if (!cameraActive || previewTab !== 'live') return;

    let active = true;

    const renderLoop = () => {
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
          const detections = detectFrame(video);
          const detectedPersonsInView = processDetectedPersons(
            detections,
            video.videoWidth,
            video.videoHeight,
            cWidth,
            cHeight
          );

          const currentSeats = seatConfig?.seats || [];
          const scaledSeats = scaleSeatsToClient(currentSeats, cWidth, cHeight);
          const statuses = computeSeatStatuses(scaledSeats, detectedPersonsInView);

          renderOverlay(ctx, cWidth, cHeight, statuses, detectedPersonsInView);
        }
      }

      if (active) {
        animFrameIdRef.current = requestAnimationFrame(renderLoop);
      }
    };

    renderLoop();

    return () => {
      active = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [
    cameraActive,
    previewTab,
    detectFrame,
    processDetectedPersons,
    scaleSeatsToClient,
    computeSeatStatuses,
    renderOverlay,
    seatConfig,
  ]);

  // 載入歷史紀錄
  const loadRecords = useCallback(async () => {
    const data = await fetchHistoryRecords({ limit: 20 });
    setRecords(data);
    if (data.length > 0) {
      setLatestRecord(data[0]);
    }
  }, []);

  // 拍照並發送點名
  const executeRollcall = useCallback(
    async (targetPeriodName = null, isAuto = false) => {
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

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64Data = canvas.toDataURL('image/jpeg', 0.92);

        const currentConfig = getSavedSeatsConfig();
        const currentPeriodName = targetPeriodName || currentConfig.current_period || '第 1 節';
        const vHeight = video.videoHeight || 480;

        const detectedPersonsPayload = (lastDetectionsRef.current || [])
          .filter((det) => {
            const { originY, width, height } = det.boundingBox;
            const score = det.categories[0]?.score || 0;
            const yNorm = originY / (vHeight || 1);
            const aspectRatio = height / (width || 1);

            if (yNorm <= 0.5) {
              return score >= 0.1 && aspectRatio >= 0.4;
            } else {
              return score >= 0.22 && aspectRatio >= 0.6;
            }
          })
          .map((det) => ({
            x: Math.round(det.boundingBox.originX),
            y: Math.round(det.boundingBox.originY),
            width: Math.round(det.boundingBox.width),
            height: Math.round(det.boundingBox.height),
            confidence: det.categories[0]?.score || 0.95,
          }));

        const result = await sendTelemetry({
          message: formatFullPeriodMessage(currentPeriodName, session?.user?.class_name),
          file: base64Data,
          timestamp: new Date().toISOString(),
          detected_persons: detectedPersonsPayload,
          seats: seatConfig.seats,
          class_id: session?.user?.id || null,
          class_name: session?.user?.class_name || null,
          layout_name: seatConfig.layout_name || null,
        });

        if (result && result.record) {
          setLatestRecord(result.record);
          setRecords((prev) => [result.record, ...prev.filter((r) => r.id !== result.record.id)].slice(0, 20));
        } else {
          await loadRecords();
        }

        if (isAuto) {
          const nowTimeStr = new Date().toLocaleTimeString('zh-TW', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
          });
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
    },
    [cameraActive, isSending, lastDetectionsRef, seatConfig, session, loadRecords]
  );

  // 4. 定時自動點名排程 Hook
  const { scheduleConfig, nextUpcoming } = useAutoRollcall({
    onTrigger: (period) => executeRollcall(period, true),
    isCameraActive: cameraActive,
  });

  // 初始化與 WebSocket 訂閱
  useEffect(() => {
    loadRecords();

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
      cleanupWs();
    };
  }, [loadRecords]);

  // 工具函式
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

  // 解析統計指標
  let latestAiAnalysis = latestRecord?.ai_analysis;
  if (typeof latestAiAnalysis === 'string') {
    try {
      latestAiAnalysis = JSON.parse(latestAiAnalysis);
    } catch (e) {
      latestAiAnalysis = null;
    }
  }

  const currentTotalSeats = latestAiAnalysis?.total_seats || seatConfig?.seats?.length || 0;
  const currentOccupiedCount =
    typeof latestAiAnalysis?.occupied_count === 'number' ? latestAiAnalysis.occupied_count : 0;
  const currentVacantCount =
    typeof latestAiAnalysis?.vacant_count === 'number'
      ? latestAiAnalysis.vacant_count
      : Math.max(0, currentTotalSeats - currentOccupiedCount);
  const currentAttendanceRate =
    latestAiAnalysis?.attendance_rate ||
    (currentTotalSeats > 0 ? `${((currentOccupiedCount / currentTotalSeats) * 100).toFixed(1)}%` : '0.0%');

  const latestStatuses = Array.isArray(latestAiAnalysis?.seat_statuses) ? latestAiAnalysis.seat_statuses : [];
  const latestVacantSeatIds = latestStatuses.filter((s) => s.status === 'VACANT').map((s) => s.seat_id);
  const currentPeriodTitle = formatFullPeriodMessage(seatConfig?.current_period, session?.user?.class_name);

  // 訪客未登入守衛
  const isClassLoggedIn = session?.role === 'class';
  if (!isClassLoggedIn) {
    return (
      <div
        className="animate-fade-in"
        style={{ padding: '40px 20px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '12px',
            background: 'var(--brand-light)',
            color: 'var(--brand-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <GraduationCap size={32} />
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>
          歡迎使用 班級自動化點名系統
        </h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
          您目前處於訪客模式。即時儀表板與相機邊緣考勤功能需登入班級帳號方可啟用。若欲查閱歷次課堂點名照片與出席紀錄，請點選左側「課堂歷史紀錄簿」。
        </p>
        <button
          onClick={() => (onOpenLogin ? onOpenLogin() : openLoginModal())}
          style={{
            padding: '10px 24px',
            borderRadius: '6px',
            background: 'var(--accent-primary)',
            color: '#ffffff',
            border: 'none',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.15s ease',
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = 'var(--accent-hover)')}
          onMouseOut={(e) => (e.currentTarget.style.background = 'var(--accent-primary)')}
        >
          🔐 立即登入班級帳號
        </button>

        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={closeLoginModal}
          onSuccess={() => {
            setSession(useAuthStore.getState().session);
            setSeatConfig(getSavedSeatsConfig());
          }}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* 自動點名 Toast */}
      {autoRollcallToast && (
        <Toast
          message={`[${autoRollcallToast.time}] ${autoRollcallToast.period} 定時自動點名通報已成功執行並儲存！`}
          type="success"
          onClose={() => setAutoRollcallToast(null)}
        />
      )}

      {/* 標題與操作區 */}
      <header
        className="page-header"
        style={{
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.85rem',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: 'var(--text-primary)',
            }}
          >
            課堂考勤即時儀表板
          </h1>
          <p style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span>
              即時鏡頭智慧點名與缺席座號追蹤 (當前課堂：
              <strong style={{ color: 'var(--accent-primary)' }}>{currentPeriodTitle}</strong>)
            </span>
            {isMobile && (
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  background: 'var(--bg-subtle)',
                  color: 'var(--accent-primary)',
                  border: '1px solid var(--border-color)',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Smartphone size={13} /> 巡堂查驗模式 (唯讀)
              </span>
            )}
          </p>
        </div>

        {!isMobile && (
          <div className="header-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {session?.user?.seat_layout && Object.keys(session.user.seat_layout).length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'var(--bg-subtle)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <LayoutGrid size={16} color="var(--accent-primary)" />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>佈局：</span>
                <select
                  value={seatConfig?.layout_key || session.user.active_layout_key || 'layout1'}
                  onChange={async (e) => {
                    const nextKey = e.target.value;
                    await switchActiveClassLayout(nextKey);
                    setSeatConfig(getSavedSeatsConfig());
                  }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-dark)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    background: '#ffffff',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {Object.entries(session.user.seat_layout).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l.name || k} ({Array.isArray(l.seats) ? l.seats.length : 0} 席)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={() => setIsScheduleModalOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: scheduleConfig?.enabled ? '#ecfdf5' : '#ffffff',
                color: scheduleConfig?.enabled ? '#059669' : 'var(--text-secondary)',
                border: `1px solid ${scheduleConfig?.enabled ? '#a7f3d0' : 'var(--border-color)'}`,
                padding: '8px 16px',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: 'none',
                transition: 'background 0.15s ease',
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.background = scheduleConfig?.enabled ? '#d1fae5' : 'var(--accent-light)')
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.background = scheduleConfig?.enabled ? '#ecfdf5' : '#ffffff')
              }
            >
              <Clock size={16} />
              {scheduleConfig?.enabled
                ? `自動點名 (${scheduleConfig.schedules.filter((s) => s.enabled).length} 個時段)`
                : '自動點名 (已暫停)'}
            </button>
          </div>
        )}
      </header>

      {/* 下一次排程時間提示標籤 */}
      {scheduleConfig?.enabled && nextUpcoming && (
        <div
          onClick={isMobile ? undefined : () => setIsScheduleModalOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            padding: '6px 14px',
            borderRadius: '6px',
            fontSize: '0.82rem',
            marginBottom: '18px',
            cursor: isMobile ? 'default' : 'pointer',
            transition: 'all 0.15s ease',
            maxWidth: '100%',
            boxSizing: 'border-box',
          }}
          onMouseOver={(e) => {
            if (!isMobile) e.currentTarget.style.background = '#e2e8f0';
          }}
          onMouseOut={(e) => {
            if (!isMobile) e.currentTarget.style.background = 'var(--bg-subtle)';
          }}
        >
          <Timer size={15} color="var(--brand-primary)" style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            定時排程：下一次自動點名將於{' '}
            <strong style={{ color: 'var(--brand-primary)' }}>{nextUpcoming.formattedText}</strong> 自動執行
          </span>
        </div>
      )}

      {/* 主體區塊：最新點名捕捉影像 (左側) 與 即時通報紀錄簿 (右側) */}
      <div className="dashboard-main-grid">
        <CameraPreview
          isMobile={isMobile}
          previewTab={previewTab}
          setPreviewTab={setPreviewTab}
          cameraActive={cameraActive}
          cameraError={cameraError}
          videoRef={videoRef}
          overlayCanvasRef={overlayCanvasRef}
          latestRecord={latestRecord}
          setSelectedRecord={setSelectedRecord}
          latestVacantSeatIds={latestVacantSeatIds}
          currentTotalSeats={currentTotalSeats}
          currentOccupiedCount={currentOccupiedCount}
          currentAttendanceRate={currentAttendanceRate}
          formatFullDateTime={formatFullDateTime}
          devices={devices}
          selectedDeviceId={selectedDeviceId}
          onDeviceChange={(newId) => {
            setSelectedDeviceId(newId);
            startCamera(newId);
          }}
          onRestartCamera={() => startCamera(selectedDeviceId)}
          onExecuteRollcall={executeRollcall}
          isSending={isSending}
          currentPeriodTitle={currentPeriodTitle}
        />

        <AttendanceRecordsList
          records={records}
          onSelectRecord={(rec) => setSelectedRecord(rec)}
        />
      </div>

      {/* 統計卡片自適應網格 */}
      <StatCards
        currentTotalSeats={currentTotalSeats}
        currentOccupiedCount={currentOccupiedCount}
        currentVacantCount={currentVacantCount}
        currentAttendanceRate={currentAttendanceRate}
        lastFormattedTime={formatFullDateTime(latestRecord?.create_at)}
      />

      {/* 座位劃位設定 Modal */}
      <ErrorBoundary compact onReset={() => setIsSeatEditorOpen(false)}>
        <SeatMapEditorModal
          isOpen={isSeatEditorOpen}
          onClose={() => setIsSeatEditorOpen(false)}
          onSaveSuccess={(newConfig) => {
            setSeatConfig(newConfig);
          }}
          activeStream={cameraStream}
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
