import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, History, LogIn, LogOut, School, X } from 'lucide-react';
import { getAuthSession, clearAuthSession } from '../services/authService';

const Sidebar = ({ isMobileOpen, onClose, onOpenLogin }) => {
  const navigate = useNavigate();
  const [session, setSession] = useState(getAuthSession());

  useEffect(() => {
    const handleAuthChange = () => {
      setSession(getAuthSession());
    };
    window.addEventListener('auth:session-changed', handleAuthChange);
    return () => window.removeEventListener('auth:session-changed', handleAuthChange);
  }, []);

  const handleLogout = () => {
    clearAuthSession();
    if (onClose) onClose();
    navigate('/history');
  };

  const handleOpenLogin = () => {
    if (onClose) onClose();
    if (onOpenLogin) {
      onOpenLogin('class');
    } else {
      window.dispatchEvent(new CustomEvent('auth:open-login', { detail: { tab: 'class' } }));
    }
  };

  const isClass = session?.role === 'class';
  const isGuest = !isClass;

  return (
    <>
      {/* 行動端遮罩層 (Mobile Backdrop) */}
      {isMobileOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            zIndex: 90,
          }}
          className="mobile-only"
        />
      )}

      <aside
        className={`sidebar-container ${isMobileOpen ? 'mobile-open' : ''}`}
        style={{
          width: '260px',
          height: '100vh',
          padding: '24px',
          borderRight: '1px solid var(--glass-border)',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 100,
          boxShadow: 'none',
          transition: 'transform 0.25s ease',
        }}
      >
        {/* 系統標頭 */}
        <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.15)'
            }}>
              <School size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-primary)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                班級自動化點名系統
              </h2>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                {isClass ? `班級專區 · ${session.name || session.id}` : '校園訪客瀏覽模式'}
              </span>
            </div>
          </div>

          {/* 行動端關閉按鈕 */}
          <button
            onClick={onClose}
            className="mobile-only"
            style={{
              background: 'var(--bg-color)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-secondary)',
              padding: '6px',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 導覽功能選單 */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '8px', marginLeft: '4px' }}>
            功能導覽
          </div>

          {/* 班級專屬：即時儀表板 */}
          {isClass && (
            <NavLink
              to="/"
              onClick={() => onClose && onClose()}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <LayoutDashboard size={19} />
              即時儀表板
            </NavLink>
          )}

          {/* 所有訪客與班級皆可見：課堂歷史紀錄簿 */}
          <NavLink
            to="/history"
            onClick={() => onClose && onClose()}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <History size={19} />
            課堂歷史紀錄簿
          </NavLink>
        </nav>

        {/* 底部帳號狀態區塊 */}
        <div style={{
          borderTop: '1px solid var(--glass-border)',
          paddingTop: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          {isGuest && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', paddingLeft: '4px' }}>
                當前為訪客模式（僅供查閱紀錄）
              </div>
              <button
                onClick={handleOpenLogin}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  background: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                <LogIn size={16} />
                班級帳號登入
              </button>
            </div>
          )}

          {isClass && (
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: '#e0f2fe',
                  color: '#0284c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                }}>
                  {session.name ? session.name.charAt(0) : '班'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {session.name || session.id}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    帳號：{session.id} · {session.studentCount ? `${session.studentCount}人` : '人數未定'}
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#dc2626',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <LogOut size={14} />
                班級登出
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
