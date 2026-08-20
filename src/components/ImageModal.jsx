// TEAM_008: 考勤照片大圖檢視 Modal (ImageModal.jsx)
// 核心原則：
// 1. 100% 讀取 Database (ai_analysis) 與本機儲存之真實座位 ROI 座標進行繪製。
// 2. 嚴禁任何 Mock 或假邊框，百分比釘位與劃位編輯器完全 1:1 絕對相符。

import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Calendar, Clock, GraduationCap, UserCheck, UserX, Eye, EyeOff, Layers, Sparkles, Filter } from 'lucide-react';
import { getSavedSeatsConfig } from '../services/seatOccupancyService';

const ImageModal = ({ record, imageUrl, title, onClose }) => {
  const [imgNaturalSize, setImgNaturalSize] = useState({ width: 0, height: 0 });
  const [viewMode, setViewMode] = useState('all');
  const [showPersonBoxes, setShowPersonBoxes] = useState(true);

  const targetRecord = record && typeof record === 'object' ? record : null;
  const targetUrl = targetRecord ? targetRecord.file_url : imageUrl;

  if (!targetUrl) return null;

  // 1. 解析 ai_analysis (從 Database 讀取真實分析資料)
  let aiAnalysis = targetRecord?.ai_analysis;
  if (typeof aiAnalysis === 'string') {
    try {
      aiAnalysis = JSON.parse(aiAnalysis);
    } catch (e) {
      aiAnalysis = undefined;
    }
  }

  // 取得本地儲存的座位配置作為座標 fallback
  const savedConfig = getSavedSeatsConfig();
  const configuredSeats = savedConfig.seats || [];

  // 2. 整理座位狀態清單
  let rawStatuses = Array.isArray(aiAnalysis?.seat_statuses) ? aiAnalysis.seat_statuses : [];
  if (rawStatuses.length === 0 && configuredSeats.length > 0) {
    rawStatuses = configuredSeats.map((cs) => ({
      seat_id: cs.seat_id,
      name: cs.name,
      status: 'VACANT',
      confidence: 0,
      overlap_ratio: 0,
      roi: cs.roi,
    }));
  }

  // 為每一個座位鎖定其真實的 ROI 座標 (100% 來自 Database 或配置)
  const completeSeatStatuses = rawStatuses.map((st) => {
    const matchConfigSeat = configuredSeats.find((cs) => cs.seat_id === st.seat_id);
    let seatRoi = st.roi || matchConfigSeat?.roi;

    return {
      ...st,
      seatRoi: seatRoi || null,
    };
  });

  const persons = Array.isArray(aiAnalysis?.persons)
    ? aiAnalysis.persons
    : Array.isArray(aiAnalysis?.faces)
      ? aiAnalysis.faces
      : [];

  const occupiedSeats = completeSeatStatuses.filter((s) => s.status === 'OCCUPIED');
  const vacantSeats = completeSeatStatuses.filter((s) => s.status === 'VACANT');

  const formattedTime = targetRecord?.create_at
    ? new Date(targetRecord.create_at).toLocaleString('zh-TW', { hour12: false })
    : '';

  const periodMessage = targetRecord?.message || title || '課堂點名紀錄';

  // 依據標註模式過濾要渲染的座位清單
  const filteredSeatsToDraw = completeSeatStatuses.filter((st) => {
    if (viewMode === 'raw') return false;
    if (viewMode === 'vacant') return st.status === 'VACANT';
    if (viewMode === 'occupied') return st.status === 'OCCUPIED';
    return true; // 'all'
  });

  // 百分比解析函式：精準釘位
  const getSeatPct = (roi) => {
    if (!roi) return { x: 0, y: 0, width: 0, height: 0 };

    // 1. 如果有明確的 x_pct
    if (typeof roi.x_pct === 'number' && typeof roi.width_pct === 'number') {
      return {
        x: roi.x_pct,
        y: roi.y_pct,
        width: roi.width_pct,
        height: roi.height_pct,
      };
    }

    // 2. 如果 roi.x 與 roi.width 落在 0 ~ 100 之間（本身就是百分比）
    if (roi.x <= 100 && (roi.width || 0) <= 100 && (roi.width || 0) > 0) {
      return {
        x: roi.x,
        y: roi.y,
        width: roi.width,
        height: roi.height,
      };
    }

    // 3. 如果是像素值，以相片真實尺寸計算百分比
    const naturalW = imgNaturalSize.width || savedConfig.base_width || 1920;
    const naturalH = imgNaturalSize.height || savedConfig.base_height || 1080;
    return {
      x: (roi.x / naturalW) * 100,
      y: (roi.y / naturalH) * 100,
      width: ((roi.width || roi.w || 0) / naturalW) * 100,
      height: ((roi.height || roi.h || 0) / naturalH) * 100,
    };
  };

  return ReactDOM.createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.92)',
        backdropFilter: 'blur(14px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      {/* 頂部資訊列 (幾月幾號第幾節 + 通報時間 + 視覺化切換工具列) */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '94vw',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(15, 23, 42, 0.9)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '10px 18px',
          borderRadius: '12px',
          marginBottom: '10px',
          color: '#fff',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {/* 左側：節次與通報時間 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <GraduationCap size={20} />
            {periodMessage}
          </span>

          {formattedTime && (
            <span style={{ fontSize: '0.82rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={14} /> {formattedTime}
            </span>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
              <UserCheck size={13} /> 在座: {occupiedSeats.length}
            </span>

            {vacantSeats.length > 0 && (
              <span style={{ fontSize: '0.78rem', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
                <UserX size={13} /> 未到: {vacantSeats.map((s) => s.seat_id).join(', ')} ({vacantSeats.length})
              </span>
            )}
          </div>
        </div>

        {/* 中間：視覺化切換開關工具列 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.4)', padding: '4px 8px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
            <Layers size={14} /> 標註模式：
          </span>

          <button
            onClick={() => setViewMode('all')}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: viewMode === 'all' ? 'var(--accent-primary)' : 'transparent',
              color: viewMode === 'all' ? '#fff' : '#94a3b8',
              border: viewMode === 'all' ? '1px solid var(--accent-primary)' : '1px solid transparent',
              transition: 'all 0.2s',
            }}
          >
            全部位置 ({completeSeatStatuses.length})
          </button>

          <button
            onClick={() => setViewMode('vacant')}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: viewMode === 'vacant' ? 'rgba(239, 68, 68, 0.3)' : 'transparent',
              color: viewMode === 'vacant' ? '#ef4444' : '#94a3b8',
              border: viewMode === 'vacant' ? '1px solid #ef4444' : '1px solid transparent',
              transition: 'all 0.2s',
            }}
          >
            僅看未到 ({vacantSeats.length})
          </button>

          <button
            onClick={() => setViewMode('occupied')}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: viewMode === 'occupied' ? 'rgba(16, 185, 129, 0.3)' : 'transparent',
              color: viewMode === 'occupied' ? '#10b981' : '#94a3b8',
              border: viewMode === 'occupied' ? '1px solid #10b981' : '1px solid transparent',
              transition: 'all 0.2s',
            }}
          >
            僅看在座 ({occupiedSeats.length})
          </button>

          <button
            onClick={() => setViewMode(viewMode === 'raw' ? 'all' : 'raw')}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: viewMode === 'raw' ? '#334155' : 'transparent',
              color: viewMode === 'raw' ? '#38bdf8' : '#94a3b8',
              border: viewMode === 'raw' ? '1px solid #38bdf8' : '1px solid transparent',
              transition: 'all 0.2s',
            }}
          >
            {viewMode === 'raw' ? <EyeOff size={13} /> : <Eye size={13} />}
            {viewMode === 'raw' ? '純淨照片' : '純淨'}
          </button>
        </div>

        {/* 關閉按鈕 */}
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#ffffff',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
        >
          <X size={20} />
        </button>
      </div>

      {/* 照片與座位覆蓋容器 (完全貼合相片真實尺寸) */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          display: 'inline-block',
          maxWidth: '94vw',
          maxHeight: '82vh',
          borderRadius: '14px',
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0,0,0,0.9)',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          background: '#090d16',
        }}
      >
        {/* 原始純淨相片 */}
        <img
          src={targetUrl}
          alt={periodMessage}
          onLoad={(e) => {
            const target = e.currentTarget;
            if (target.naturalWidth > 0 && target.naturalHeight > 0) {
              setImgNaturalSize({
                width: target.naturalWidth,
                height: target.naturalHeight,
              });
            }
          }}
          style={{
            display: 'block',
            maxWidth: '94vw',
            maxHeight: '82vh',
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
          }}
        />

        {/* 繪製人員邊框 (藍色虛線框) */}
        {viewMode !== 'raw' && showPersonBoxes && persons.map((person, idx) => {
          const box = person.bounding_box || person;
          if (!box || typeof box.x !== 'number') return null;
          const bW = box.width || box.w || 0;
          const bH = box.height || box.h || 0;
          if (bW <= 0 || bH <= 0) return null;

          const pBaseW = box.base_width || (imgNaturalSize.width > 0 ? imgNaturalSize.width : 1920);
          const pBaseH = box.base_height || (imgNaturalSize.height > 0 ? imgNaturalSize.height : 1080);

          const leftPct = typeof box.x_pct === 'number' ? box.x_pct : (box.x / pBaseW) * 100;
          const topPct = typeof box.y_pct === 'number' ? box.y_pct : (box.y / pBaseH) * 100;
          const widthPct = typeof box.width_pct === 'number' ? box.width_pct : (bW / pBaseW) * 100;
          const heightPct = typeof box.height_pct === 'number' ? box.height_pct : (bH / pBaseH) * 100;

          return (
            <div
              key={`person-${idx}`}
              style={{
                position: 'absolute',
                left: `${leftPct}%`,
                top: `${topPct}%`,
                width: `${widthPct}%`,
                height: `${heightPct}%`,
                border: '2px dashed #38bdf8',
                borderRadius: '6px',
                pointerEvents: 'none',
                zIndex: 10,
              }}
            />
          );
        })}

        {/* 繪製各座號真實座位區域框 (100% 依據 Database / 設置之 ROI 繪製) */}
        {filteredSeatsToDraw.map((st, index) => {
          const sp = getSeatPct(st.seatRoi);
          if (sp.width <= 0 || sp.height <= 0) return null;

          const isOcc = st.status === 'OCCUPIED';
          const labelText = isOcc
            ? `🟢 [${st.seat_id}] 在座`
            : `❌ [${st.seat_id}] 未到`;

          return (
            <div
              key={`seat-${index}-${st.seat_id}`}
              style={{
                position: 'absolute',
                left: `${sp.x}%`,
                top: `${sp.y}%`,
                width: `${sp.width}%`,
                height: `${sp.height}%`,
                border: isOcc ? '2.5px solid #10b981' : '2px dashed #ef4444',
                background: isOcc ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.18)',
                borderRadius: '8px',
                boxSizing: 'border-box',
                pointerEvents: 'none',
                zIndex: 15,
                transition: 'all 0.2s ease',
              }}
            >
              {/* 四角 L 型邊框 */}
              {isOcc ? (
                <>
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '10px', height: '10px', borderTop: '3px solid #10b981', borderLeft: '3px solid #10b981' }} />
                  <div style={{ position: 'absolute', top: 0, right: 0, width: '10px', height: '10px', borderTop: '3px solid #10b981', borderRight: '3px solid #10b981' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, width: '10px', height: '10px', borderBottom: '3px solid #10b981', borderLeft: '3px solid #10b981' }} />
                  <div style={{ position: 'absolute', bottom: 0, right: 0, width: '10px', height: '10px', borderBottom: '3px solid #10b981', borderRight: '3px solid #10b981' }} />
                </>
              ) : (
                <>
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '10px', height: '10px', borderTop: '3px solid #ef4444', borderLeft: '3px solid #ef4444' }} />
                  <div style={{ position: 'absolute', top: 0, right: 0, width: '10px', height: '10px', borderTop: '3px solid #ef4444', borderRight: '3px solid #ef4444' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, width: '10px', height: '10px', borderBottom: '3px solid #ef4444', borderLeft: '3px solid #ef4444' }} />
                  <div style={{ position: 'absolute', bottom: 0, right: 0, width: '10px', height: '10px', borderBottom: '3px solid #ef4444', borderRight: '3px solid #ef4444' }} />
                </>
              )}

              {/* 座號狀態標籤 */}
              <div
                style={{
                  position: 'absolute',
                  top: sp.y > 8 ? '-24px' : '4px',
                  left: '4px',
                  background: isOcc ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)',
                  color: '#ffffff',
                  border: `1px solid ${isOcc ? '#10b981' : '#ef4444'}`,
                  padding: '2px 7px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                }}
              >
                {labelText}
              </div>
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  );
};

export default ImageModal;
