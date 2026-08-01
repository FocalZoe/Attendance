// TEAM_001: 移除 Mock 模擬邏輯並改為真實 API/WS 訂閱與相機打卡 (Dashboard.jsx)
import React, { useState, useEffect } from 'react';
import { Camera, Users, CheckCircle, Activity, Sparkles } from 'lucide-react';
import { fetchHistoryRecords, connectWebSocket } from '../services/api';
import CameraSimulatorModal from '../components/CameraSimulatorModal';
import ImageModal from '../components/ImageModal';

const Dashboard = () => {
  const [records, setRecords] = useState([]);
  const [latestRecord, setLatestRecord] = useState(null);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  // 1. 載入 Supabase store_data 歷史打卡紀錄
  const loadRecords = async () => {
    const data = await fetchHistoryRecords({ limit: 20 });
    setRecords(data);
    if (data.length > 0) {
      setLatestRecord(data[0]);
    }
  };

  useEffect(() => {
    loadRecords();

    // 2. 訂閱 WebSocket 即時考勤通報廣播
    const cleanupWs = connectWebSocket((event) => {
      if (event && (event.type === 'NEW_ATTENDANCE_RECORD' || event.data)) {
        const newRecord = event.data || event.record;
        if (newRecord) {
          console.log('[TEAM_001 Dashboard] 收到即時考勤通知:', newRecord);
          setLatestRecord(newRecord);
          setRecords((prev) => [newRecord, ...prev.filter(r => r.id !== newRecord.id)].slice(0, 20));
        }
      }
    });

    return () => {
      cleanupWs();
    };
  }, []);

  return (
    <div className="animate-fade-in">
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            即時儀表板 <Sparkles color="var(--accent-primary)" size={24} />
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>即時掌握教室內出缺席狀況與最新捕捉影像</p>
        </div>

        {/* TEAM_001: 模擬相機打卡按鈕 */}
        <button
          onClick={() => setIsCameraModalOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)',
            color: 'white', border: 'none', padding: '12px 24px',
            borderRadius: '10px', fontWeight: 600, fontSize: '0.95rem',
            cursor: 'pointer', boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)',
            transition: 'transform 0.2s, boxShadow 0.2s'
          }}
          onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <Camera size={20} />
          模擬相機打卡 (Webcam)
        </button>
      </header>

      {/* 統計卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <div className="glass-panel stat-card" style={{ borderTop: '4px solid var(--accent-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-title">累積考勤紀錄</div>
              <div className="stat-value">{records.length}</div>
            </div>
            <div style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', color: 'var(--accent-primary)' }}>
              <Users size={24} />
            </div>
          </div>
        </div>

        <div className="glass-panel stat-card" style={{ borderTop: '4px solid var(--success)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-title">成功辨識通報</div>
              <div className="stat-value">{records.length}</div>
            </div>
            <div style={{ padding: '12px', background: 'var(--success-bg)', borderRadius: '12px', color: 'var(--success)' }}>
              <CheckCircle size={24} />
            </div>
          </div>
        </div>

        <div className="glass-panel stat-card" style={{ borderTop: '4px solid #8b5cf6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-title">即時對講連線</div>
              <div className="stat-value" style={{ fontSize: '1.2rem', color: 'var(--success)' }}>運作中</div>
            </div>
            <div style={{ padding: '12px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '12px', color: '#8b5cf6' }}>
              <Activity size={24} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '24px', height: '540px' }}>
        {/* 最新捕捉影像畫面 */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <Camera size={24} color="var(--accent-primary)" />
            <h2 style={{ fontSize: '1.25rem' }}>最新捕捉影像</h2>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', color: 'var(--success)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }}></span>
              Supabase 數據連線中
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', position: 'relative', overflow: 'hidden', minHeight: '340px' }}>
            {latestRecord ? (
              <div key={latestRecord.id} className="animate-fade-in" style={{ textAlign: 'center', padding: '20px' }}>
                <div style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }} onClick={() => setSelectedImage(latestRecord.file_url)}>
                  <img
                    src={latestRecord.file_url}
                    alt={latestRecord.message}
                    style={{ maxWidth: '280px', maxHeight: '220px', borderRadius: '16px', border: '3px solid var(--success)', objectFit: 'cover', background: 'rgba(255,255,255,0.05)' }}
                  />
                  <div style={{ position: 'absolute', top: '-10px', left: '-10px', width: '30px', height: '30px', borderTop: '4px solid var(--success)', borderLeft: '4px solid var(--success)', borderRadius: '8px 0 0 0' }}></div>
                  <div style={{ position: 'absolute', bottom: '-10px', right: '-10px', width: '30px', height: '30px', borderBottom: '4px solid var(--success)', borderRight: '4px solid var(--success)', borderRadius: '0 0 8px 0' }}></div>
                </div>
                <div style={{ marginTop: '20px' }}>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '8px', color: 'var(--accent-primary)' }}>{latestRecord.message}</h3>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    打卡時間: {new Date(latestRecord.create_at).toLocaleString('zh-TW')}
                  </div>
                  <div style={{ display: 'inline-block', padding: '4px 14px', background: 'var(--success-bg)', color: 'var(--success)', borderRadius: '20px', fontWeight: 600, fontSize: '0.8rem' }}>
                    Supabase ID: {latestRecord.id?.slice(0, 8)}...
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
                <Camera size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
                <p>等待最新打卡影像捕捉中...</p>
              </div>
            )}

            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
              background: 'linear-gradient(to right, transparent, var(--success), transparent)',
              boxShadow: '0 0 10px var(--success)', animation: 'scan 2.5s infinite linear'
            }}></div>
            <style>{`
              @keyframes scan {
                0% { transform: translateY(0); opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { transform: translateY(340px); opacity: 0; }
              }
            `}</style>
          </div>
        </div>

        {/* 即時動態清單 */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <Activity size={24} color="var(--accent-primary)" />
            <h2 style={{ fontSize: '1.25rem' }}>即時動態</h2>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', maxHeight: '420px' }}>
            {records.map((rec) => (
              <div
                key={rec.id}
                className="animate-fade-in"
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '10px 14px', background: 'rgba(255,255,255,0.03)',
                  borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer'
                }}
                onClick={() => setSelectedImage(rec.file_url)}
              >
                <img
                  src={rec.file_url}
                  alt={rec.message}
                  style={{ width: '44px', height: '44px', borderRadius: '10px', objectFit: 'cover', background: '#000' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {rec.message}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {new Date(rec.create_at).toLocaleTimeString('zh-TW', { hour12: false })}
                  </div>
                </div>
                <div style={{ color: 'var(--success)' }}>
                  <CheckCircle size={18} />
                </div>
              </div>
            ))}

            {records.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 0' }}>
                尚無打卡紀錄
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TEAM_001: 相機打卡 Modal */}
      <CameraSimulatorModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onSuccess={() => {
          loadRecords();
        }}
      />

      {/* TEAM_001: 圖片檢視 Modal */}
      <ImageModal
        imageUrl={selectedImage}
        onClose={() => setSelectedImage(null)}
      />
    </div>
  );
};

export default Dashboard;
