// ==============================================================================
// 班級自動化點名系統 - 雙層身分登入彈窗元件 (LoginModal.jsx)
// 支援「班級登入」(解鎖儀表板與CSV匯出) 與「管理者登入」(admin / admin，進入管理頁面)
// ==============================================================================

import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Lock, User, Key, School, ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react';
import { loginClass, loginAdmin } from '../services/authService';

export const LoginModal = ({ isOpen, onClose, onSuccess }) => {
  const [tab, setTab] = useState('class'); // 'class' | 'admin'
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
      if (tab === 'class') {
        const res = await loginClass(account, password);
        if (res.success) {
          if (onSuccess) onSuccess('class', res.user);
          onClose();
        } else {
          setErrorMsg(res.message || '登入失敗，請檢查帳號密碼');
        }
      } else {
        const res = await loginAdmin(account, password);
        if (res.success) {
          if (onSuccess) onSuccess('admin');
          onClose();
        } else {
          setErrorMsg(res.message || '管理者帳號或密碼錯誤 (預設為 admin / admin)');
        }
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
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
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
          maxWidth: '420px',
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
        }}
      >
        {/* 頂部標頭 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <Lock size={16} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
              系統身分登入
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '4px',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748b',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab 切換 */}
        <div style={{ display: 'flex', padding: '6px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
          <button
            type="button"
            onClick={() => {
              setTab('class');
              setErrorMsg('');
              setAccount('');
              setPassword('');
            }}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              border: 'none',
              background: tab === 'class' ? '#ffffff' : 'transparent',
              color: tab === 'class' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              boxShadow: tab === 'class' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <School size={16} /> 班級登入
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('admin');
              setErrorMsg('');
              setAccount('');
              setPassword('');
            }}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              border: 'none',
              background: tab === 'admin' ? '#ffffff' : 'transparent',
              color: tab === 'admin' ? '#0f172a' : 'var(--text-secondary)',
              boxShadow: tab === 'admin' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <ShieldCheck size={16} /> 管理者登入
          </button>
        </div>

        {/* 表單內容 */}
        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          {errorMsg && (
            <div style={{ marginBottom: '16px', padding: '10px 12px', borderRadius: '6px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              {tab === 'class' ? '班級帳號代碼' : '管理者帳號'}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                required
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder={tab === 'class' ? '請輸入班級帳號代碼' : 'admin'}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontSize: '0.88rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              登入密碼
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tab === 'class' ? '請輸入密碼' : 'admin'}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontSize: '0.88rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <Key size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            </div>
            {tab === 'admin' && (
              <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                管理者預設帳號密碼：<code>admin</code> / <code>admin</code>
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '6px',
              background: tab === 'class' ? 'var(--accent-primary)' : '#0f172a',
              color: '#ffffff',
              border: 'none',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'opacity 0.15s ease',
            }}
          >
            {loading ? '驗證連線中...' : (
              <>
                {tab === 'class' ? '登入班級並進入儀表板' : '登入獨立管理頁面'}
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
