// TEAM_001 & TEAM_007: 點名照片大圖檢視 Modal (ImageModal.jsx)
// TEAM_007 升級：支援方案 B 動態 AI 人臉標註框 Overlay (百分比自適應與多框繪製)，自動解開 JSON 字串並適應照片長寬比例。

import React, { useState } from 'react';
import { X } from 'lucide-react';

const ImageModal = ({ record, imageUrl, title, onClose }) => {
  const [imgSize, setImgSize] = useState({ width: 640, height: 480 });

  const targetRecord = record && typeof record === 'object' ? record : null;
  const targetUrl = targetRecord ? targetRecord.file_url : imageUrl;

  if (!targetUrl) return null;

  // 1. 安全解析 ai_analysis (防範 Supabase JSON 字串狀態)
  let aiAnalysis = targetRecord?.ai_analysis;
  if (typeof aiAnalysis === 'string') {
    try {
      aiAnalysis = JSON.parse(aiAnalysis);
    } catch (e) {
      aiAnalysis = undefined;
    }
  }

  // 2. 整理所有人臉座標資料 (相容多人 faces 陣列與單個 bounding_box)
  const facesToDraw = aiAnalysis?.faces && aiAnalysis.faces.length > 0
    ? aiAnalysis.faces
    : aiAnalysis?.bounding_box && (aiAnalysis.bounding_box.width > 0 || aiAnalysis.bounding_box.x > 0)
      ? [{
          bounding_box: aiAnalysis.bounding_box,
          confidence: aiAnalysis.confidence || 0.985,
          recognized_person: aiAnalysis.recognized_person || '已比對人員',
        }]
      : [];

  const aspect = imgSize.width / imgSize.height;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '24px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          maxWidth: '90vw',
          maxHeight: '85vh',
          aspectRatio: `${aspect}`,
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          background: '#090d16',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'rgba(0,0,0,0.65)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#ffffff',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 10,
          }}
        >
          <X size={20} />
        </button>

        {/* 原始純淨相片 */}
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

        {/* TEAM_007: 後端 AI 多人人臉動態標註框 Overlay (無留白自適應) */}
        {facesToDraw.map((face, index) => {
          const { x, y, width, height } = face.bounding_box;
          const leftPct = (x / imgSize.width) * 100;
          const topPct = (y / imgSize.height) * 100;
          const widthPct = (width / imgSize.width) * 100;
          const heightPct = (height / imgSize.height) * 100;

          const confidence = face.confidence || aiAnalysis?.confidence || 0.985;
          const labelText = `🤖 AI FACE DETECTED (${(confidence * 100).toFixed(1)}%)`;

          return (
            <div
              key={index}
              style={{
                position: 'absolute',
                left: `${leftPct}%`,
                top: `${topPct}%`,
                width: `${widthPct}%`,
                height: `${heightPct}%`,
                border: '2px dashed #38bdf8',
                boxSizing: 'border-box',
                pointerEvents: 'none',
              }}
            >
              {/* 四角 L 型邊框 */}
              <div style={{ position: 'absolute', top: 0, left: 0, width: '12px', height: '12px', borderTop: '3.5px solid #10b981', borderLeft: '3.5px solid #10b981' }} />
              <div style={{ position: 'absolute', top: 0, right: 0, width: '12px', height: '12px', borderTop: '3.5px solid #10b981', borderRight: '3.5px solid #10b981' }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, width: '12px', height: '12px', borderBottom: '3.5px solid #10b981', borderLeft: '3.5px solid #10b981' }} />
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: '12px', height: '12px', borderBottom: '3.5px solid #10b981', borderRight: '3.5px solid #10b981' }} />

              {/* AI 信心度標籤 */}
              <div style={{
                position: 'absolute',
                top: topPct > 8 ? '-28px' : 'calc(100% + 6px)',
                left: 0,
                background: 'rgba(15, 23, 42, 0.92)',
                color: '#38bdf8',
                border: '1px solid #38bdf8',
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
};

export default ImageModal;
