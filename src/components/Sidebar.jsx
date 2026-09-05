import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, History, LayoutGrid, X } from 'lucide-react';

const Sidebar = ({ isMobileOpen, onClose }) => {
  return (
    <>
      {/* 行動端遮罩層 (Mobile Backdrop) */}
      {isMobileOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
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
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 100,
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div style={{ marginBottom: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)'
            }}>
              <LayoutGrid size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', margin: 0, background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                ClassVision
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>智慧座位考勤系統</span>
            </div>
          </div>

          {/* 行動端關閉按鈕 */}
          <button
            onClick={onClose}
            className="mobile-only"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: 'none',
              color: 'var(--text-secondary)',
              padding: '6px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <nav style={{ flex: 1 }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '12px', marginLeft: '4px' }}>
            功能導覽
          </div>

          <NavLink
            to="/"
            onClick={() => onClose && onClose()}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <LayoutDashboard size={20} />
            即時儀表板
          </NavLink>

          <NavLink
            to="/history"
            onClick={() => onClose && onClose()}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <History size={20} />
            歷史紀錄簿
          </NavLink>
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;

