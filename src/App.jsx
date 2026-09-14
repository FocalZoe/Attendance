import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Menu, LayoutDashboard, History, Settings, LogIn, School } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import HistoryPage from './pages/History';
import Management from './pages/Management';
import LoginModal from './components/LoginModal';
import ErrorBoundary from './components/ErrorBoundary';
import { getAuthSession } from './services/authService';
import './App.css';

// 內部 App 核心內容，置於 Router 內部以存取 navigate
function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [session, setSession] = useState(getAuthSession());
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginTab, setLoginTab] = useState('class');

  useEffect(() => {
    const handleAuthChange = () => {
      const current = getAuthSession();
      setSession(current);
    };

    const handleOpenLogin = (e) => {
      const tab = e?.detail?.tab || 'class';
      setLoginTab(tab);
      setIsLoginModalOpen(true);
    };

    window.addEventListener('auth:session-changed', handleAuthChange);
    window.addEventListener('auth:open-login', handleOpenLogin);

    return () => {
      window.removeEventListener('auth:session-changed', handleAuthChange);
      window.removeEventListener('auth:open-login', handleOpenLogin);
    };
  }, []);

  const handleOpenLoginModal = (tab = 'class') => {
    setLoginTab(tab);
    setIsLoginModalOpen(true);
  };

  const handleLoginSuccess = (userSession) => {
    setSession(userSession);
    setIsLoginModalOpen(false);
    if (userSession.role === 'admin') {
      navigate('/management');
    } else if (userSession.role === 'class') {
      navigate('/');
    }
  };

  const isGuest = !session;
  const isClass = session?.role === 'class';
  const isAdmin = session?.role === 'admin';

  return (
    <div className="layout-container">
      {/* 行動端頂部 Bar */}
      <header className="mobile-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            style={{
              background: '#f1f5f9',
              color: '#0f172a',
              border: '1px solid var(--glass-border)',
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
              background: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
            }}>
              <School size={16} />
            </div>
            <span style={{ fontWeight: 800, fontSize: '0.95rem', letterSpacing: '-0.02em', color: '#0f172a' }}>
              班級自動化點名系統
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isGuest && (
            <button
              onClick={() => handleOpenLoginModal('class')}
              style={{
                fontSize: '0.72rem',
                padding: '4px 8px',
                borderRadius: '4px',
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              登入
            </button>
          )}
          {session && (
            <div style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px', background: isClass ? '#e0f2fe' : '#fdf4ff', color: isClass ? '#0284c7' : '#9333ea', border: '1px solid var(--glass-border)', fontWeight: 600 }}>
              {isClass ? (session.name || session.id) : '管理者'}
            </div>
          )}
        </div>
      </header>

      {/* 側邊欄 (桌機固定，手機滑出抽屜) */}
      <Sidebar
        isMobileOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
        onOpenLogin={(tab) => handleOpenLoginModal(tab)}
      />

      {/* 主視窗內容 */}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard onOpenLogin={() => handleOpenLoginModal('class')} />} />
          <Route path="/management" element={<Management />} />
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

        {isAdmin && (
          <NavLink
            to="/management"
            className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
          >
            <Settings size={20} />
            <span>班級管理</span>
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
            onClick={() => handleOpenLoginModal('class')}
            className="mobile-nav-item"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <LogIn size={20} />
            <span>登入帳號</span>
          </button>
        )}
      </nav>

      {/* 登入彈窗 */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        initialTab={loginTab}
      />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AppContent />
      </Router>
    </ErrorBoundary>
  );
}

export default App;
