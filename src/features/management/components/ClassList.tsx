import React from 'react';
import { ChevronRight } from 'lucide-react';

interface ClassItem {
  id: string;
  class_name: string;
  account: string;
  student_count?: number;
  active_layout_key?: string;
  seat_layout?: Record<string, any>;
}

interface ClassListProps {
  classes: ClassItem[];
  selectedClassId: string | null;
  onSelectClass: (id: string) => void;
}

export const ClassList: React.FC<ClassListProps> = ({
  classes,
  selectedClassId,
  onSelectClass,
}) => {
  if (classes.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        目前尚無建立任何班級
      </div>
    );
  }

  return (
    <div className="class-list-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {classes.map((cls) => {
        const isSelected = cls.id === selectedClassId;
        const layoutCount = Object.keys(cls.seat_layout || {}).length;

        return (
          <div
            key={cls.id}
            onClick={() => onSelectClass(cls.id)}
            style={{
              padding: '14px 16px',
              borderRadius: '10px',
              background: isSelected ? 'var(--accent-light)' : 'white',
              border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.2s ease',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                {cls.class_name}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: '12px' }}>
                <span>帳號: {cls.account}</span>
                <span>學生: {cls.student_count || 0} 人</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
              <span style={{
                fontSize: '0.75rem',
                padding: '2px 8px',
                borderRadius: '12px',
                background: 'rgba(0,0,0,0.05)',
              }}>
                {layoutCount} 個佈局
              </span>
              <ChevronRight size={18} />
            </div>
          </div>
        );
      })}
    </div>
  );
};
