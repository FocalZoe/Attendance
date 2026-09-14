// ==============================================================================
// 班級自動化點名系統 - 全站通用 Toast 浮動通知元件 (Toast.jsx)
// 採用 ReactDOM.createPortal 掛載至 document.body 最上層 (zIndex: 9999999)
// 支援 success | error | info 類型，具備滑入動畫與自動倒數關閉
// ==============================================================================

import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const Toast = ({
  message,
  type = 'success', // 'success' | 'error' | 'info'
  duration = 3500,
  onClose,
}) => {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      if (onClose) onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  const getStyleConfig = () => {
    switch (type) {
      case 'error':
        return {
          bg: '#fef2f2',
          border: '#fecaca',
          color: '#b91c1c',
          icon: <AlertCircle size={18} color="#b91c1c" style={{ flexShrink: 0 }} />,
        };
      case 'info':
        return {
          bg: '#f5ede6',
          border: '#dfd7cc',
          color: '#5c3a21',
          icon: <Info size={18} color="#5c3a21" style={{ flexShrink: 0 }} />,
        };
      case 'success':
      default:
        return {
          bg: '#f0fdf4',
          border: '#bbf7d0',
          color: '#15803d',
          icon: <CheckCircle2 size={18} color="#15803d" style={{ flexShrink: 0 }} />,
        };
    }
  };

  const config = getStyleConfig();

  const toastElement = (
    <div
      style={{
        position: 'fixed',
        top: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999999,
        minWidth: '280px',
        maxWidth: '90vw',
        padding: '12px 18px',
        borderRadius: '8px',
        background: config.bg,
        border: `1px solid ${config.border}`,
        color: config.color,
        boxShadow: '0 8px 24px -4px rgba(45, 36, 30, 0.12), 0 2px 6px rgba(45, 36, 30, 0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        fontSize: '0.9rem',
        fontWeight: 600,
        letterSpacing: '-0.01em',
        animation: 'toastSlideDown 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }}
    >
      <style>{`
        @keyframes toastSlideDown {
          from {
            opacity: 0;
            transform: translate(-50%, -16px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {config.icon}
        <span>{message}</span>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: config.color,
            opacity: 0.7,
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
            transition: 'opacity 0.15s ease',
          }}
          onMouseOver={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseOut={(e) => (e.currentTarget.style.opacity = '0.7')}
          aria-label="關閉通知"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );

  return ReactDOM.createPortal(toastElement, document.body);
};

export default Toast;
