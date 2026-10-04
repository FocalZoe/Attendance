import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useNavigate, useLocation, useSearchParams, Navigate } from 'react-router-dom';
import { Menu, LayoutDashboard, History, LogIn, School, ShieldCheck, HeartHandshake } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import HistoryPage from './pages/History';
import Management from './pages/Management';
import LoginPage from './pages/LoginPage';
import RegisterSchoolPage from './pages/RegisterSchoolPage';
import ParentQueryPage from './pages/ParentQueryPage';
import LoginModal from './components/LoginModal';
import ErrorBoundary from './components/ErrorBoundary';
import { getAuthSession, verifyParentToken } from './services/authService';
import './App.css';

import { useAuthStore } from './store/authStore';

/**
 * 全域未登入安全守衛 (Auth Guard)
 * 未登入狀態一律強制 fallback 至 /login
 */
function RequireAuth({ children, allowedRoles }) {
  const session = useAuthStore((state) => state.session);
  const location = useLocation();

  if (!session) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(session.role)) {
    // 角色權限不足時自動導向其合法頁面
    if (session.role === 'admin') return <Navigate to="/management" replace />;
    if (session.role === 'teacher' || session.role === 'class') return <Navigate to="/dashboard" replace />;
    if (session.role === 'parent') return <Navigate to="/history" replace />;
    return <Navigate to="/" replace />;
  }

  return children;
}

/**
 * 前台考勤系統專用版面架構 (包含前台 Sidebar 與主內容區)
 */
function ClientLayout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { session, setSession, isLoginModalOpen, openLoginModal, closeLoginModal } = useAuthStore();

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
  }, [searchParams, setSession]);

  useEffect(() => {
    const handleOpenLogin = () => {
      navigate('/login');
    };

    window.addEventListener('auth:open-login', handleOpenLogin);

    return () => {
      window.removeEventListener('auth:open-login', handleOpenLogin);
    };
  }, [navigate]);

  const handleLoginSuccess = () => {
    const currentSession = getAuthSession();
    setSession(currentSession);
    closeLoginModal();
    if (currentSession?.role === 'admin') navigate('/management');
    else if (currentSession?.role === 'teacher' || currentSession?.role === 'class') navigate('/dashboard');
    else navigate('/history');
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
              onClick={() => navigate('/login')}
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
              教職員登入
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
        onOpenLogin={() => navigate('/login')}
      />

      {/* 前台主視窗內容 */}
      <main className="main-content">
        <Routes>
          {/* 公開首頁：家長專屬查詢專區 */}
          <Route path="/" element={<ParentQueryPage />} />

          {/* 教師即時考勤儀表板 (僅限 teacher / class) */}
          <Route
            path="/dashboard"
            element={
              <RequireAuth allowedRoles={['teacher', 'class']}>
                <Dashboard onOpenLogin={() => navigate('/login')} />
              </RequireAuth>
            }
          />

          {/* 課堂歷史紀錄簿 (家長臨時 session、教師、總管皆可存取) */}
          <Route
            path="/history"
            element={
              <RequireAuth>
                <HistoryPage />
              </RequireAuth>
            }
          />
        </Routes>
      </main>

      {/* 行動端底部快捷導覽列 */}
      <nav className="mobile-bottom-nav">
        <NavLink
          to="/"
          className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
        >
          <HeartHandshake size={20} />
          <span>家長查閱</span>
        </NavLink>

        {isTeacherOrClass && (
          <NavLink
            to="/dashboard"
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

        {(isAdmin || isTeacherOrClass) && (
          <NavLink
            to="/management"
            className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
          >
            <ShieldCheck size={20} />
            <span>空間管理</span>
          </NavLink>
        )}

        {isGuest && (
          <button
            onClick={() => navigate('/login')}
            className="mobile-nav-item"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <LogIn size={20} />
            <span>教師登入</span>
          </button>
        )}
      </nav>

      {/* 多身分登入彈窗備援 */}
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
          {/* 公開認證頁面 (完全無外框沉浸式) */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterSchoolPage />} />

          {/* 綜合管理中樞 (學校總管全權，教師存取指派班級與佈局) */}
          <Route
            path="/management"
            element={
              <RequireAuth allowedRoles={['admin', 'teacher', 'class']}>
                <Management />
              </RequireAuth>
            }
          />

          {/* 前台考勤系統其他所有頁面 */}
          <Route path="/*" element={<ClientLayout />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
