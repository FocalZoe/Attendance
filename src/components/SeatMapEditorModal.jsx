// TEAM_008: 視覺化座位劃位與座號設置編輯器 (SeatMapEditorModal.jsx)
// 升級重點：
// 1. 使用 ReactDOM.createPortal 達成 100% 全域全螢幕覆蓋 (zIndex: 999999)。
// 2. 無相機時嚴格禁止劃位，並顯示提示。
// 3. 有相機時，畫面與畫布鎖定鏡頭真實長寬比等比例縮放，確保劃位百分之百精確。
// 4. 支援自訂排數 (Rows) 與每排欄數 (Cols) 數值網格生成，純數字流水號座號。
// 5. 支援選取座位框拖曳移動 (Drag Move) 與 4 個角落把手自訂縮放大小 (Resize Handles)。

import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Trash2, Grid, Save, LayoutGrid, Check, Info, Camera, GraduationCap, AlertTriangle } from 'lucide-react';
import { getSavedSeatsConfig, saveSeatsConfig, generateGridSeats, formatFullPeriodMessage } from '../services/seatOccupancyService';

export const SeatMapEditorModal = ({ isOpen, onClose, onSaveSuccess }) => {
  const [config, setConfig] = useState(getSavedSeatsConfig());
  const [period, setPeriod] = useState(config.current_period || '第 1 節');
  const [selectedSeatIndex, setSelectedSeatIndex] = useState(null);
  const [savedNotice, setSavedNotice] = useState(false);

  // 自訂網格設定
  const [gridRows, setGridRows] = useState(3);
  const [gridCols, setGridCols] = useState(3);

  // 互動狀態：'NONE' | 'DRAW' | 'MOVE' | 'RESIZE'
  const [interactionMode, setInteractionMode] = useState('NONE');
  const [resizeHandle, setResizeHandle] = useState(null); // 'nw' | 'ne' | 'sw' | 'se'
  const [dragStartPoint, setDragStartPoint] = useState({ x: 0, y: 0 });
  const [initialSeatPct, setInitialSeatPct] = useState(null);
  const [currentDrawRectPct, setCurrentDrawRectPct] = useState(null);
  const [drawStartPct, setDrawStartPct] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);

  // 相機真實視訊解析度與長寬比
  const [videoDims, setVideoDims] = useState({ width: 0, height: 0 });
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const containerRef = useRef(null);

  // 取得相機裝置清單
  const getCameraDevices = async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices.filter((device) => device.kind === 'videoinput');
      setDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
    } catch (err) {
      console.warn('[SeatMapEditor] Enumerate devices error:', err);
    }
  };

  // 啟動相機 (相容降級與軌道中斷恢復)
  const startCamera = async (deviceId) => {
    setCameraError(null);
    stopCamera();

    try {
      let stream = null;
      try {
        const constraints = {
          video: deviceId ? { deviceId: { exact: deviceId } } : { width: { ideal: 1920 }, height: { ideal: 1080 } },
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err1) {
        console.warn('[SeatMapEditor TEAM_008] Exact constraint failed, try soft deviceId:', err1);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: deviceId ? { deviceId: deviceId } : { width: { ideal: 1280 }, height: { ideal: 720 } },
          });
        } catch (err2) {
          console.warn('[SeatMapEditor TEAM_008] Soft constraint failed, fallback to generic video:', err2);
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      }

      streamRef.current = stream;

      stream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          console.warn('[SeatMapEditor TEAM_008] Camera stream track ended. Auto restarting...');
          setCameraActive(false);
          setTimeout(() => startCamera(selectedDeviceId), 1200);
        };
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((e) => console.warn('[SeatMapEditor TEAM_008] Video play warning:', e));
      }

      setCameraActive(true);
      await getCameraDevices();
    } catch (err) {
      console.warn('[SeatMapEditor TEAM_008] Camera error:', err);
      setCameraError('無法開啟相機鏡頭，請確認鏡頭權限與連線。');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (isOpen) {
      const saved = getSavedSeatsConfig();
      setConfig(saved);
      setPeriod(saved.current_period || '第 1 節');
      setSelectedSeatIndex(null);
      setSavedNotice(false);
      startCamera(selectedDeviceId);
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, selectedDeviceId]);

  if (!isOpen) return null;

  // 計算滑鼠在畫布上的真實百分比 (0.0 ~ 100.0)
  const getPointPct = (e) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    return {
      x: parseFloat(xPct.toFixed(2)),
      y: parseFloat(yPct.toFixed(2)),
    };
  };

  // 取得座位的百分比座標
  const getSeatPct = (seat) => {
    const roi = seat.roi;
    if (typeof roi.x_pct === 'number' && typeof roi.width_pct === 'number') {
      return {
        x: roi.x_pct,
        y: roi.y_pct,
        width: roi.width_pct,
        height: roi.height_pct,
      };
    }
    const bw = config.base_width || 640;
    const bh = config.base_height || 480;
    return {
      x: (roi.x / bw) * 100,
      y: (roi.y / bh) * 100,
      width: (roi.width / bw) * 100,
      height: (roi.height / bh) * 100,
    };
  };

  // 更新座位的百分比與像素幾何
  const updateSeatRoiPct = (index, newPct) => {
    const vW = videoDims.width || 640;
    const vH = videoDims.height || 480;
    const updatedSeats = [...config.seats];
    const targetSeat = updatedSeats[index];
    if (!targetSeat) return;

    const xPct = parseFloat(newPct.x.toFixed(2));
    const yPct = parseFloat(newPct.y.toFixed(2));
    const wPct = parseFloat(newPct.width.toFixed(2));
    const hPct = parseFloat(newPct.height.toFixed(2));

    updatedSeats[index] = {
      ...targetSeat,
      roi: {
        ...targetSeat.roi,
        x_pct: xPct,
        y_pct: yPct,
        width_pct: wPct,
        height_pct: hPct,
        x: Math.round((xPct / 100) * vW),
        y: Math.round((yPct / 100) * vH),
        width: Math.round((wPct / 100) * vW),
        height: Math.round((hPct / 100) * vH),
      },
    };

    setConfig({
      ...config,
      base_width: vW,
      base_height: vH,
      seats: updatedSeats,
    });
  };

  // 縮放把手點擊按下
  const handleResizeHandleMouseDown = (e, handleType, seatIndex) => {
    if (!cameraActive) return;
    e.stopPropagation();
    e.preventDefault();

    const pt = getPointPct(e);
    setSelectedSeatIndex(seatIndex);
    setInteractionMode('RESIZE');
    setResizeHandle(handleType);
    setDragStartPoint(pt);
    setInitialSeatPct(getSeatPct(config.seats[seatIndex]));
    setHasMoved(false);
  };

  // 座位框本體點擊按下 (開始移動或切換選取)
  const handleSeatMouseDown = (e, seatIndex) => {
    if (!cameraActive) return;
    e.stopPropagation();
    e.preventDefault();

    const pt = getPointPct(e);
    setSelectedSeatIndex(seatIndex);
    setInteractionMode('MOVE');
    setDragStartPoint(pt);
    setInitialSeatPct(getSeatPct(config.seats[seatIndex]));
    setHasMoved(false);
  };

  // 畫布空白處按下 (開始繪製新座位)
  const handleCanvasMouseDown = (e) => {
    if (!cameraActive) return;

    const pt = getPointPct(e);
    setInteractionMode('DRAW');
    setDrawStartPct(pt);
    setCurrentDrawRectPct({ x: pt.x, y: pt.y, width: 0, height: 0 });
    setDragStartPoint(pt);
    setHasMoved(false);
  };

  // 滑鼠移動處理 (移動座位、縮放座位或拉框繪製)
  const handleMouseMove = (e) => {
    if (!cameraActive || interactionMode === 'NONE') return;
    const pt = getPointPct(e);

    if (interactionMode === 'MOVE' && selectedSeatIndex !== null && initialSeatPct) {
      const dx = pt.x - dragStartPoint.x;
      const dy = pt.y - dragStartPoint.y;
      if (Math.abs(dx) > 0.2 || Math.abs(dy) > 0.2) {
        setHasMoved(true);
      }
      const newX = Math.max(0, Math.min(100 - initialSeatPct.width, initialSeatPct.x + dx));
      const newY = Math.max(0, Math.min(100 - initialSeatPct.height, initialSeatPct.y + dy));
      updateSeatRoiPct(selectedSeatIndex, {
        x: newX,
        y: newY,
        width: initialSeatPct.width,
        height: initialSeatPct.height,
      });
    } else if (interactionMode === 'RESIZE' && selectedSeatIndex !== null && initialSeatPct) {
      const dx = pt.x - dragStartPoint.x;
      const dy = pt.y - dragStartPoint.y;
      setHasMoved(true);

      let newX = initialSeatPct.x;
      let newY = initialSeatPct.y;
      let newW = initialSeatPct.width;
      let newH = initialSeatPct.height;

      if (resizeHandle === 'se') {
        newW = Math.max(2, Math.min(100 - initialSeatPct.x, initialSeatPct.width + dx));
        newH = Math.max(2, Math.min(100 - initialSeatPct.y, initialSeatPct.height + dy));
      } else if (resizeHandle === 'sw') {
        newX = Math.max(0, Math.min(initialSeatPct.x + initialSeatPct.width - 2, initialSeatPct.x + dx));
        newW = (initialSeatPct.x + initialSeatPct.width) - newX;
        newH = Math.max(2, Math.min(100 - initialSeatPct.y, initialSeatPct.height + dy));
      } else if (resizeHandle === 'ne') {
        newW = Math.max(2, Math.min(100 - initialSeatPct.x, initialSeatPct.width + dx));
        newY = Math.max(0, Math.min(initialSeatPct.y + initialSeatPct.height - 2, initialSeatPct.y + dy));
        newH = (initialSeatPct.y + initialSeatPct.height) - newY;
      } else if (resizeHandle === 'nw') {
        newX = Math.max(0, Math.min(initialSeatPct.x + initialSeatPct.width - 2, initialSeatPct.x + dx));
        newY = Math.max(0, Math.min(initialSeatPct.y + initialSeatPct.height - 2, initialSeatPct.y + dy));
        newW = (initialSeatPct.x + initialSeatPct.width) - newX;
        newH = (initialSeatPct.y + initialSeatPct.height) - newY;
      }

      updateSeatRoiPct(selectedSeatIndex, {
        x: newX,
        y: newY,
        width: newW,
        height: newH,
      });
    } else if (interactionMode === 'DRAW') {
      const x = Math.min(drawStartPct.x, pt.x);
      const y = Math.min(drawStartPct.y, pt.y);
      const width = Math.abs(pt.x - drawStartPct.x);
      const height = Math.abs(pt.y - drawStartPct.y);
      if (width > 0.5 || height > 0.5) {
        setHasMoved(true);
      }
      setCurrentDrawRectPct({ x, y, width, height });
    }
  };

  // 滑鼠放開處理
  const handleMouseUp = () => {
    if (!cameraActive) {
      setInteractionMode('NONE');
      setCurrentDrawRectPct(null);
      return;
    }

    if (interactionMode === 'DRAW') {
      if (currentDrawRectPct && currentDrawRectPct.width > 2 && currentDrawRectPct.height > 2) {
        const nextNum = config.seats.length + 1;
        const xPct = parseFloat(currentDrawRectPct.x.toFixed(2));
        const yPct = parseFloat(currentDrawRectPct.y.toFixed(2));
        const wPct = parseFloat(currentDrawRectPct.width.toFixed(2));
        const hPct = parseFloat(currentDrawRectPct.height.toFixed(2));

        const vW = videoDims.width || 640;
        const vH = videoDims.height || 480;

        const newSeat = {
          seat_id: String(nextNum),
          name: `座位 #${nextNum}`,
          roi: {
            x_pct: xPct,
            y_pct: yPct,
            width_pct: wPct,
            height_pct: hPct,
            x: Math.round((xPct / 100) * vW),
            y: Math.round((yPct / 100) * vH),
            width: Math.round((wPct / 100) * vW),
            height: Math.round((hPct / 100) * vH),
          },
        };

        const updated = {
          ...config,
          base_width: vW,
          base_height: vH,
          seats: [...config.seats, newSeat],
        };
        setConfig(updated);
        setSelectedSeatIndex(updated.seats.length - 1);
      } else if (!hasMoved) {
        // 單純點擊空白畫布，取消選取
        setSelectedSeatIndex(null);
      }
    }

    setInteractionMode('NONE');
    setCurrentDrawRectPct(null);
    setResizeHandle(null);
    setInitialSeatPct(null);
  };

  // 刪除選取座位
  const handleDeleteSeat = (index) => {
    const updatedSeats = config.seats.filter((_, i) => i !== index);
    setConfig({ ...config, seats: updatedSeats });
    setSelectedSeatIndex(null);
  };

  // 清空所有座位
  const handleClearAllSeats = () => {
    setConfig({ ...config, seats: [] });
    setSelectedSeatIndex(null);
  };

  // 修改座號 ID 或名稱
  const handleUpdateSeatInfo = (index, field, value) => {
    const updatedSeats = [...config.seats];
    updatedSeats[index] = { ...updatedSeats[index], [field]: value };
    setConfig({ ...config, seats: updatedSeats });
  };

  // 產生自訂數值網格佈局
  const handleGenerateGrid = (rows, cols) => {
    if (!cameraActive) {
      alert('請先啟動相機鏡頭以進行劃位。');
      return;
    }
    const r = Math.max(1, parseInt(rows, 10) || 1);
    const c = Math.max(1, parseInt(cols, 10) || 1);
    const vW = videoDims.width || 640;
    const vH = videoDims.height || 480;
    const newSeats = generateGridSeats(r, c, vW, vH);
    setConfig({
      ...config,
      base_width: vW,
      base_height: vH,
      seats: newSeats,
    });
    setSelectedSeatIndex(null);
  };

  // 儲存配置
  const handleSave = () => {
    const toSave = {
      ...config,
      base_width: videoDims.width || 640,
      base_height: videoDims.height || 480,
      current_period: period || '第 1 節',
    };
    saveSeatsConfig(toSave);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
    if (onSaveSuccess) onSaveSuccess(toSave);
  };

  const currentFormattedPeriod = formatFullPeriodMessage(period);
  const aspectVal = (videoDims.width && videoDims.height) ? (videoDims.width / videoDims.height) : (4 / 3);
  const totalGridSeats = (parseInt(gridRows, 10) || 1) * (parseInt(gridCols, 10) || 1);

  const modalContent = (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(14px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: '20px',
        boxSizing: 'border-box',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '1060px',
          maxHeight: '94vh',
          overflowY: 'auto',
          background: '#1e293b',
          borderRadius: '16px',
          color: '#fff',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.9)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <LayoutGrid size={24} color="var(--accent-primary)" />
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                視覺化座位劃位與課堂設置
                {cameraActive && videoDims.width > 0 ? (
                  <span style={{ fontSize: '0.75rem', background: '#0284c7', color: '#e0f2fe', padding: '2px 8px', borderRadius: '12px' }}>
                    鏡頭等比畫面 ({videoDims.width} × {videoDims.height})
                  </span>
                ) : (
                  <span style={{ fontSize: '0.75rem', background: '#ef4444', color: '#fee2e2', padding: '2px 8px', borderRadius: '12px' }}>
                    無相機 (禁止劃位)
                  </span>
                )}
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {cameraActive ? `可拖曳移動座位、拉伸四角調整大小，或在空白處框選新座位 (目前共 ${config.seats.length} 席)` : '需啟動相機鏡頭方可進行精確劃位'}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={22} />
          </button>
        </div>

        {/* 課堂節次設定區 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', padding: '12px 16px', borderRadius: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-primary)', fontWeight: 600, fontSize: '0.9rem' }}>
            <GraduationCap size={18} />
            課堂節次設定：
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['第 1 節', '第 2 節', '第 3 節', '第 4 節', '第 5 節', '第 6 節', '第 7 節', '第 8 節'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  background: period === p ? 'var(--accent-primary)' : 'rgba(255,255,255,0.06)',
                  color: period === p ? '#fff' : 'var(--text-secondary)',
                  border: period === p ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.08)',
                  transition: 'all 0.2s',
                }}
              >
                {p}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
            <input
              type="text"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="自訂節次名稱"
              style={{ padding: '6px 10px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff', fontSize: '0.82rem', width: '130px' }}
            />
            <span style={{ fontSize: '0.78rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
              (通報標題：<strong style={{ color: '#38bdf8' }}>{currentFormattedPeriod}</strong>)
            </span>
          </div>
        </div>

        {/* 快捷排版與相機設定列 (支援自訂排數與欄數) */}
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', background: 'rgba(15, 23, 42, 0.65)', padding: '12px 16px', borderRadius: '10px', justifyContent: 'space-between', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
              <Grid size={16} /> 快速生成網格：
            </span>

            {/* 自訂排數與欄數輸入 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0f172a', padding: '4px 8px', borderRadius: '8px', border: '1px solid #334155' }}>
              <label style={{ fontSize: '0.78rem', color: '#94a3b8' }}>排數 (Rows)</label>
              <input
                type="number"
                min="1"
                max="20"
                value={gridRows}
                onChange={(e) => setGridRows(Math.max(1, parseInt(e.target.value, 10) || 1))}
                style={{ width: '46px', padding: '3px 6px', background: '#1e293b', border: '1px solid #475569', borderRadius: '4px', color: '#fff', fontSize: '0.82rem', textAlign: 'center' }}
              />
              <span style={{ color: '#64748b', fontSize: '0.8rem' }}>×</span>
              <label style={{ fontSize: '0.78rem', color: '#94a3b8' }}>每排席數 (Cols)</label>
              <input
                type="number"
                min="1"
                max="20"
                value={gridCols}
                onChange={(e) => setGridCols(Math.max(1, parseInt(e.target.value, 10) || 1))}
                style={{ width: '46px', padding: '3px 6px', background: '#1e293b', border: '1px solid #475569', borderRadius: '4px', color: '#fff', fontSize: '0.82rem', textAlign: 'center' }}
              />
            </div>

            {/* 一鍵產生自訂網格按鈕 */}
            <button
              onClick={() => handleGenerateGrid(gridRows, gridCols)}
              disabled={!cameraActive}
              style={{
                padding: '6px 14px',
                background: cameraActive ? 'linear-gradient(135deg, #0284c7, #2563eb)' : 'rgba(255,255,255,0.05)',
                color: cameraActive ? '#fff' : '#64748b',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: cameraActive ? 'pointer' : 'not-allowed',
                boxShadow: cameraActive ? '0 2px 8px rgba(37, 99, 235, 0.3)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              生成網格 (共 {totalGridSeats} 席)
            </button>

            {/* 常用尺寸快速選擇 */}
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              {[
                { r: 2, c: 2, label: '2×2' },
                { r: 2, c: 3, label: '2×3' },
                { r: 3, c: 3, label: '3×3' },
                { r: 4, c: 5, label: '4×5' },
                { r: 5, c: 6, label: '5×6' },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    setGridRows(item.r);
                    setGridCols(item.c);
                    handleGenerateGrid(item.r, item.c);
                  }}
                  disabled={!cameraActive}
                  style={{
                    padding: '4px 8px',
                    background: 'rgba(255,255,255,0.06)',
                    color: cameraActive ? '#cbd5e1' : '#64748b',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '4px',
                    fontSize: '0.76rem',
                    cursor: cameraActive ? 'pointer' : 'not-allowed',
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <button onClick={handleClearAllSeats} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
              <Trash2 size={13} /> 清空
            </button>
          </div>

          {/* 相機裝置切換 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Camera size={16} color="var(--accent-primary)" />
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              style={{ padding: '5px 10px', borderRadius: '6px', background: '#0f172a', color: '#fff', border: '1px solid #334155', fontSize: '0.8rem' }}
            >
              {devices.map((d, index) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `相機 #${index + 1}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 主畫布區 (等比例縮放鏡頭畫面) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '20px' }}>
          {/* 畫布容器 */}
          <div
            ref={containerRef}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: `${aspectVal}`,
              borderRadius: '12px',
              overflow: 'hidden',
              border: cameraActive ? '2px solid rgba(59, 130, 246, 0.4)' : '2px dashed #ef4444',
              userSelect: 'none',
              cursor: cameraActive ? 'crosshair' : 'not-allowed',
              background: '#090d16',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* 底層相機即時視訊預覽 (等比例縮放呈現) */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={(e) => {
                const target = e.currentTarget;
                if (target.videoWidth > 0 && target.videoHeight > 0) {
                  setVideoDims({
                    width: target.videoWidth,
                    height: target.videoHeight,
                  });
                }
              }}
              style={{
                display: cameraActive ? 'block' : 'none',
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                pointerEvents: 'none',
              }}
            />

            {/* 無相機時的遮罩與提示 (禁止劃位) */}
            {!cameraActive && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(15, 23, 42, 0.95)',
                  color: '#94a3b8',
                  padding: '30px',
                  textAlign: 'center',
                  gap: '12px',
                  zIndex: 20,
                  pointerEvents: 'none',
                }}
              >
                <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.15)', borderRadius: '50%', color: '#ef4444' }}>
                  <AlertTriangle size={36} />
                </div>
                <div>
                  <h4 style={{ color: '#ef4444', margin: '0 0 6px 0', fontSize: '1.1rem' }}>尚未偵測到相機畫面</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1' }}>
                    請先啟動相機鏡頭，系統需依據現場鏡頭等比畫面方可進行劃位。
                  </p>
                </div>
              </div>
            )}

            {/* 繪製現有座位 (百分比定位，支援選取、拖曳移動與邊角縮放) */}
            {config.seats.map((seat, idx) => {
              const isSelected = selectedSeatIndex === idx;
              const sp = getSeatPct(seat);

              return (
                <div
                  key={idx}
                  onMouseDown={(e) => handleSeatMouseDown(e, idx)}
                  style={{
                    position: 'absolute',
                    left: `${sp.x}%`,
                    top: `${sp.y}%`,
                    width: `${sp.width}%`,
                    height: `${sp.height}%`,
                    border: isSelected ? '2.5px solid #38bdf8' : '2px dashed rgba(59, 130, 246, 0.85)',
                    background: isSelected ? 'rgba(56, 189, 248, 0.3)' : 'rgba(59, 130, 246, 0.15)',
                    borderRadius: '8px',
                    boxSizing: 'border-box',
                    pointerEvents: cameraActive ? 'auto' : 'none',
                    cursor: cameraActive ? (isSelected ? 'move' : 'pointer') : 'default',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    zIndex: isSelected ? 16 : 12,
                    boxShadow: isSelected ? '0 0 16px rgba(56, 189, 248, 0.6)' : 'none',
                    transition: interactionMode === 'NONE' ? 'border 0.15s, background 0.15s' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pointerEvents: 'none' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 'bold', background: isSelected ? '#38bdf8' : '#3b82f6', color: '#0f172a', padding: '2px 7px', borderRadius: '4px', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }}>
                      {seat.seat_id}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.74rem', color: '#e2e8f0', textShadow: '0 1px 3px rgba(0,0,0,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500, pointerEvents: 'none' }}>
                    {seat.name}
                  </span>

                  {/* 選取狀態下的 4 個角落縮放把手 (Resize Handles) */}
                  {isSelected && cameraActive && (
                    <>
                      {/* 左上 (nw) */}
                      <div
                        onMouseDown={(e) => handleResizeHandleMouseDown(e, 'nw', idx)}
                        style={{
                          position: 'absolute',
                          top: '-6px',
                          left: '-6px',
                          width: '12px',
                          height: '12px',
                          background: '#fff',
                          border: '2px solid #38bdf8',
                          borderRadius: '50%',
                          cursor: 'nwse-resize',
                          zIndex: 20,
                          boxShadow: '0 0 6px rgba(0,0,0,0.5)',
                        }}
                      />
                      {/* 右上 (ne) */}
                      <div
                        onMouseDown={(e) => handleResizeHandleMouseDown(e, 'ne', idx)}
                        style={{
                          position: 'absolute',
                          top: '-6px',
                          right: '-6px',
                          width: '12px',
                          height: '12px',
                          background: '#fff',
                          border: '2px solid #38bdf8',
                          borderRadius: '50%',
                          cursor: 'nesw-resize',
                          zIndex: 20,
                          boxShadow: '0 0 6px rgba(0,0,0,0.5)',
                        }}
                      />
                      {/* 左下 (sw) */}
                      <div
                        onMouseDown={(e) => handleResizeHandleMouseDown(e, 'sw', idx)}
                        style={{
                          position: 'absolute',
                          bottom: '-6px',
                          left: '-6px',
                          width: '12px',
                          height: '12px',
                          background: '#fff',
                          border: '2px solid #38bdf8',
                          borderRadius: '50%',
                          cursor: 'nesw-resize',
                          zIndex: 20,
                          boxShadow: '0 0 6px rgba(0,0,0,0.5)',
                        }}
                      />
                      {/* 右下 (se) */}
                      <div
                        onMouseDown={(e) => handleResizeHandleMouseDown(e, 'se', idx)}
                        style={{
                          position: 'absolute',
                          bottom: '-6px',
                          right: '-6px',
                          width: '12px',
                          height: '12px',
                          background: '#fff',
                          border: '2px solid #38bdf8',
                          borderRadius: '50%',
                          cursor: 'nwse-resize',
                          zIndex: 20,
                          boxShadow: '0 0 6px rgba(0,0,0,0.5)',
                        }}
                      />
                    </>
                  )}
                </div>
              );
            })}

            {/* 繪製正在拖拉中的框 (百分比) */}
            {currentDrawRectPct && (
              <div
                style={{
                  position: 'absolute',
                  left: `${currentDrawRectPct.x}%`,
                  top: `${currentDrawRectPct.y}%`,
                  width: `${currentDrawRectPct.width}%`,
                  height: `${currentDrawRectPct.height}%`,
                  border: '2px solid #10b981',
                  background: 'rgba(16, 185, 129, 0.25)',
                  borderRadius: '8px',
                  pointerEvents: 'none',
                  zIndex: 18,
                }}
              />
            )}
          </div>

          {/* 右側座位屬性編輯欄 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: 'rgba(15, 23, 42, 0.5)', padding: '16px', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px', margin: 0 }}>
              座位詳細資訊
            </h3>

            {selectedSeatIndex !== null && config.seats[selectedSeatIndex] ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    座號 ID (如 1, 2, 01 等純數字)
                  </label>
                  <input
                    type="text"
                    value={config.seats[selectedSeatIndex].seat_id}
                    onChange={(e) => handleUpdateSeatInfo(selectedSeatIndex, 'seat_id', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    座位描述名稱
                  </label>
                  <input
                    type="text"
                    value={config.seats[selectedSeatIndex].name}
                    onChange={(e) => handleUpdateSeatInfo(selectedSeatIndex, 'name', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '10px', borderRadius: '8px', fontSize: '0.78rem', color: '#cbd5e1' }}>
                  <div style={{ fontWeight: 600, color: '#38bdf8', marginBottom: '4px' }}>💡 調整提示：</div>
                  <div>• 拖曳框框內部可平移位置</div>
                  <div>• 拖曳四角圓點可自訂大小</div>
                </div>

                <button
                  onClick={() => handleDeleteSeat(selectedSeatIndex)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', cursor: 'pointer', marginTop: '6px' }}
                >
                  <Trash2 size={16} /> 刪除此座位
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '180px', color: 'var(--text-secondary)', textAlign: 'center', gap: '8px', fontSize: '0.82rem' }}>
                <Info size={24} style={{ opacity: 0.5 }} />
                <span>
                  {!cameraActive
                    ? '請先啟動相機鏡頭以進行劃位。'
                    : config.seats.length === 0
                      ? '目前尚未配置任何座位，請在上方自訂網格生成，或在相機畫面上拖曳拉框劃位。'
                      : '點選左側座位框可進行拖曳移動或拉伸縮放；在空白處拖曳可新增座位。'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer 操作按鈕 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
          <div>
            {savedNotice && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '0.85rem' }}>
                <Check size={16} /> 課堂節次與座位設置已儲存！
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={onClose} style={{ padding: '10px 18px', background: '#334155', color: '#fff', borderRadius: '8px', fontWeight: 500, cursor: 'pointer' }}>
              關閉
            </button>
            <button
              onClick={handleSave}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 24px', background: 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)',
                color: '#fff', borderRadius: '8px', fontWeight: 600,
                boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)',
                cursor: 'pointer',
              }}
            >
              <Save size={18} /> 儲存劃位配置 ({config.seats.length} 席 · {period})
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default SeatMapEditorModal;
