import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, History, Users, Settings } from 'lucide-react';

const Sidebar = () => {
  return (
    <aside style={{
      width: '260px',
      height: '100vh',
      padding: '24px',
      borderRight: '1px solid var(--glass-border)',
      background: 'rgba(15, 23, 42, 0.4)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 10
    }}>
      <div style={{ marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '12px' }}>
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
          <Users size={24} />
        </div>
        <div>
          <h2 style={{ fontSize: '1.2rem', margin: 0, background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            ClassVision
          </h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>智慧點名系統</span>
        </div>
      </div>

      <nav style={{ flex: 1 }}>
        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '12px', marginLeft: '4px' }}>
          Menu
        </div>
        
        <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={20} />
          即時儀表板
        </NavLink>
        
        <NavLink to="/history" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <History size={20} />
          歷史紀錄簿
        </NavLink>
      </nav>

      <div style={{ marginTop: 'auto' }}>
        <NavLink to="/settings" className="nav-item" onClick={(e) => e.preventDefault()} style={{ opacity: 0.5, cursor: 'not-allowed' }}>
          <Settings size={20} />
          系統設定 (未開放)
        </NavLink>
      </div>
    </aside>
  );
};

export default Sidebar;
