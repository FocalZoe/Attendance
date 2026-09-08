import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, History, LayoutGrid, X } from 'lucide-react';

const Sidebar = ({ isMobileOpen, onClose }) => {
  return (
    <>
      {/* 行動端遮罩層 (Mobile Backdrop，純色無模糊) */}
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
        <div style={{ marginBottom: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '6px',
              background: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: 'none'
            }}>
              <LayoutGrid size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', margin: 0, color: '#0f172a', fontWeight: 700, letterSpacing: '-0.02em' }}>
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
              background: '#f1f5f9',
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

        <nav style={{ flex: 1 }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '12px', marginLeft: '4px' }}>
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

