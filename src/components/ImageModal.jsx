// TEAM_001: 點名照片大圖檢視 Modal (ImageModal.jsx)
import React from 'react';
import { X } from 'lucide-react';

const ImageModal = ({ imageUrl, title, onClose }) => {
  if (!imageUrl) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '20px',
    }} onClick={onClose}>
      <div
        className="glass-panel"
        style={{
          position: 'relative',
          maxWidth: '90vw',
          maxHeight: '90vh',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{title || '觀看點名照片'}</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '4px' }}
          >
            <X size={24} />
          </button>
        </div>

        <div style={{ overflow: 'hidden', borderRadius: '8px', maxHeight: '80vh' }}>
          <img
            src={imageUrl}
            alt={title || 'Full size attendance capture'}
            style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain' }}
          />
        </div>
      </div>
    </div>
  );
};

export default ImageModal;
