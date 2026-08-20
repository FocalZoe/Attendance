// TEAM_008: 智慧多座位在座即時儀表板 (Dashboard.jsx)
// 支援即時座位分佈矩陣 (Seat Grid Matrix)、即時在座率統計與視覺化劃位編輯

import React, { useState, useEffect } from 'react';
import { Camera, Users, CheckCircle, Activity, Sparkles, Clock, LayoutGrid, Settings, AlertCircle } from 'lucide-react';
import { fetchHistoryRecords, connectWebSocket } from '../services/api';
import { getSavedSeatsConfig } from '../services/seatOccupancyService';
import CameraSimulatorModal from '../components/CameraSimulatorModal';
import SeatMapEditorModal from '../components/SeatMapEditorModal';
import ImageModal from '../components/ImageModal';

const Dashboard = () => {
  const [records, setRecords] = useState([]);
  const [latestRecord, setLatestRecord] = useState(null);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isSeatEditorOpen, setIsSeatEditorOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [seatConfig, setSeatConfig] = useState(getSavedSeatsConfig());

  // 載入歷史紀錄
  const loadRecords = async () => {
    const data = await fetchHistoryRecords({ limit: 20 });
    setRecords(data);
    if (data.length > 0) {
      setLatestRecord(data[0]);
    }
  };

  useEffect(() => {
    loadRecords();
    setSeatConfig(getSavedSeatsConfig());

    // 訂閱 WebSocket 即時考勤通報廣播
    const cleanupWs = connectWebSocket((event) => {
      if (event && (event.type === 'NEW_ATTENDANCE_RECORD' || event.data)) {
        const newRecord = event.data || event.record;
        if (newRecord) {
          console.log('[Dashboard] 收到即時座位考勤通知:', newRecord);
          setLatestRecord(newRecord);
          setRecords((prev) => [newRecord, ...prev.filter(r => r.id !== newRecord.id)].slice(0, 20));
        }
      }
    });

    return () => {
      cleanupWs();
    };
  }, []);

  const formatFullDateTime = (dateStr) => {
    if (!dateStr) return '暫無通報';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '暫無通報';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
  };

  // 解析最新一筆紀錄的 AI 座位在座狀態
  let latestAiAnalysis = latestRecord?.ai_analysis;
  if (typeof latestAiAnalysis === 'string') {
    try {
      latestAiAnalysis = JSON.parse(latestAiAnalysis);
    } catch (e) {
      latestAiAnalysis = null;
    }
  }

  const currentTotalSeats = latestAiAnalysis?.total_seats || seatConfig.seats.length || 4;
  const currentOccupiedCount = latestAiAnalysis?.occupied_count ?? (latestRecord ? 1 : 0);
  const currentAttendanceRate = latestAiAnalysis?.attendance_rate || `${((currentOccupiedCount / currentTotalSeats) * 100).toFixed(1)}%`;
  const seatStatuses = Array.isArray(latestAiAnalysis?.seat_statuses) ? latestAiAnalysis.seat_statuses : [];

  return (
    <div className="animate-fade-in">
      <header style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            即時座位與考勤儀表板 <Sparkles color="var(--accent-primary)" size={24} />
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>即時掌握各座位在座/空位狀態與出缺席統計 (個資保護無臉部追蹤)</p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {/* 座位地圖劃位設定按鈕 */}
          <button
            onClick={() => setIsSeatEditorOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)',
              color: 'white', padding: '10px 18px', borderRadius: '10px',
              fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
              transition: 'background 0.2s, transform 0.2s',
            }}
            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <Settings size={18} />
            座位配置設置 ({seatConfig.seats.length} 席)
          </button>

          {/* 模擬相機打卡按鈕 */}
          <button
            onClick={() => setIsCameraModalOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)',
              color: 'white', border: 'none', padding: '10px 22px',
              borderRadius: '10px', fontWeight: 600, fontSize: '0.9rem',
              cursor: 'pointer', boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)',
              transition: 'transform 0.2s',
            }}
            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <Camera size={18} />
            模擬相機點名 (Webcam)
          </button>
        </div>
      </header>

      {/* 統計卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <div className="glass-panel stat-card" style={{ borderTop: '4px solid var(--accent-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-title">配置座位總數</div>
              <div className="stat-value">{currentTotalSeats} <span style={{ fontSize: '1rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>席</span></div>
            </div>
            <div style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', color: 'var(--accent-primary)' }}>
              <LayoutGrid size={24} />
            </div>
          </div>
        </div>

        <div className="glass-panel stat-card" style={{ borderTop: '4px solid var(--success)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-title">即時在座率</div>
              <div className="stat-value" style={{ color: 'var(--success)' }}>
                {currentAttendanceRate}
                <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-secondary)', marginLeft: '8px' }}>
                  ({currentOccupiedCount}/{currentTotalSeats} 席)
                </span>
              </div>
            </div>
            <div style={{ padding: '12px', background: 'var(--success-bg)', borderRadius: '12px', color: 'var(--success)' }}>
              <Users size={24} />
            </div>
          </div>
        </div>

        <div className="glass-panel stat-card" style={{ borderTop: '4px solid #8b5cf6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-title">最後通報時間</div>
              <div className="stat-value" style={{ fontSize: '1.05rem', color: '#8b5cf6', fontWeight: 700, whiteSpace: 'nowrap', marginTop: '6px' }}>
                {formatFullDateTime(latestRecord?.create_at)}
              </div>
            </div>
            <div style={{ padding: '12px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '12px', color: '#8b5cf6' }}>
              <Clock size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* 即時座位分佈矩陣 (Seat Status Grid View) */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LayoutGrid size={20} color="var(--accent-primary)" />
            即時座位在座分佈矩陣 (Seat Status Matrix)
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            🟢 在座 (Occupied) | ⚪ 空位 (Vacant)
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '14px' }}>
          {seatConfig.seats.map((seat) => {
            const matchedStatus = seatStatuses.find((s) => s.seat_id === seat.seat_id);
            const isOcc = matchedStatus ? matchedStatus.status === 'OCCUPIED' : false;

            return (
              <div
                key={seat.seat_id}
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  background: isOcc ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                  border: `1.5px solid ${isOcc ? '#10b981' : 'rgba(255, 255, 255, 0.08)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  transition: 'all 0.3s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: isOcc ? '#10b981' : '#fff' }}>
                    {seat.seat_id}
                  </span>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isOcc ? '#10b981' : '#64748b', boxShadow: isOcc ? '0 0 8px #10b981' : 'none' }} />
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {seat.name}
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: isOcc ? '#10b981' : '#64748b', marginTop: '4px' }}>
                  {isOcc ? '🟢 有人在座' : '⚪ 空置'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 下方：最新捕捉畫面與即時通報清單 */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '24px', minHeight: '480px' }}>
        {/* 最新影像畫面 */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <Camera size={22} color="var(--accent-primary)" />
            <h2 style={{ fontSize: '1.2rem' }}>最新捕捉影像</h2>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--success)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }}></span>
              Supabase 即時連線
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', position: 'relative', overflow: 'hidden', minHeight: '300px' }}>
            {latestRecord ? (
              <div key={latestRecord.id} className="animate-fade-in" style={{ textAlign: 'center', padding: '16px' }}>
                <div style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }} onClick={() => setSelectedRecord(latestRecord)}>
                  <img
                    src={latestRecord.file_url}
                    alt={latestRecord.message}
                    style={{ maxWidth: '280px', maxHeight: '200px', borderRadius: '14px', border: '2.5px solid var(--success)', objectFit: 'cover', background: 'rgba(255,255,255,0.05)' }}
                  />
                  <div style={{ position: 'absolute', top: '-8px', left: '-8px', width: '24px', height: '24px', borderTop: '3.5px solid var(--success)', borderLeft: '3.5px solid var(--success)', borderRadius: '6px 0 0 0' }}></div>
                  <div style={{ position: 'absolute', bottom: '-8px', right: '-8px', width: '24px', height: '24px', borderBottom: '3.5px solid var(--success)', borderRight: '3.5px solid var(--success)', borderRadius: '0 0 6px 0' }}></div>
                </div>
                <div style={{ marginTop: '16px' }}>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '6px', color: 'var(--accent-primary)' }}>{latestRecord.message}</h3>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    通報時間: {new Date(latestRecord.create_at).toLocaleString('zh-TW')}
                  </div>
                  <div style={{ display: 'inline-block', padding: '4px 12px', background: 'var(--success-bg)', color: 'var(--success)', borderRadius: '20px', fontWeight: 600, fontSize: '0.78rem' }}>
                    在座率: {currentAttendanceRate} ({currentOccupiedCount}/{currentTotalSeats} 席)
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
                <Camera size={44} style={{ opacity: 0.3, marginBottom: '12px' }} />
                <p>等待最新打卡影像捕捉中...</p>
              </div>
            )}
          </div>
        </div>

        {/* 即時動態通報清單 */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <Activity size={22} color="var(--accent-primary)" />
            <h2 style={{ fontSize: '1.2rem' }}>即時通報紀錄</h2>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '380px' }}>
            {records.map((rec) => {
              let recAi = rec.ai_analysis;
              if (typeof recAi === 'string') {
                try { recAi = JSON.parse(recAi); } catch (e) {}
              }
              const recRate = recAi?.attendance_rate || '在座';

              return (
                <div
                  key={rec.id}
                  className="animate-fade-in"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 14px', background: 'rgba(255,255,255,0.03)',
                    borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedRecord(rec)}
                >
                  <img
                    src={rec.file_url}
                    alt={rec.message}
                    style={{ width: '42px', height: '42px', borderRadius: '8px', objectFit: 'cover', background: '#000' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {rec.message}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      {new Date(rec.create_at).toLocaleTimeString('zh-TW', { hour12: false })} · 在座率 {recRate}
                    </div>
                  </div>
                  <div style={{ color: 'var(--success)' }}>
                    <CheckCircle size={18} />
                  </div>
                </div>
              );
            })}

            {records.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 0' }}>
                尚無打卡紀錄
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 座位劃位設定 Modal */}
      <SeatMapEditorModal
        isOpen={isSeatEditorOpen}
        onClose={() => setIsSeatEditorOpen(false)}
        onSaveSuccess={(newConfig) => {
          setSeatConfig(newConfig);
        }}
      />

      {/* 相機打卡 Modal */}
      <CameraSimulatorModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onOpenSeatEditor={() => {
          setIsCameraModalOpen(false);
          setIsSeatEditorOpen(true);
        }}
        onSuccess={() => {
          loadRecords();
        }}
      />

      {/* 圖片大圖檢視 Modal */}
      <ImageModal
        record={selectedRecord}
        imageUrl={typeof selectedRecord === 'string' ? selectedRecord : selectedRecord?.file_url}
        onClose={() => setSelectedRecord(null)}
      />
    </div>
  );
};

export default Dashboard;
