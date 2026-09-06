import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { Menu, LayoutDashboard, History, LayoutGrid } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import HistoryPage from './pages/History';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

function App() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <ErrorBoundary>
      <Router>
        <div className="layout-container">
        {/* 行動端頂部 Bar */}
        <header className="mobile-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#fff',
                border: '1px solid var(--glass-border)',
                padding: '7px 9px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title="開啟選單"
            >
              <Menu size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '7px',
                background: 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
              }}>
                <LayoutGrid size={16} />
              </div>
              <span style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.02em' }}>
                ClassVision
              </span>
            </div>
          </div>

          <div style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.15)', color: '#38bdf8', border: '1px solid rgba(59, 130, 246, 0.3)', fontWeight: 600 }}>
            ⚡ 邊緣考勤
          </div>
        </header>

        {/* 側邊欄 (桌機固定，手機滑出抽屜) */}
        <Sidebar
          isMobileOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />

        {/* 主視窗內容 */}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/history" element={<HistoryPage />} />
          </Routes>
        </main>

        {/* 行動端底部快捷導覽列 (Bottom Nav) */}
        <nav className="mobile-bottom-nav">
          <NavLink
            to="/"
            className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
          >
            <LayoutDashboard size={20} />
            <span>即時儀表板</span>
          </NavLink>

          <NavLink
            to="/history"
            className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
          >
            <History size={20} />
            <span>歷史紀錄簿</span>
          </NavLink>
        </nav>
      </div>
    </Router>
  </ErrorBoundary>
  );
}

export default App;

