// ==============================================================================
// 班級自動化考勤系統 - 家長專屬查詢首頁 (ParentQueryPage.jsx)
// 免帳號雙因子身分查閱中樞 (學號 + 生日/座號防護碼)
// 溫潤米白咖啡調 (Warm Cream & Rich Coffee)，純淨典雅
// ==============================================================================

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  HeartHandshake, GraduationCap, Key, ArrowRight, 
  AlertCircle, CheckCircle, School, ShieldCheck, LogIn 
} from 'lucide-react';
import { verifyParentAccess } from '../services/authService';

export const ParentQueryPage = () => {
  const navigate = useNavigate();

  const [studentNo, setStudentNo] = useState('112001');
  const [verifyCode, setVerifyCode] = useState('0521');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await verifyParentAccess(studentNo, verifyCode);
      if (res.success) {
        setSuccessMsg(`身分驗證成功！歡迎 ${res.student.name} 的家長（學號：${res.student.student_no || studentNo}）`);
        setTimeout(() => {
          navigate('/history');
        }, 500);
      } else {
        setErrorMsg(res.message || '學號或驗證防護碼不符，請確認學生生日或座號');
      }
    } catch {
      setErrorMsg('查詢系統連線異常，請稍後再試');
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
      {/* 右上角快捷入口：教職員與管理員登入 */}
      <div style={{ position: 'absolute', top: '24px', right: '24px' }}>
        <Link
          to="/login"
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
            transition: 'all 0.15s ease',
          }}
        >
          <LogIn size={15} color="var(--accent-primary)" />
          教職員 / 學校登入
        </Link>
      </div>

      {/* 頂部標誌與主標題 */}
      <div style={{ marginBottom: '28px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '10px',
          background: 'var(--accent-primary)',
          color: '#ffffff',
          padding: '10px 20px',
          borderRadius: '10px',
          boxShadow: '0 8px 24px -4px rgba(45, 36, 30, 0.16)',
          marginBottom: '14px',
        }}>
          <School size={26} />
          <span style={{ fontSize: '1.28rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            班級自動化考勤系統
          </span>
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', fontWeight: 500 }}>
          家長子女在校出缺席即時查閱入口 · 免繁雜註冊
        </div>
      </div>

      {/* 主查詢卡片 */}
      <div style={{
        width: '100%',
        maxWidth: '460px',
        background: '#ffffff',
        borderRadius: '14px',
        border: '1px solid var(--border-color)',
        boxShadow: '0 16px 40px -8px rgba(45, 36, 30, 0.10)',
        overflow: 'hidden',
      }}>
        {/* 卡片標題 Bar */}
        <div style={{
          padding: '18px 24px',
          background: '#fcfbf9',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            background: '#ecfdf5',
            color: '#059669',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <HeartHandshake size={18} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              家長查閱專區
            </h2>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              零資料外洩 (Zero-Leak) 防護機制驗證
            </span>
          </div>
        </div>

        {/* 提示訊息 */}
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

        {/* 查詢表單 */}
        <form onSubmit={handleSubmit} style={{ padding: '0 24px 24px 24px' }}>
          <p style={{ margin: '0 0 16px 0', fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            免註冊即可掌握孩子出席狀況！請輸入孩子的<strong>「正式學號」</strong>與<strong>「身分驗證碼」</strong>（預設為孩子生日月日 4 碼，例如 5 月 21 日請填 <code>0521</code>，或兩碼座號 <code>12</code>）。
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
                驗證並進入學生出缺席歷程
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* 底部導流資訊 */}
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
            需要開通全校管理？
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
            學校機構註冊嚮導
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ParentQueryPage;
