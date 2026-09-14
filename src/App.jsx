import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { Menu, LayoutDashboard, History, LogIn, School } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import HistoryPage from './pages/History';
import Management from './pages/Management';
import LoginModal from './components/LoginModal';
import ErrorBoundary from './components/ErrorBoundary';
import { getAuthSession } from './services/authService';
import './App.css';

/**
 * 前台考勤系統專用版面架構 (包含前台 Sidebar 與主內容區)
 */
function ClientLayout() {
  const navigate = useNavigate();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [session, setSession] = useState(getAuthSession());
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

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

  const handleLoginSuccess = (userSession) => {
    setSession(userSession);
    setIsLoginModalOpen(false);
    navigate('/');
  };

  const isClass = session?.role === 'class';
  const isGuest = !isClass;

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
            <span style={{ fontWeight: 800, fontSize: '0.95rem', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              班級自動化點名系統
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
              班級登入
            </button>
          )}
          {isClass && (
            <div style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px', background: 'var(--bg-subtle)', color: 'var(--accent-primary)', border: '1px solid var(--border-color)', fontWeight: 600 }}>
              {session.name || session.id}
            </div>
          )}
        </div>
      </header>

      {/* 前台側邊欄 (桌機固定，手機滑出抽屜) */}
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

      {/* 行動端底部快捷導覽列 (Bottom Nav) */}
      <nav className="mobile-bottom-nav">
        {isClass && (
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
            <span>班級登入</span>
          </button>
        )}
      </nav>

      {/* 班級登入彈窗 */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        initialTab="class"
      />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          {/* 獨立單獨管理網頁，完全不套用前台 Sidebar 與外層框架 */}
          <Route path="/management" element={<Management />} />
          {/* 前台點名系統其他所有頁面 */}
          <Route path="/*" element={<ClientLayout />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
