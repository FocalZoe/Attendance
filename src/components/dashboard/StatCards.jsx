import React, { memo } from 'react';
import { LayoutGrid, UserCheck, UserX, Clock } from 'lucide-react';

const StatCards = memo(({
  currentTotalSeats,
  currentOccupiedCount,
  currentVacantCount,
  currentAttendanceRate,
  lastFormattedTime,
}) => {
  return (
    <div className="stat-cards-grid">
      <div className="glass-panel stat-card" style={{ borderTop: '4px solid var(--accent-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="stat-title">應到座位總數</div>
            <div className="stat-value">
              {currentTotalSeats}{' '}
              <span style={{ fontSize: '1rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>席</span>
            </div>
          </div>
          <div style={{ padding: '10px', background: 'var(--bg-subtle)', borderRadius: '4px', color: 'var(--text-primary)' }}>
            <LayoutGrid size={22} />
          </div>
        </div>
      </div>

      <div className="glass-panel stat-card" style={{ borderTop: '4px solid var(--success)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="stat-title">實到在座率</div>
            <div
              className="stat-value"
              style={{ color: currentOccupiedCount > 0 ? 'var(--success)' : 'var(--text-secondary)' }}
            >
              {currentAttendanceRate}
              <span
                style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-secondary)', marginLeft: '8px' }}
              >
                ({currentOccupiedCount}/{currentTotalSeats} 席)
              </span>
            </div>
          </div>
          <div style={{ padding: '10px', background: 'var(--success-bg)', borderRadius: '4px', color: 'var(--success)' }}>
            <UserCheck size={22} />
          </div>
        </div>
      </div>

      <div className="glass-panel stat-card" style={{ borderTop: '4px solid var(--danger)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="stat-title">未到/缺席人數</div>
            <div
              className="stat-value"
              style={{ color: currentVacantCount > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}
            >
              {currentVacantCount}{' '}
              <span style={{ fontSize: '1rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>席</span>
            </div>
          </div>
          <div style={{ padding: '10px', background: 'var(--danger-bg)', borderRadius: '4px', color: 'var(--danger)' }}>
            <UserX size={22} />
          </div>
        </div>
      </div>

      <div className="glass-panel stat-card" style={{ borderTop: '4px solid var(--accent-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="stat-title">最後點名時間</div>
            <div
              className="stat-value"
              style={{
                fontSize: '1.05rem',
                color: 'var(--text-primary)',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                marginTop: '6px',
              }}
            >
              {lastFormattedTime}
            </div>
          </div>
          <div style={{ padding: '10px', background: 'var(--accent-light)', borderRadius: '4px', color: 'var(--accent-primary)' }}>
            <Clock size={22} />
          </div>
        </div>
      </div>
    </div>
  );
});

StatCards.displayName = 'StatCards';
export default StatCards;
