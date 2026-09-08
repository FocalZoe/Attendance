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
                width: '26px',
                height: '26px',
                borderRadius: '4px',
                background: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
              }}>
                <LayoutGrid size={15} />
              </div>
              <span style={{ fontWeight: 700, fontSize: '0.95rem', letterSpacing: '-0.02em', color: '#0f172a' }}>
                ClassVision
              </span>
            </div>
          </div>

          <div style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px', background: '#f1f5f9', color: '#0f172a', border: '1px solid var(--glass-border)', fontWeight: 600 }}>
            邊緣考勤
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

