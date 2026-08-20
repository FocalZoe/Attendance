// TEAM_008: 考勤照片大圖檢視 Modal (ImageModal.jsx)
// 嚴禁假資料：僅依據後端回傳的真實座號 ROI 與真實人員邊框進行精準疊加，無座標時絕不捏造假邊框

import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';

const ImageModal = ({ record, imageUrl, title, onClose }) => {
  const [imgSize, setImgSize] = useState({ width: 640, height: 480 });

  const targetRecord = record && typeof record === 'object' ? record : null;
  const targetUrl = targetRecord ? targetRecord.file_url : imageUrl;

  if (!targetUrl) return null;

  // 1. 解析 ai_analysis
  let aiAnalysis = targetRecord?.ai_analysis;
  if (typeof aiAnalysis === 'string') {
    try {
      aiAnalysis = JSON.parse(aiAnalysis);
    } catch (e) {
      aiAnalysis = undefined;
    }
  }

  // 2. 提取真實座位狀態清單與真實人員邊框 (嚴禁任何假邊框注入)
  const seatStatuses = Array.isArray(aiAnalysis?.seat_statuses) ? aiAnalysis.seat_statuses : [];
  const persons = Array.isArray(aiAnalysis?.persons)
    ? aiAnalysis.persons
    : Array.isArray(aiAnalysis?.faces)
      ? aiAnalysis.faces
      : [];

  const aspect = imgSize.width / imgSize.height;

  const modalContent = (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: '24px',
        boxSizing: 'border-box',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          maxWidth: '92vw',
          maxHeight: '88vh',
          aspectRatio: `${aspect}`,
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0,0,0,0.9)',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          background: '#090d16',
        }}
      >
        {/* 關閉按鈕 */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            background: 'rgba(0,0,0,0.7)',
            border: '1px solid rgba(255,255,255,0.25)',
            color: '#ffffff',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 30,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
        >
          <X size={22} />
        </button>

        {/* 原始相片 */}
        <img
          src={targetUrl}
          alt={title || 'Full View'}
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

        {/* 繪製真實偵測到的人員邊框 (藍色虛線框) */}
        {persons.map((person, idx) => {
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

        {/* 繪製各座號區域框 (僅在有真實 ROI 座標時繪製，嚴禁假座標) */}
        {seatStatuses.map((st, index) => {
          const roi = st.person_box || st.roi;
          if (!roi || typeof roi.x !== 'number' || !roi.width || roi.width <= 0) return null;

          const isOcc = st.status === 'OCCUPIED';
          const leftPct = (roi.x / 640) * 100;
          const topPct = (roi.y / 360) * 100;
          const widthPct = (roi.width / 640) * 100;
          const heightPct = (roi.height / 360) * 100;

          const labelText = isOcc
            ? `🟢 [${st.seat_id}] 在座`
            : `⚪ [${st.seat_id}] 空位`;

          return (
            <div
              key={`seat-${index}`}
              style={{
                position: 'absolute',
                left: `${leftPct}%`,
                top: `${topPct}%`,
                width: `${widthPct}%`,
                height: `${heightPct}%`,
                border: isOcc ? '2px solid #10b981' : '1.5px dashed rgba(148, 163, 184, 0.4)',
                background: isOcc ? 'rgba(16, 185, 129, 0.12)' : 'rgba(30, 41, 59, 0.2)',
                borderRadius: '8px',
                boxSizing: 'border-box',
                pointerEvents: 'none',
                zIndex: 15,
              }}
            >
              {/* 四角 L 型邊框 */}
              {isOcc && (
                <>
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '12px', height: '12px', borderTop: '3.5px solid #10b981', borderLeft: '3.5px solid #10b981' }} />
                  <div style={{ position: 'absolute', top: 0, right: 0, width: '12px', height: '12px', borderTop: '3.5px solid #10b981', borderRight: '3.5px solid #10b981' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, width: '12px', height: '12px', borderBottom: '3.5px solid #10b981', borderLeft: '3.5px solid #10b981' }} />
                  <div style={{ position: 'absolute', bottom: 0, right: 0, width: '12px', height: '12px', borderBottom: '3.5px solid #10b981', borderRight: '3.5px solid #10b981' }} />
                </>
              )}

              {/* 座號狀態標籤 */}
              <div style={{
                position: 'absolute',
                top: topPct > 8 ? '-26px' : '4px',
                left: '4px',
                background: isOcc ? 'rgba(16, 185, 129, 0.95)' : 'rgba(15, 23, 42, 0.85)',
                color: isOcc ? '#0f172a' : '#94a3b8',
                border: `1px solid ${isOcc ? '#10b981' : '#475569'}`,
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
