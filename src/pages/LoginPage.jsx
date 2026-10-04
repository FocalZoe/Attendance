// ==============================================================================
// 班級自動化考勤系統 - 教職員與管理者登入頁面 (LoginPage.jsx)
// 雙角色身分認證 (任課/班導師工作台、學校總管中樞)
// 米白咖啡色系 (Warm Cream & Rich Coffee)，純淨典雅
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { 
  School, User, Key, ShieldCheck, ArrowRight, 
  AlertCircle, CheckCircle, ArrowLeft, HeartHandshake 
} from 'lucide-react';
import { loginTeacher, loginAdmin, getAuthSession } from '../services/authService';

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState('teacher'); // 'teacher' | 'admin'
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // 接收來自 RegisterSchoolPage 的示範就緒狀態
  useEffect(() => {
    if (location.state?.demoReady) {
      setActiveTab('admin');
      setAccount('office@tp.edu.tw');
      setPassword('School@2026');
      setSuccessMsg('示範資料庫已就緒！已為您帶入管理員測試帳號');
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // 若使用者已登入，根據角色直接導向對應主頁
  useEffect(() => {
    const session = getAuthSession();
    if (session) {
      if (session.role === 'admin') navigate('/management');
      else if (session.role === 'teacher' || session.role === 'class') navigate('/dashboard');
      else if (session.role === 'parent') navigate('/history');
    }
  }, [navigate]);

  // 取得重定向來源網址
  const redirectTarget = searchParams.get('redirect') || null;

  const handleTeacherSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await loginTeacher(account, password);
      if (res.success) {
        navigate(redirectTarget || '/dashboard');
      } else {
        setErrorMsg(res.message || '教師登入失敗，請確認帳號與密碼');
      }
    } catch {
      setErrorMsg('系統連線異常，請稍後再試');
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
        navigate(redirectTarget || '/management');
      } else {
        setErrorMsg(res.message || '學校管理者認證失敗');
      }
    } catch {
      setErrorMsg('系統連線異常');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-color)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      boxSizing: 'border-box',
      position: 'relative',
    }}>
      {/* 回到家長查詢首頁 */}
      <div style={{ position: 'absolute', top: '24px', left: '24px' }}>
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: '6px',
            background: '#ffffff',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            fontSize: '0.84rem',
            fontWeight: 600,
            textDecoration: 'none',
            boxShadow: '0 2px 8px rgba(45, 36, 30, 0.05)',
          }}
        >
          <ArrowLeft size={15} />
          前往家長查閱專區
        </Link>
      </div>

      {/* 頂部 LOGO 與標題 */}
      <div style={{ marginBottom: '24px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '10px',
          background: 'var(--accent-primary)',
          color: '#ffffff',
          padding: '10px 18px',
          borderRadius: '10px',
          boxShadow: '0 8px 24px -4px rgba(45, 36, 30, 0.16)',
          marginBottom: '12px',
        }}>
          <School size={26} />
          <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            班級自動化考勤系統
          </span>
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
          教職員認證中樞 · 即時監控與班級空間管理
        </div>
      </div>

      {/* 主認證卡片 */}
      <div style={{
        width: '100%',
        maxWidth: '460px',
        background: '#ffffff',
        borderRadius: '14px',
        border: '1px solid var(--border-color)',
        boxShadow: '0 16px 40px -8px rgba(45, 36, 30, 0.12)',
        overflow: 'hidden',
      }}>
        {/* 雙身分 Tabs */}
        <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-color)' }}>
          <button
            onClick={() => { setActiveTab('teacher'); setErrorMsg(''); setSuccessMsg(''); }}
            style={{
              flex: 1,
              padding: '14px 8px',
              border: 'none',
              background: activeTab === 'teacher' ? '#ffffff' : 'transparent',
              fontWeight: activeTab === 'teacher' ? 800 : 500,
              color: activeTab === 'teacher' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontSize: '0.92rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              borderBottom: activeTab === 'teacher' ? '3px solid var(--accent-primary)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <User size={16} />
            教師 (課堂 / 班導師)
          </button>

          <button
            onClick={() => { setActiveTab('admin'); setErrorMsg(''); setSuccessMsg(''); }}
            style={{
              flex: 1,
              padding: '14px 8px',
              border: 'none',
              background: activeTab === 'admin' ? '#ffffff' : 'transparent',
              fontWeight: activeTab === 'admin' ? 800 : 500,
              color: activeTab === 'admin' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontSize: '0.92rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              borderBottom: activeTab === 'admin' ? '3px solid var(--accent-primary)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <ShieldCheck size={16} />
            學校 (總管理員)
          </button>
        </div>

        {/* 狀態訊息提示 */}
        <div style={{ padding: '20px 24px 0 24px' }}>
          {errorMsg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '6px',
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              color: 'var(--danger)',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px',
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '6px',
              background: '#ecfdf5',
              border: '1px solid #10b981',
              color: '#059669',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px',
            }}>
              <CheckCircle size={16} style={{ flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* 1. 教師登入 */}
        {activeTab === 'teacher' && (
          <form onSubmit={handleTeacherSubmit} style={{ padding: '0 24px 24px 24px' }}>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              任課教師與班導師請輸入學校配發之帳號或公務信箱（示範帳號：<code>teacher</code> / <code>123456</code>）。
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                教師帳號 / 公務 Email
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  required
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  placeholder="teacher"
                  style={{ width: '100%', padding: '10px 12px 10px 38px', borderRadius: '6px', border: '1px solid var(--border-dark)', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
                <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              </div>
            </div>

            <div style={{ marginBottom: '22px' }}>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                登入密碼
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  style={{ width: '100%', padding: '10px 12px 10px 38px', borderRadius: '6px', border: '1px solid var(--border-dark)', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
                <Key size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '11px 16px',
                borderRadius: '6px',
                background: 'var(--accent-primary)',
                color: '#ffffff',
                border: 'none',
                fontSize: '0.92rem',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
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

        {/* 2. 學校總管理員 */}
        {activeTab === 'admin' && (
          <form onSubmit={handleAdminSubmit} style={{ padding: '0 24px 24px 24px' }}>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              學校總管進入全校租戶管理中樞（示範管理帳號：<code>admin</code> / <code>admin</code>）。
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                學校管理者帳號 / 公務信箱
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  required
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  placeholder="admin"
                  style={{ width: '100%', padding: '10px 12px 10px 38px', borderRadius: '6px', border: '1px solid var(--border-dark)', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
                <School size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              </div>
            </div>

            <div style={{ marginBottom: '22px' }}>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                管理密碼
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  style={{ width: '100%', padding: '10px 12px 10px 38px', borderRadius: '6px', border: '1px solid var(--border-dark)', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
                <Key size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '11px 16px',
                borderRadius: '6px',
                background: 'var(--accent-primary)',
                color: '#ffffff',
                border: 'none',
                fontSize: '0.92rem',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
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

        {/* 底部導流：學校開通註冊 */}
        <div style={{
          padding: '14px 24px',
          background: 'var(--bg-subtle)',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.82rem',
        }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            您是新學校負責人？
          </span>
          <Link
            to="/register"
            style={{
              color: 'var(--accent-primary)',
              fontWeight: 700,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            學校入駐開通向導
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
