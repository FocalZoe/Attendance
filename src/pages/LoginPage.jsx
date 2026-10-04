// ==============================================================================
// 班級自動化考勤系統 - 獨立登入頁面 (LoginPage.jsx)
// 全螢幕沉浸式三合一認證 (家長學號查閱、教師管理、學校總管)
// 米白咖啡色系 (Warm Cream & Rich Coffee)，純淨典雅
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { 
  School, User, Key, ShieldCheck, HeartHandshake, 
  ArrowRight, AlertCircle, CheckCircle, GraduationCap, ArrowLeft 
} from 'lucide-react';
import { loginTeacher, loginAdmin, verifyParentAccess, getAuthSession } from '../services/authService';

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState('parent'); // 'parent' | 'teacher' | 'admin'
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [studentNo, setStudentNo] = useState('112001');
  const [verifyCode, setVerifyCode] = useState('0521');
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
      // 清除 state 避免重整一直出現
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // 若使用者已登入，根據角色直接導向對應主頁
  useEffect(() => {
    const session = getAuthSession();
    if (session) {
      if (session.role === 'admin') navigate('/management');
      else if (session.role === 'teacher' || session.role === 'class') navigate('/');
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
        navigate(redirectTarget || '/');
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

  const handleParentSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await verifyParentAccess(studentNo, verifyCode);
      if (res.success) {
        setSuccessMsg(`身分驗證成功！歡迎 ${res.student.name} 的家長（學號：${res.student.student_no || studentNo}）`);
        setTimeout(() => {
          navigate(redirectTarget || '/history');
        }, 600);
      } else {
        setErrorMsg(res.message || '學號或驗證碼不符，請確認學生生日或座號');
      }
    } catch {
      setErrorMsg('查詢連線異常');
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
    }}>
      {/* 頂部 LOGO 與回首頁 */}
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
          安全、即時、多校區的雲端在座識別中樞
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
        {/* 三合一身分 Tabs */}
        <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-color)' }}>
          <button
            onClick={() => { setActiveTab('parent'); setErrorMsg(''); setSuccessMsg(''); }}
            style={{
              flex: 1,
              padding: '14px 8px',
              border: 'none',
              background: activeTab === 'parent' ? '#ffffff' : 'transparent',
              fontWeight: activeTab === 'parent' ? 800 : 500,
              color: activeTab === 'parent' ? '#059669' : 'var(--text-secondary)',
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              borderBottom: activeTab === 'parent' ? '3px solid #059669' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <HeartHandshake size={16} />
            家長 (學號)
          </button>

          <button
            onClick={() => { setActiveTab('teacher'); setErrorMsg(''); setSuccessMsg(''); }}
            style={{
              flex: 1,
              padding: '14px 8px',
              border: 'none',
              background: activeTab === 'teacher' ? '#ffffff' : 'transparent',
              fontWeight: activeTab === 'teacher' ? 800 : 500,
              color: activeTab === 'teacher' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontSize: '0.9rem',
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
            老師 (班級)
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
              fontSize: '0.9rem',
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
            學校 (總管)
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

        {/* 1. 家長（學號 + 生日驗證碼） */}
        {activeTab === 'parent' && (
          <form onSubmit={handleParentSubmit} style={{ padding: '0 24px 24px 24px' }}>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              免註冊即可查閱！請輸入孩子的<strong>「正式學號」</strong>與<strong>「身分驗證碼」</strong>（預設為孩子生日月日 4 碼，例如 5 月 21 日請填 <code>0521</code>，或兩碼座號 <code>12</code>）。
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                學生學號 (Student ID)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  required
                  value={studentNo}
                  onChange={(e) => setStudentNo(e.target.value)}
                  placeholder="例如: 112001"
                  style={{ width: '100%', padding: '10px 12px 10px 38px', borderRadius: '6px', border: '1px solid var(--border-dark)', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
                <GraduationCap size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              </div>
            </div>

            <div style={{ marginBottom: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  家長身分驗證防護碼
                </label>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  預設: 生日 4 碼或座號
                </span>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  required
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  placeholder="例如: 0521 或 12"
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
                background: '#059669',
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
              {loading ? '驗證學號與身分中...' : (
                <>
                  驗證並進入學生考勤查閱
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        )}

        {/* 2. 教師登入 */}
        {activeTab === 'teacher' && (
          <form onSubmit={handleTeacherSubmit} style={{ padding: '0 24px 24px 24px' }}>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              任課教師請輸入學校配發之帳號（示範快捷輸入：<code>teacher</code> / <code>123456</code>）。
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

        {/* 3. 學校總管理員 */}
        {activeTab === 'admin' && (
          <form onSubmit={handleAdminSubmit} style={{ padding: '0 24px 24px 24px' }}>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              學校總管進入全校租戶後台（示範管理帳號：<code>admin</code> / <code>admin</code>）。
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
