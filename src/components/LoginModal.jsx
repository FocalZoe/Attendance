// ==============================================================================
// 班級自動化點名系統 - 班級專屬登入彈窗元件 (LoginModal.jsx)
// 前台純粹僅供「班級帳號登入」(管理者一律透過獨立 /management 頁面管理)
// 溫潤米白咖啡色系 (Warm Cream & Rich Coffee)，純淨扁平無冷色干擾
// ==============================================================================

import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, User, Key, School, AlertCircle, ArrowRight } from 'lucide-react';
import { loginClass } from '../services/authService';

export const LoginModal = ({ isOpen, onClose, onSuccess }) => {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await loginClass(account, password);
      if (res.success) {
        if (onSuccess) onSuccess('class', res.user);
        onClose();
      } else {
        setErrorMsg(res.message || '登入失敗，請檢查班級帳號與密碼');
      }
    } catch (err) {
      setErrorMsg(err.message || '系統連線異常，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const modalContent = (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(45, 36, 30, 0.45)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '400px',
          background: '#ffffff',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 12px 32px -4px rgba(45, 36, 30, 0.12)',
          overflow: 'hidden',
        }}
      >
        {/* 頂部標頭 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
              <School size={18} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              班級帳號登入
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--bg-subtle)',
              border: 'none',
              borderRadius: '4px',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* 表單內容 */}
        <form onSubmit={handleSubmit} style={{ padding: '22px 20px' }}>
          {errorMsg && (
            <div style={{ marginBottom: '16px', padding: '10px 12px', borderRadius: '6px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              班級帳號代碼
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                required
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="例如：301 或 訊三甲代碼"
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-dark)',
                  background: '#ffffff',
                  color: 'var(--text-primary)',
                  fontSize: '0.88rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            </div>
          </div>

          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              登入密碼
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="請輸入班級密碼"
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-dark)',
                  background: '#ffffff',
                  color: 'var(--text-primary)',
                  fontSize: '0.88rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <Key size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '6px',
              background: 'var(--accent-primary)',
              color: '#ffffff',
              border: 'none',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'background 0.15s ease',
            }}
            onMouseOver={(e) => !loading && (e.currentTarget.style.background = 'var(--accent-hover)')}
            onMouseOut={(e) => !loading && (e.currentTarget.style.background = 'var(--accent-primary)')}
          >
            {loading ? '驗證班級身分中...' : (
              <>
                登入班級並進入儀表板
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default LoginModal;
