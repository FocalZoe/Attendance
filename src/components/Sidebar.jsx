import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, History, LogIn, LogOut, School, X, ShieldCheck, HeartHandshake, User } from 'lucide-react';
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
    navigate('/login');
  };

  const handleOpenRegister = () => {
    if (onClose) onClose();
    navigate('/register');
  };

  const role = session?.role;
  const isTeacherOrClass = role === 'teacher' || role === 'class';
  const isAdmin = role === 'admin';
  const isParent = role === 'parent';
  const isGuest = !role;

  // 動態標籤文字
  const getRoleBadge = () => {
    if (isAdmin) return '學校總管理者';
    if (role === 'teacher') return `任課老師 · ${session.name || '老師'}`;
    if (role === 'class') return `班級在線 · ${session.name || '班級'}`;
    if (isParent) return `家長查閱 · ${session.name || '學生'}`;
    return '校園訪客模式';
  };

  return (
    <>
      {/* 行動端遮罩層 */}
      {isMobileOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(45, 36, 30, 0.45)',
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
          borderRight: '1px solid var(--border-color)',
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
              background: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: 'none',
            }}>
              <School size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-primary)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                班級自動化考勤
              </h2>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                {getRoleBadge()}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="mobile-only"
            style={{
              background: 'var(--bg-color)',
              border: '1px solid var(--border-color)',
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

          {/* 教師 / 班級專用：即時儀表板 */}
          {isTeacherOrClass && (
            <NavLink
              to="/"
              onClick={() => onClose && onClose()}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <LayoutDashboard size={19} />
              課堂即時儀表板
            </NavLink>
          )}

          {/* 歷史紀錄簿 (所有人皆可見) */}
          <NavLink
            to="/history"
            onClick={() => onClose && onClose()}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <History size={19} />
            課堂歷史紀錄簿
          </NavLink>

          {/* 學校管理者入口 */}
          {isAdmin && (
            <NavLink
              to="/management"
              onClick={() => onClose && onClose()}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <ShieldCheck size={19} />
              全校租戶管理中樞
            </NavLink>
          )}
        </nav>

        {/* 底部帳號狀態區塊 */}
        <div style={{
          borderTop: '1px solid var(--border-color)',
          paddingTop: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          {isGuest && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={handleOpenLogin}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  background: 'var(--accent-primary)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = 'var(--accent-hover)')}
                onMouseOut={(e) => (e.currentTarget.style.background = 'var(--accent-primary)')}
              >
                <LogIn size={16} />
                多身分日常登入
              </button>

              <button
                onClick={handleOpenRegister}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  border: '1px dashed var(--border-color)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'var(--bg-subtle)';
                  e.currentTarget.style.color = 'var(--accent-primary)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                <School size={14} />
                新學校入駐開通向導
              </button>
            </div>
          )}

          {!isGuest && (
            <div style={{
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: isParent ? '#ecfdf5' : 'var(--accent-light)',
                  border: '1px solid var(--border-color)',
                  color: isParent ? '#059669' : 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  flexShrink: 0,
                }}>
                  {isParent ? <HeartHandshake size={16} /> : (isAdmin ? <ShieldCheck size={16} /> : <User size={16} />)}
                </div>
                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {session.name || session.id}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                    {session.schoolName || session.currentClassName || getRoleBadge()}
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
                  padding: '7px 10px',
                  borderRadius: '4px',
                  background: 'var(--danger-bg)',
                  border: '1px solid var(--danger-border)',
                  color: 'var(--danger)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                <LogOut size={14} />
                安全退出身分
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
