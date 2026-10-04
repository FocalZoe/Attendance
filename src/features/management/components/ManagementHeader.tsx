import React from 'react';
import { School, ArrowLeft, RefreshCw, LogOut, Plus } from 'lucide-react';

interface ManagementHeaderProps {
  isAdmin: boolean;
  loading: boolean;
  onRefresh: () => void;
  onBack: () => void;
  onOpenAddClass: () => void;
  onLogout: () => void;
}

export const ManagementHeader: React.FC<ManagementHeaderProps> = ({
  isAdmin,
  loading,
  onRefresh,
  onBack,
  onOpenAddClass,
  onLogout,
}) => {
  return (
    <header className="management-header" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 24px',
      background: 'rgba(255, 255, 255, 0.85)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid var(--glass-border)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            color: 'var(--text-secondary)',
          }}
          title="返回儀表板"
        >
          <ArrowLeft size={20} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <School size={24} color="var(--accent-primary)" />
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            班級空間與劃位後台
          </h1>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {isAdmin && (
          <button
            onClick={onOpenAddClass}
            className="btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '0.88rem',
              fontWeight: 600,
            }}
          >
            <Plus size={16} />
            新增班級
          </button>
        )}
        <button
          onClick={onRefresh}
          disabled={loading}
          style={{
            background: 'white',
            border: '1px solid var(--glass-border)',
            borderRadius: '8px',
            padding: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: 'var(--text-primary)',
          }}
          title="重新整理"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
        <button
          onClick={onLogout}
          style={{
            background: 'white',
            border: '1px solid #fee2e2',
            borderRadius: '8px',
            padding: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: '#dc2626',
          }}
          title="登出"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
};
