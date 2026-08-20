// TEAM_008: 視覺化座位劃位與座號設置編輯器 (SeatMapEditorModal.jsx)
// 全新百分比絕對座標系統：
// 1. 完全以畫面百分比 (0% ~ 100%) 作為唯一基準，拖拉哪裡就畫在哪裡，徹底消除不同解析度與長寬比的座標錯位！
// 2. 視訊畫面零裁切，畫布自動適應鏡頭真實長寬比。
// 3. 支援課堂節次編輯與 Lucide-react 圖示。

import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Trash2, Grid, Save, LayoutGrid, Check, Info, Camera, GraduationCap, Calendar, Clock } from 'lucide-react';
import { getSavedSeatsConfig, saveSeatsConfig, generateGridSeats, formatFullPeriodMessage } from '../services/seatOccupancyService';

export const SeatMapEditorModal = ({ isOpen, onClose, onSaveSuccess }) => {
  const [config, setConfig] = useState(getSavedSeatsConfig());
  const [period, setPeriod] = useState(config.current_period || '第 1 節');
  const [selectedSeatIndex, setSelectedSeatIndex] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStartPct, setDrawStartPct] = useState({ x: 0, y: 0 });
  const [currentDrawRectPct, setCurrentDrawRectPct] = useState(null);
  const [savedNotice, setSavedNotice] = useState(false);

  // 相機真實比例與狀態
  const [camAspect, setCamAspect] = useState(4 / 3);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const containerRef = useRef(null);

  // 取得可用相機裝置清單
  const getCameraDevices = async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices.filter((device) => device.kind === 'videoinput');
      setDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
    } catch (err) {
      console.warn('[SeatMapEditor] Enumerate devices warning:', err);
    }
  };

  // 啟動相機串流
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
      console.warn('[SeatMapEditor] Camera start error:', err);
      setCameraError('無法開啟相機預覽（仍可手動劃位）。');
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

  // 計算座標百分比工具
  const getPointPct = (e) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    return { x: xPct, y: yPct };
  };

  // 取得座位的百分比座標 (相容舊資料)
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
    // 舊資料像素 fallback
    const bw = config.base_width || 640;
    const bh = config.base_height || 480;
    return {
      x: (roi.x / bw) * 100,
      y: (roi.y / bh) * 100,
      width: (roi.width / bw) * 100,
      height: (roi.height / bh) * 100,
    };
  };

  // 滑鼠按下：開始拖拉或選取座位
  const handleMouseDown = (e) => {
    const { x: clickX, y: clickY } = getPointPct(e);

    // 檢查是否點擊到現有座位
    const clickedIndex = config.seats.findIndex((seat) => {
      const sp = getSeatPct(seat);
      return clickX >= sp.x && clickX <= sp.x + sp.width && clickY >= sp.y && clickY <= sp.y + sp.height;
    });

    if (clickedIndex !== -1) {
      setSelectedSeatIndex(clickedIndex);
      setIsDrawing(false);
      return;
    }

    // 開始繪製新座位框
    setIsDrawing(true);
    setDrawStartPct({ x: clickX, y: clickY });
    setCurrentDrawRectPct({ x: clickX, y: clickY, width: 0, height: 0 });
    setSelectedSeatIndex(null);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing) return;
    const { x: currX, y: currY } = getPointPct(e);

    const x = Math.min(drawStartPct.x, currX);
    const y = Math.min(drawStartPct.y, currY);
    const width = Math.abs(currX - drawStartPct.x);
    const height = Math.abs(currY - drawStartPct.y);

    setCurrentDrawRectPct({ x, y, width, height });
  };

  const handleMouseUp = () => {
    if (isDrawing && currentDrawRectPct && currentDrawRectPct.width > 3 && currentDrawRectPct.height > 3) {
      const nextNum = config.seats.length + 1;
      const xPct = parseFloat(currentDrawRectPct.x.toFixed(2));
      const yPct = parseFloat(currentDrawRectPct.y.toFixed(2));
      const wPct = parseFloat(currentDrawRectPct.width.toFixed(2));
      const hPct = parseFloat(currentDrawRectPct.height.toFixed(2));

      const newSeat = {
        seat_id: `A-${String(nextNum).padStart(2, '0')}`,
        name: `座位 #${nextNum}`,
        roi: {
          x_pct: xPct,
          y_pct: yPct,
          width_pct: wPct,
          height_pct: hPct,
          // 相容舊後端像素結構
          x: Math.round((xPct / 100) * 640),
          y: Math.round((yPct / 100) * 480),
          width: Math.round((wPct / 100) * 640),
          height: Math.round((hPct / 100) * 480),
        },
      };

      const updated = {
        ...config,
        seats: [...config.seats, newSeat],
      };
      setConfig(updated);
      setSelectedSeatIndex(updated.seats.length - 1);
    }
    setIsDrawing(false);
    setCurrentDrawRectPct(null);
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

  // 一鍵產生網格佈局
  const handleGenerateGrid = (rows, cols) => {
    const newSeats = generateGridSeats(rows, cols, 640, 480);
    setConfig({
      ...config,
      seats: newSeats,
    });
    setSelectedSeatIndex(null);
  };

  // 儲存配置
  const handleSave = () => {
    const toSave = {
      ...config,
      current_period: period || '第 1 節',
    };
    saveSeatsConfig(toSave);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
    if (onSaveSuccess) onSaveSuccess(toSave);
  };

  const currentFormattedPeriod = formatFullPeriodMessage(period);

  const modalContent = (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '1000px',
          maxHeight: '94vh',
          overflowY: 'auto',
          background: '#1e293b',
          borderRadius: '16px',
          color: '#fff',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          border: '1px solid var(--glass-border)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <LayoutGrid size={24} color="var(--accent-primary)" />
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                視覺化座位劃位與課堂設置
                {cameraActive && (
                  <span style={{ fontSize: '0.75rem', background: '#0284c7', color: '#e0f2fe', padding: '2px 8px', borderRadius: '12px' }}>
                    相機原始視野
                  </span>
                )}
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                請直接在即時畫面上拖曳拉框劃位 (已配置 {config.seats.length} 席)
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

        {/* 快捷排版與相機設定列 */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', background: 'rgba(15, 23, 42, 0.6)', padding: '10px 16px', borderRadius: '10px', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Grid size={16} /> 快速生成網格：
            </span>
            <button onClick={() => handleGenerateGrid(2, 2)} style={{ padding: '5px 12px', background: '#334155', color: '#fff', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
              2 × 2 (4 席)
            </button>
            <button onClick={() => handleGenerateGrid(2, 3)} style={{ padding: '5px 12px', background: '#334155', color: '#fff', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
              2 × 3 (6 席)
            </button>
            <button onClick={() => handleGenerateGrid(3, 3)} style={{ padding: '5px 12px', background: '#334155', color: '#fff', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
              3 × 3 (9 席)
            </button>
            <button onClick={handleClearAllSeats} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
              <Trash2 size={13} /> 清空所有座位
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

        {/* 主畫布區 (百分比精確疊加) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '20px' }}>
          {/* 畫布容器 */}
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: `${camAspect}`,
              background: '#090d16',
              borderRadius: '12px',
              overflow: 'hidden',
              border: '2px solid rgba(59, 130, 246, 0.4)',
              userSelect: 'none',
              cursor: 'crosshair',
            }}
          >
            {/* 底層相機即時視訊預覽 */}
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
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                pointerEvents: 'none',
                display: cameraActive ? 'block' : 'none',
              }}
            />

            {!cameraActive && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: '8px', pointerEvents: 'none' }}>
                <Camera size={32} style={{ opacity: 0.4 }} />
                <span style={{ fontSize: '0.85rem' }}>{cameraError || '正在連線相機預覽畫面...'}</span>
              </div>
            )}

            {/* 繪製現有座位 (百分比定位) */}
            {config.seats.map((seat, idx) => {
              const isSelected = selectedSeatIndex === idx;
              const sp = getSeatPct(seat);

              return (
                <div
                  key={idx}
                  style={{
                    position: 'absolute',
                    left: `${sp.x}%`,
                    top: `${sp.y}%`,
                    width: `${sp.width}%`,
                    height: `${sp.height}%`,
                    border: isSelected ? '2.5px solid #38bdf8' : '2px dashed rgba(59, 130, 246, 0.85)',
                    background: isSelected ? 'rgba(56, 189, 248, 0.25)' : 'rgba(59, 130, 246, 0.12)',
                    borderRadius: '8px',
                    boxSizing: 'border-box',
                    pointerEvents: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    zIndex: 12,
                    boxShadow: isSelected ? '0 0 14px rgba(56, 189, 248, 0.5)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 'bold', background: isSelected ? '#38bdf8' : '#3b82f6', color: '#0f172a', padding: '2px 7px', borderRadius: '4px', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }}>
                      {seat.seat_id}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.74rem', color: '#e2e8f0', textShadow: '0 1px 3px rgba(0,0,0,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                    {seat.name}
                  </span>
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
                  zIndex: 15,
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
                    座號 ID (如 A-01, 1號桌)
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

                <button
                  onClick={() => handleDeleteSeat(selectedSeatIndex)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', cursor: 'pointer', marginTop: '10px' }}
                >
                  <Trash2 size={16} /> 刪除此座位
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '180px', color: 'var(--text-secondary)', textAlign: 'center', gap: '8px', fontSize: '0.82rem' }}>
                <Info size={24} style={{ opacity: 0.5 }} />
                <span>
                  {config.seats.length === 0
                    ? '目前尚未配置任何座位，請在左側相機畫面上滑鼠拖曳拉框劃位。'
                    : '請在左側畫面上點選座位，或拖曳框選新座位。'}
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
