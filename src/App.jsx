import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import { Menu, LayoutDashboard, History, LogIn, School, ShieldCheck } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import HistoryPage from './pages/History';
import Management from './pages/Management';
import LoginModal from './components/LoginModal';
import ErrorBoundary from './components/ErrorBoundary';
import { getAuthSession, verifyParentToken } from './services/authService';
import './App.css';

/**
 * 前台考勤系統專用版面架構 (包含前台 Sidebar 與主內容區)
 */
function ClientLayout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [session, setSession] = useState(getAuthSession());
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // 支援 URL Token-based Magic Link (家長免註冊即時鑑權，例: /?student_token=8888)
  useEffect(() => {
    const magicToken = searchParams.get('student_token') || searchParams.get('token');
    if (magicToken) {
      verifyParentToken(magicToken).then((res) => {
        if (res.success) {
          setSession(getAuthSession());
        }
      });
    }
  }, [searchParams]);

  useEffect(() => {
    const handleAuthChange = () => {
      setSession(getAuthSession());
    };

    const handleOpenLogin = () => {
      setIsLoginModalOpen(true);
    };

    window.addEventListener('auth:session-changed', handleAuthChange);
    window.addEventListener('auth:open-login', handleOpenLogin);

    return () => {
      window.removeEventListener('auth:session-changed', handleAuthChange);
      window.removeEventListener('auth:open-login', handleOpenLogin);
    };
  }, []);

  const handleLoginSuccess = () => {
    setSession(getAuthSession());
    setIsLoginModalOpen(false);
    navigate('/');
  };

  const role = session?.role;
  const isTeacherOrClass = role === 'teacher' || role === 'class';
  const isAdmin = role === 'admin';
  const isGuest = !role;

  return (
    <div className="layout-container">
      {/* 行動端頂部 Bar */}
      <header className="mobile-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            style={{
              background: 'var(--bg-subtle)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              padding: '6px 8px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title="開啟選單"
          >
            <Menu size={18} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
            }}>
              <School size={16} />
            </div>
            <span style={{ fontWeight: 800, fontSize: '0.92rem', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              班級自動化考勤
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isGuest && (
            <button
              onClick={() => setIsLoginModalOpen(true)}
              style={{
                fontSize: '0.72rem',
                padding: '4px 8px',
                borderRadius: '4px',
                background: 'var(--accent-primary)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              多身分登入
            </button>
          )}
          {!isGuest && (
            <div style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px', background: 'var(--bg-subtle)', color: 'var(--accent-primary)', border: '1px solid var(--border-color)', fontWeight: 600 }}>
              {session.name || session.id}
            </div>
          )}
        </div>
      </header>

      {/* 前台側邊欄 */}
      <Sidebar
        isMobileOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
        onOpenLogin={() => setIsLoginModalOpen(true)}
      />

      {/* 前台主視窗內容 */}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard onOpenLogin={() => setIsLoginModalOpen(true)} />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </main>

      {/* 行動端底部快捷導覽列 */}
      <nav className="mobile-bottom-nav">
        {isTeacherOrClass && (
          <NavLink
            to="/"
            className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
          >
            <LayoutDashboard size={20} />
            <span>即時儀表板</span>
          </NavLink>
        )}

        <NavLink
          to="/history"
          className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
        >
          <History size={20} />
          <span>歷史紀錄簿</span>
        </NavLink>

        {isAdmin && (
          <NavLink
            to="/management"
            className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
          >
            <ShieldCheck size={20} />
            <span>管理中樞</span>
          </NavLink>
        )}

        {isGuest && (
          <button
            onClick={() => setIsLoginModalOpen(true)}
            className="mobile-nav-item"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <LogIn size={20} />
            <span>身分登入</span>
          </button>
        )}
      </nav>

      {/* 多身分登入彈窗 */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          {/* 獨立單獨管理網頁 */}
          <Route path="/management" element={<Management />} />
          {/* 前台考勤系統其他所有頁面 */}
          <Route path="/*" element={<ClientLayout />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
