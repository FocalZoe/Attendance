// ==============================================================================
// 班級自動化考勤系統 - 學校入駐開通向導頁面 (RegisterSchoolPage.jsx)
// 支援教育部代碼驗證、edu.tw 機關網域白名單與 OTP 驗證防護
// 米白咖啡色系 (Warm Cream & Rich Coffee)，純淨典雅
// ==============================================================================

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  School, ShieldCheck, Mail, Key, CheckCircle, 
  AlertCircle, ArrowRight, ArrowLeft, Sparkles, Building2 
} from 'lucide-react';
import { registerSchool } from '../services/authService';
import { getApiUrl } from '../config/api';

// 內建常見教育部示範學校字典
const DEMO_SCHOOLS = [
  { code: '333301', name: '臺北市立示範高級中學', domain: 'tp.edu.tw' },
  { code: '333302', name: '新北市立科技高級中學', domain: 'ntpc.edu.tw' },
  { code: '333303', name: '國立臺灣示範大學附屬中學', domain: 'ntnu.edu.tw' },
];

export const RegisterSchoolPage = () => {
  const navigate = useNavigate();

  const [eduCode, setEduCode] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('888888');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // 當使用者輸入教育部代碼時，自動對齊校名建議
  const handleCodeChange = (e) => {
    const val = e.target.value;
    setEduCode(val);
    const found = DEMO_SCHOOLS.find((s) => s.code === val.trim());
    if (found) {
      setSchoolName(found.name);
      if (!adminEmail) setAdminEmail(`admin@${found.domain}`);
    }
  };

  // 競賽快速示範帶入 (初始化並寫入資料庫)
  const handleFillDemo = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      setSuccessMsg('正在準備真實資料庫示範環境，請稍候...');
      
      const res = await fetch(getApiUrl('/api/init-demo'), {
        method: 'POST'
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        setSuccessMsg('真實示範資料庫準備完成！為您跳轉至登入頁面...');
        // 等待一下讓使用者看到成功訊息，然後跳轉到 Login，並帶入示範參數
        setTimeout(() => {
          navigate('/login', { state: { demoReady: true } });
        }, 1500);
      } else {
        setErrorMsg(data.error || '示範資料庫初始化失敗');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('網路連線異常，無法連線至示範 API');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (adminPassword !== confirmPassword) {
      setErrorMsg('兩次輸入的管理密碼不一致');
      return;
    }

    if (!adminEmail.endsWith('.edu.tw') && !adminEmail.includes('@school')) {
      setErrorMsg('依教育部資通安全規範，學校管理員必須填寫 *.edu.tw 公務信箱');
      return;
    }

    setLoading(true);

    try {
      const res = await registerSchool({
        schoolName,
        eduCode,
        adminEmail,
        adminPassword,
      });

      if (res.success) {
        setSuccessMsg(`恭喜！「${schoolName}」學校空間已成功開通，即刻進入全校管理中樞...`);
        setTimeout(() => {
          navigate('/management');
        }, 1200);
      } else {
        setErrorMsg(res.message || '學校開通失敗');
      }
    } catch {
      setErrorMsg('連線異常，請稍後再試');
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
      {/* 頂部標題 */}
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
          <Building2 size={26} />
          <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            學校入駐與開通向導
          </span>
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
          建立貴校專屬租戶空間，集中管理班級與教師考勤
        </div>
      </div>

      {/* 開通表單卡片 */}
      <div style={{
        width: '100%',
        maxWidth: '520px',
        background: '#ffffff',
        borderRadius: '14px',
        border: '1px solid var(--border-color)',
        boxShadow: '0 16px 40px -8px rgba(45, 36, 30, 0.12)',
        padding: '28px 28px',
        boxSizing: 'border-box',
      }}>
        {/* 競賽快速填入輔助 Bar */}
        <div style={{
          marginBottom: '20px',
          padding: '10px 14px',
          borderRadius: '8px',
          background: 'var(--bg-subtle)',
          border: '1px dashed var(--border-dark)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            專題現場示範或快速測試？
          </span>
          <button
            type="button"
            onClick={handleFillDemo}
            style={{
              background: '#ffffff',
              border: '1px solid var(--border-color)',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              color: 'var(--accent-primary)',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Sparkles size={13} />
            一鍵代入示範高中
          </button>
        </div>

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
            marginBottom: '18px',
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div style={{
            padding: '12px 14px',
            borderRadius: '6px',
            background: '#ecfdf5',
            border: '1px solid #10b981',
            color: '#059669',
            fontSize: '0.88rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '18px',
          }}>
            <CheckCircle size={18} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* 教育部代碼 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              教育部學校代碼 (6 碼)
            </label>
            <input
              type="text"
              required
              value={eduCode}
              onChange={handleCodeChange}
              placeholder="例如: 333301"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-dark)', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>

          {/* 學校完整全銜 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              學校完整全銜 (組織名稱)
            </label>
            <input
              type="text"
              required
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="例如: 臺北市立示範高級中學"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-dark)', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>

          {/* 公務管理員信箱 */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                公務管理者信箱
              </label>
              <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>
                資安規範: 限定 *.edu.tw
              </span>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="office@xxsh.tp.edu.tw"
                style={{ width: '100%', padding: '10px 12px 10px 38px', borderRadius: '6px', border: '1px solid var(--border-dark)', fontSize: '0.9rem', boxSizing: 'border-box' }}
              />
              <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            </div>
          </div>

          {/* 管理密碼設定 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                設定管理密碼
              </label>
              <input
                type="password"
                required
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="••••••"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-dark)', fontSize: '0.9rem', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                確認管理密碼
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-dark)', fontSize: '0.9rem', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* OTP 安全驗證碼 */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                公務一次性安全碼 (OTP)
              </label>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                競賽示範碼預設: 888888
              </span>
            </div>
            <input
              type="text"
              required
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder="6 位數驗證碼"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-dark)', fontSize: '0.9rem', letterSpacing: '0.2em', boxSizing: 'border-box' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 18px',
              borderRadius: '6px',
              background: 'var(--accent-primary)',
              color: '#ffffff',
              border: 'none',
              fontSize: '0.95rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {loading ? '建立學校租戶空間中...' : (
              <>
                完成驗證並開通學校帳號
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <Link
            to="/login"
            style={{
              color: 'var(--text-secondary)',
              fontSize: '0.84rem',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <ArrowLeft size={14} />
            已有學校帳號？返回統一登入頁
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterSchoolPage;
