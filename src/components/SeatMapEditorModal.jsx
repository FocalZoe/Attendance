// TEAM_008: 視覺化座位區域標定編輯器 (SeatMapEditorModal.jsx)
// 支援互動式滑鼠框選、座號自訂命名、網格一鍵產生與配置儲存

import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Plus, Trash2, Grid, RotateCcw, Save, LayoutGrid, Check, Info } from 'lucide-react';
import { getSavedSeatsConfig, saveSeatsConfig, generateGridSeats, DEFAULT_SEATS_CONFIG } from '../services/seatOccupancyService';

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 360;

export const SeatMapEditorModal = ({ isOpen, onClose, onSaveSuccess }) => {
  const [config, setConfig] = useState(getSavedSeatsConfig());
  const [selectedSeatIndex, setSelectedSeatIndex] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [currentDrawRect, setCurrentDrawRect] = useState(null);
  const [savedNotice, setSavedNotice] = useState(false);

  const canvasRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setConfig(getSavedSeatsConfig());
      setSelectedSeatIndex(null);
      setSavedNotice(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 滑鼠在畫布上拖曳框選新座位
  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const x = Math.max(0, Math.min(CANVAS_WIDTH, (e.clientX - rect.left) * scaleX));
    const y = Math.max(0, Math.min(CANVAS_HEIGHT, (e.clientY - rect.top) * scaleY));

    // 檢查是否點擊到了現有座位
    const clickedIndex = config.seats.findIndex((seat) => {
      const { roi } = seat;
      return x >= roi.x && x <= roi.x + roi.width && y >= roi.y && y <= roi.y + roi.height;
    });

    if (clickedIndex !== -1) {
      setSelectedSeatIndex(clickedIndex);
      setIsDrawing(false);
      return;
    }

    setIsDrawing(true);
    setDrawStart({ x, y });
    setCurrentDrawRect({ x, y, width: 0, height: 0 });
    setSelectedSeatIndex(null);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const currentX = Math.max(0, Math.min(CANVAS_WIDTH, (e.clientX - rect.left) * scaleX));
    const currentY = Math.max(0, Math.min(CANVAS_HEIGHT, (e.clientY - rect.top) * scaleY));

    const x = Math.min(drawStart.x, currentX);
    const y = Math.min(drawStart.y, currentY);
    const width = Math.abs(currentX - drawStart.x);
    const height = Math.abs(currentY - drawStart.y);

    setCurrentDrawRect({ x, y, width, height });
  };

  const handleMouseUp = () => {
    if (isDrawing && currentDrawRect && currentDrawRect.width > 25 && currentDrawRect.height > 25) {
      const nextNum = config.seats.length + 1;
      const newSeat = {
        seat_id: `S-${String(nextNum).padStart(2, '0')}`,
        name: `座位 #${nextNum}`,
        roi: {
          x: Math.round(currentDrawRect.x),
          y: Math.round(currentDrawRect.y),
          width: Math.round(currentDrawRect.width),
          height: Math.round(currentDrawRect.height),
        },
      };

      const updated = { ...config, seats: [...config.seats, newSeat] };
      setConfig(updated);
      setSelectedSeatIndex(updated.seats.length - 1);
    }
    setIsDrawing(false);
    setCurrentDrawRect(null);
  };

  // 刪除選取座位
  const handleDeleteSeat = (index) => {
    const updatedSeats = config.seats.filter((_, i) => i !== index);
    setConfig({ ...config, seats: updatedSeats });
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
    const grid = generateGridSeats(rows, cols, CANVAS_WIDTH, CANVAS_HEIGHT);
    setConfig(grid);
    setSelectedSeatIndex(null);
  };

  // 重置為預設值
  const handleResetDefaults = () => {
    setConfig(DEFAULT_SEATS_CONFIG);
    setSelectedSeatIndex(null);
  };

  // 儲存配置
  const handleSave = () => {
    saveSeatsConfig(config);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
    if (onSaveSuccess) onSaveSuccess(config);
  };

  const modalContent = (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.85)',
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
          maxWidth: '960px',
          maxHeight: '92vh',
          overflowY: 'auto',
          background: '#1e293b',
          borderRadius: '16px',
          color: '#fff',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
          border: '1px solid var(--glass-border)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <LayoutGrid size={24} color="var(--accent-primary)" />
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
                視覺化座位劃位與座號設置
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                在畫布上拖曳可框選新座位，點擊座位可編輯座號編號 (目前已配置 {config.seats.length} 席)
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={22} />
          </button>
        </div>

        {/* 快捷排版工具列 */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', background: 'rgba(15, 23, 42, 0.6)', padding: '10px 16px', borderRadius: '10px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Grid size={16} /> 快速生成網格：
          </span>
          <button onClick={() => handleGenerateGrid(2, 2)} style={{ padding: '6px 12px', background: '#334155', color: '#fff', borderRadius: '6px', fontSize: '0.8rem' }}>
            2 × 2 (4 席)
          </button>
          <button onClick={() => handleGenerateGrid(2, 3)} style={{ padding: '6px 12px', background: '#334155', color: '#fff', borderRadius: '6px', fontSize: '0.8rem' }}>
            2 × 3 (6 席)
          </button>
          <button onClick={() => handleGenerateGrid(3, 3)} style={{ padding: '6px 12px', background: '#334155', color: '#fff', borderRadius: '6px', fontSize: '0.8rem' }}>
            3 × 3 (9 席)
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <button onClick={handleResetDefaults} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', background: 'transparent', border: '1px solid #475569', color: '#94a3b8', borderRadius: '6px', fontSize: '0.8rem' }}>
              <RotateCcw size={14} /> 恢復預設
            </button>
          </div>
        </div>

        {/* 主畫布區與右側設定欄 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '20px' }}>
          {/* 畫布容器 */}
          <div style={{ position: 'relative', width: '100%', aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}`, background: '#090d16', borderRadius: '12px', overflow: 'hidden', border: '2px solid rgba(59, 130, 246, 0.3)', userSelect: 'none' }}>
            <div
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              style={{ position: 'absolute', inset: 0, cursor: 'crosshair', zIndex: 10 }}
            />

            {/* 網格底圖導引線 */}
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none' }} />

            {/* 繪製現有座位 */}
            {config.seats.map((seat, idx) => {
              const isSelected = selectedSeatIndex === idx;
              const leftPct = (seat.roi.x / CANVAS_WIDTH) * 100;
              const topPct = (seat.roi.y / CANVAS_HEIGHT) * 100;
              const widthPct = (seat.roi.width / CANVAS_WIDTH) * 100;
              const heightPct = (seat.roi.height / CANVAS_HEIGHT) * 100;

              return (
                <div
                  key={idx}
                  style={{
                    position: 'absolute',
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    width: `${widthPct}%`,
                    height: `${heightPct}%`,
                    border: isSelected ? '2.5px solid #38bdf8' : '2px dashed rgba(59, 130, 246, 0.7)',
                    background: isSelected ? 'rgba(56, 189, 248, 0.18)' : 'rgba(59, 130, 246, 0.08)',
                    borderRadius: '8px',
                    boxSizing: 'border-box',
                    pointerEvents: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    transition: 'border 0.2s, background 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', background: isSelected ? '#38bdf8' : '#3b82f6', color: '#0f172a', padding: '2px 6px', borderRadius: '4px' }}>
                      {seat.seat_id}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {seat.name}
                  </span>
                </div>
              );
            })}

            {/* 繪製正在拖拉中的框 */}
            {currentDrawRect && (
              <div
                style={{
                  position: 'absolute',
                  left: `${(currentDrawRect.x / CANVAS_WIDTH) * 100}%`,
                  top: `${(currentDrawRect.y / CANVAS_HEIGHT) * 100}%`,
                  width: `${(currentDrawRect.width / CANVAS_WIDTH) * 100}%`,
                  height: `${(currentDrawRect.height / CANVAS_HEIGHT) * 100}%`,
                  border: '2px solid #10b981',
                  background: 'rgba(16, 185, 129, 0.2)',
                  borderRadius: '8px',
                  pointerEvents: 'none',
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
                    座號 ID (如 A-01, B-02)
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

                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  座標 ROI: [{config.seats[selectedSeatIndex].roi.x}, {config.seats[selectedSeatIndex].roi.y}] ({config.seats[selectedSeatIndex].roi.width} × {config.seats[selectedSeatIndex].roi.height})
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
                <span>請在左側畫布點選座位，或以滑鼠框選新座位。</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer 操作按鈕 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
          <div>
            {savedNotice && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '0.85rem' }}>
                <Check size={16} /> 座位設置已成功儲存！
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={onClose} style={{ padding: '10px 18px', background: '#334155', color: '#fff', borderRadius: '8px', fontWeight: 500 }}>
              關閉
            </button>
            <button
              onClick={handleSave}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 24px', background: 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)',
                color: '#fff', borderRadius: '8px', fontWeight: 600,
                boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)',
              }}
            >
              <Save size={18} /> 儲存劃位配置
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default SeatMapEditorModal;
