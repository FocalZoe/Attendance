// ==============================================================================
// 班級自動化點名系統 - 全能身分登入彈窗 (LoginModal.jsx)
// 支援三大日常角色切換：
// 1. 老師（班級管理者 - 管理考勤與劃位）
// 2. 家長（遊客模式 - 免註冊 Magic 代碼即查）
// 3. 學校（總管理者 - 多校後台入口）
// ==============================================================================

import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, User, Key, School, AlertCircle, ArrowRight, ShieldCheck, HeartHandshake, CheckCircle } from 'lucide-react';
import { loginTeacher, loginAdmin, verifyParentToken } from '../services/authService';

export const LoginModal = ({ isOpen, onClose, onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState('teacher'); // 'teacher' | 'parent' | 'admin'
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [parentToken, setParentToken] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleTeacherSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await loginTeacher(account, password);
      if (res.success) {
        if (onLoginSuccess) onLoginSuccess(res.user);
        onClose();
      } else {
        setErrorMsg(res.message || '教師登入失敗，請確認帳號密碼');
      }
    } catch (err) {
      setErrorMsg(err.message || '系統連線異常，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await loginAdmin(account, password);
      if (res.success) {
        if (onLoginSuccess) onLoginSuccess(res.user);
        onClose();
      } else {
        setErrorMsg(res.message || '學校管理者認證失敗');
      }
    } catch (err) {
      setErrorMsg(err.message || '系統連線異常');
    } finally {
      setLoading(false);
    }
  };

  const handleParentSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await verifyParentToken(parentToken);
      if (res.success) {
        setSuccessMsg(`身分驗證成功！歡迎 ${res.student.name} 的家長`);
        setTimeout(() => {
          if (onLoginSuccess) onLoginSuccess(res.student);
          onClose();
        }, 800);
      } else {
        setErrorMsg(res.message || '無效的查詢代碼，請向班級導師索取');
      }
    } catch (err) {
      setErrorMsg(err.message || '查詢失敗');
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
          maxWidth: '440px',
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 16px 40px -8px rgba(45, 36, 30, 0.16)',
          overflow: 'hidden',
        }}
      >
        {/* 頂部身分切換 Tabs */}
        <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-color)' }}>
          <button
            onClick={() => { setActiveTab('teacher'); setErrorMsg(''); }}
            style={{
              flex: 1,
              padding: '12px 8px',
              border: 'none',
              background: activeTab === 'teacher' ? '#ffffff' : 'transparent',
              fontWeight: activeTab === 'teacher' ? 700 : 500,
              color: activeTab === 'teacher' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              borderBottom: activeTab === 'teacher' ? '2px solid var(--accent-primary)' : 'none',
            }}
          >
            <User size={15} />
            老師 (班級)
          </button>

          <button
            onClick={() => { setActiveTab('parent'); setErrorMsg(''); }}
            style={{
              flex: 1,
              padding: '12px 8px',
              border: 'none',
              background: activeTab === 'parent' ? '#ffffff' : 'transparent',
              fontWeight: activeTab === 'parent' ? 700 : 500,
              color: activeTab === 'parent' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              borderBottom: activeTab === 'parent' ? '2px solid var(--accent-primary)' : 'none',
            }}
          >
            <HeartHandshake size={15} />
            家長 (遊客)
          </button>

          <button
            onClick={() => { setActiveTab('admin'); setErrorMsg(''); }}
            style={{
              flex: 1,
              padding: '12px 8px',
              border: 'none',
              background: activeTab === 'admin' ? '#ffffff' : 'transparent',
              fontWeight: activeTab === 'admin' ? 700 : 500,
              color: activeTab === 'admin' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              borderBottom: activeTab === 'admin' ? '2px solid var(--accent-primary)' : 'none',
            }}
          >
            <ShieldCheck size={15} />
            學校 (總管)
          </button>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '0 14px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* 提示訊息 */}
        <div style={{ padding: '20px 24px 8px 24px' }}>
          {errorMsg && (
            <div style={{ marginBottom: '14px', padding: '10px 12px', borderRadius: '6px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div style={{ marginBottom: '14px', padding: '10px 12px', borderRadius: '6px', background: '#ecfdf5', border: '1px solid #10b981', color: '#059669', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={16} style={{ flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* 1. 教師登入表單 */}
        {activeTab === 'teacher' && (
          <form onSubmit={handleTeacherSubmit} style={{ padding: '0 24px 24px 24px' }}>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              教師請輸入學校配發之帳號（示範快捷輸入：<code>teacher</code> / <code>123456</code>）
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                教師帳號 / Email
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  required
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  placeholder="例如: teacher 或 t101@school.edu.tw"
                  style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: '6px', border: '1px solid var(--border-dark)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
                <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                登入密碼
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="請輸入密碼"
                  style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: '6px', border: '1px solid var(--border-dark)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
                <Key size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', background: 'var(--accent-primary)', color: '#ffffff', border: 'none', fontSize: '0.9rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              {loading ? '身分驗證中...' : (
                <>
                  登入教師工作台
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        )}

        {/* 2. 家長遊客免註冊魔術代碼 */}
        {activeTab === 'parent' && (
          <form onSubmit={handleParentSubmit} style={{ padding: '0 24px 24px 24px' }}>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              家長無需繁瑣註冊！輸入導師提供的學生代碼（示範代碼：<code>8888</code> 或 <code>DEMO-STUDENT</code>）即可即時掌握在校在座狀況。
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                學生專屬查詢代碼 (Token)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  required
                  value={parentToken}
                  onChange={(e) => setParentToken(e.target.value)}
                  placeholder="例如: 8888 或 a7f9c2d1..."
                  style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: '6px', border: '1px solid var(--border-dark)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
                <Key size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', background: '#059669', color: '#ffffff', border: 'none', fontSize: '0.9rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              {loading ? '驗證查詢代碼中...' : (
                <>
                  驗證並進入家長查閱視圖
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        )}

        {/* 3. 學校總管理者登入 */}
        {activeTab === 'admin' && (
          <form onSubmit={handleAdminSubmit} style={{ padding: '0 24px 24px 24px' }}>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              學校總管可進入全校租戶後台，統籌管理全校所有班級與教師（示範帳號：<code>admin</code> / <code>admin</code>）。
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                學校管理者帳號
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  required
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  placeholder="admin"
                  style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: '6px', border: '1px solid var(--border-dark)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
                <School size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                管理密碼
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: '6px', border: '1px solid var(--border-dark)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
                <Key size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', background: 'var(--accent-primary)', color: '#ffffff', border: 'none', fontSize: '0.9rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              {loading ? '登入驗證中...' : (
                <>
                  登入學校管理中樞
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default LoginModal;
