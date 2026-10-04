import React, { memo } from 'react';
import { Activity, GraduationCap, UserX, UserCheck, AlertCircle, CheckCircle } from 'lucide-react';

const AttendanceRecordsList = memo(({ records, onSelectRecord }) => {
  return (
    <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <Activity size={22} color="var(--accent-primary)" />
        <h2 style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>即時通報紀錄簿</h2>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          overflowY: 'auto',
          maxHeight: '460px',
        }}
      >
        {records.map((rec) => {
          let recAi = rec.ai_analysis;
          if (typeof recAi === 'string') {
            try {
              recAi = JSON.parse(recAi);
            } catch (e) {}
          }

          const recStatuses = Array.isArray(recAi?.seat_statuses) ? recAi.seat_statuses : [];
          const recVacantSeats = recStatuses.filter((s) => s.status === 'VACANT').map((s) => s.seat_id);
          const recRate = recAi?.attendance_rate || '0.0%';

          return (
            <div
              key={rec.id}
              className="animate-fade-in"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                background: '#ffffff',
                borderRadius: '4px',
                border: '1px solid var(--glass-border)',
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              onClick={() => onSelectRecord(rec)}
              onMouseOver={(e) => (e.currentTarget.style.background = 'var(--accent-light)')}
              onMouseOut={(e) => (e.currentTarget.style.background = '#ffffff')}
            >
              <img
                src={rec.file_url}
                alt={rec.message}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '4px',
                  objectFit: 'cover',
                  background: '#1a1613',
                }}
              />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: '0.92rem',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <GraduationCap size={16} color="var(--accent-primary)" />
                  {rec.message}
                </div>

                <div
                  style={{
                    fontSize: '0.78rem',
                    marginTop: '3px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    flexWrap: 'wrap',
                  }}
                >
                  {recVacantSeats.length > 0 ? (
                    <span
                      style={{
                        color: 'var(--danger)',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      <UserX size={13} /> 未到: {recVacantSeats.join(', ')} ({recVacantSeats.length} 席)
                    </span>
                  ) : (
                    <span
                      style={{
                        color: 'var(--success)',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      <UserCheck size={13} /> 全員在座
                    </span>
                  )}
                  <span style={{ color: 'var(--text-secondary)' }}>· 在座率 {recRate}</span>
                </div>

                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {new Date(rec.create_at).toLocaleTimeString('zh-TW', { hour12: false })}
                </div>
              </div>

              <div style={{ color: recVacantSeats.length > 0 ? 'var(--danger)' : 'var(--success)' }}>
                {recVacantSeats.length > 0 ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
              </div>
            </div>
          );
        })}

        {records.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 0' }}>
            尚無通報紀錄
          </div>
        )}
      </div>
    </div>
  );
});

AttendanceRecordsList.displayName = 'AttendanceRecordsList';
export default AttendanceRecordsList;
