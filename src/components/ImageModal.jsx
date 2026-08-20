// TEAM_008: 考勤照片大圖檢視 Modal (ImageModal.jsx)
// 升級重點：
// 1. 新增視覺化標註切換工具列 (All / Vacant / Occupied / Raw)，可隨時切換是否顯示框選位置與在座狀況！
// 2. 頂部資訊列以 Lucide Icons 顯示「幾月幾號第幾節」與通報時間戳記。
// 3. 圖片維持乾淨純圖，所有標註與時間皆由 UI 彈性疊加。

import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Calendar, Clock, GraduationCap, UserCheck, UserX, Eye, EyeOff, Layers, Sparkles, Filter } from 'lucide-react';

const ImageModal = ({ record, imageUrl, title, onClose }) => {
  const [imgSize, setImgSize] = useState({ width: 640, height: 480 });
  // 視覺化顯示模式：'all' (全部座位) | 'vacant' (僅未到) | 'occupied' (僅在座) | 'raw' (純淨照片/隱藏標註)
  const [viewMode, setViewMode] = useState('all');
  const [showPersonBoxes, setShowPersonBoxes] = useState(true);

  const targetRecord = record && typeof record === 'object' ? record : null;
  const targetUrl = targetRecord ? targetRecord.file_url : imageUrl;

  if (!targetUrl) return null;

  // 解析 ai_analysis
  let aiAnalysis = targetRecord?.ai_analysis;
  if (typeof aiAnalysis === 'string') {
    try {
      aiAnalysis = JSON.parse(aiAnalysis);
    } catch (e) {
      aiAnalysis = undefined;
    }
  }

  const seatStatuses = Array.isArray(aiAnalysis?.seat_statuses) ? aiAnalysis.seat_statuses : [];
  const persons = Array.isArray(aiAnalysis?.persons)
    ? aiAnalysis.persons
    : Array.isArray(aiAnalysis?.faces)
      ? aiAnalysis.faces
      : [];

  const occupiedSeats = seatStatuses.filter((s) => s.status === 'OCCUPIED');
  const vacantSeats = seatStatuses.filter((s) => s.status === 'VACANT');

  const aspect = imgSize.width / imgSize.height;

  const formattedTime = targetRecord?.create_at
    ? new Date(targetRecord.create_at).toLocaleString('zh-TW', { hour12: false })
    : '';

  const periodMessage = targetRecord?.message || title || '課堂點名紀錄';

  // 根據當前切換模式過濾要渲染的座位清單
  const filteredSeatsToDraw = seatStatuses.filter((st) => {
    if (viewMode === 'raw') return false;
    if (viewMode === 'vacant') return st.status === 'VACANT';
    if (viewMode === 'occupied') return st.status === 'OCCUPIED';
    return true; // 'all'
  });

  const modalContent = (
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
        padding: '20px',
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
          marginBottom: '12px',
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
                <UserX size={13} /> 未到: {vacantSeats.map(s => s.seat_id).join(', ')} ({vacantSeats.length})
              </span>
            )}
          </div>
        </div>

        {/* 中間：視覺化切換開關工具列 (Toggle Overlay Mode) */}
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
            全部位置 ({seatStatuses.length})
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

      {/* 照片與座位覆蓋層 */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          maxWidth: '94vw',
          maxHeight: '80vh',
          aspectRatio: `${aspect}`,
          borderRadius: '16px',
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
              setImgSize({
                width: target.naturalWidth,
                height: target.naturalHeight,
              });
            }
          }}
          style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
        />

        {/* 繪製人員邊框 (藍色虛線框，當 viewMode !== 'raw' 時可顯示) */}
        {viewMode !== 'raw' && showPersonBoxes && persons.map((person, idx) => {
          const box = person.bounding_box || person;
          if (!box || typeof box.x !== 'number' || !box.width || box.width <= 0) return null;

          const baseW = box.base_width || 640;
          const baseH = box.base_height || 360;

          const leftPct = (box.x / baseW) * 100;
          const topPct = (box.y / baseH) * 100;
          const widthPct = (box.width / baseW) * 100;
          const heightPct = (box.height / baseH) * 100;

          return (
            <div
              key={`p-${idx}`}
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

        {/* 繪製各座號區域框 (依據切換模式動態呈現 🟢 在座 / ❌ 未到) */}
        {filteredSeatsToDraw.map((st, index) => {
          const roi = st.person_box || st.roi;
          if (!roi || typeof roi.x !== 'number' || !roi.width || roi.width <= 0) return null;

          const isOcc = st.status === 'OCCUPIED';
          const leftPct = (roi.x / 640) * 100;
          const topPct = (roi.y / 360) * 100;
          const widthPct = (roi.width / 640) * 100;
          const heightPct = (roi.height / 360) * 100;

          const labelText = isOcc
            ? `🟢 [${st.seat_id}] 在座`
            : `❌ [${st.seat_id}] 未到`;

          return (
            <div
              key={`seat-${index}-${st.seat_id}`}
              style={{
                position: 'absolute',
                left: `${leftPct}%`,
                top: `${topPct}%`,
                width: `${widthPct}%`,
                height: `${heightPct}%`,
                border: isOcc ? '2.5px solid #10b981' : '2.5px dashed #ef4444',
                background: isOcc ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.18)',
                borderRadius: '8px',
                boxSizing: 'border-box',
                pointerEvents: 'none',
                zIndex: 15,
                transition: 'all 0.25s ease',
              }}
            >
              {/* 四角 L 型邊框 */}
              {isOcc ? (
                <>
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '12px', height: '12px', borderTop: '3.5px solid #10b981', borderLeft: '3.5px solid #10b981' }} />
                  <div style={{ position: 'absolute', top: 0, right: 0, width: '12px', height: '12px', borderTop: '3.5px solid #10b981', borderRight: '3.5px solid #10b981' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, width: '12px', height: '12px', borderBottom: '3.5px solid #10b981', borderLeft: '3.5px solid #10b981' }} />
                  <div style={{ position: 'absolute', bottom: 0, right: 0, width: '12px', height: '12px', borderBottom: '3.5px solid #10b981', borderRight: '3.5px solid #10b981' }} />
                </>
              ) : (
                <>
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '12px', height: '12px', borderTop: '3.5px solid #ef4444', borderLeft: '3.5px solid #ef4444' }} />
                  <div style={{ position: 'absolute', top: 0, right: 0, width: '12px', height: '12px', borderTop: '3.5px solid #ef4444', borderRight: '3.5px solid #ef4444' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, width: '12px', height: '12px', borderBottom: '3.5px solid #ef4444', borderLeft: '3.5px solid #ef4444' }} />
                  <div style={{ position: 'absolute', bottom: 0, right: 0, width: '12px', height: '12px', borderBottom: '3.5px solid #ef4444', borderRight: '3.5px solid #ef4444' }} />
                </>
              )}

              {/* 座號狀態標籤 */}
              <div style={{
                position: 'absolute',
                top: topPct > 8 ? '-26px' : '4px',
                left: '4px',
                background: isOcc ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)',
                color: '#ffffff',
                border: `1px solid ${isOcc ? '#10b981' : '#ef4444'}`,
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '0.78rem',
                fontWeight: 'bold',
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              }}>
                {labelText}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default ImageModal;
