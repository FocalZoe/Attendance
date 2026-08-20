// TEAM_008: 歷史考勤與多座位佔用紀錄 (History.jsx)
// 支援座位在座狀態過濾、座號卡片標記與完整 CSV 出席報表匯出

import React, { useState, useEffect, useMemo } from 'react';
import { fetchHistoryRecords } from '../services/api';
import ImageModal from '../components/ImageModal';
import { Search, RefreshCw, Eye, Calendar, User, Download, History as HistoryIcon, LayoutGrid, CheckCircle } from 'lucide-react';

const History = () => {
  const [records, setRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchHistoryRecords({ limit: 100, search: '' });
      setRecords(data);
    } catch (err) {
      console.error('[History] Load data failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 根據搜尋關鍵字過濾紀錄 (支援訊息、UUID、座號搜尋)
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const term = searchTerm.toLowerCase();
    return records.filter((r) => {
      const msg = (r.message || '').toLowerCase();
      const id = (r.id || '').toLowerCase();
      let aiStr = '';
      if (typeof r.ai_analysis === 'object') {
        aiStr = JSON.stringify(r.ai_analysis).toLowerCase();
      } else if (typeof r.ai_analysis === 'string') {
        aiStr = r.ai_analysis.toLowerCase();
      }
      return msg.includes(term) || id.includes(term) || aiStr.includes(term);
    });
  }, [records, searchTerm]);

  // 匯出 CSV 報表 (包含座位出席率與在座座號)
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      alert('目前無紀錄可匯出');
      return;
    }
    const headers = ['UUID', '通報訊息 (Message)', '打卡時間 (create_at)', '總座位數', '在座席數', '在座率', '在座座號清單', '圖片網址 (file_url)'];
    const rows = filteredRecords.map((r) => {
      let ai = r.ai_analysis;
      if (typeof ai === 'string') {
        try { ai = JSON.parse(ai); } catch (e) {}
      }
      const totalSeats = ai?.total_seats || 4;
      const occupiedCount = ai?.occupied_count ?? 1;
      const rate = ai?.attendance_rate || `${((occupiedCount / totalSeats) * 100).toFixed(1)}%`;
      const occupiedSeatsList = Array.isArray(ai?.seat_statuses)
        ? ai.seat_statuses.filter((s) => s.status === 'OCCUPIED').map((s) => s.seat_id).join(';')
        : 'S-01';

      return [
        `"${r.id}"`,
        `"${(r.message || '').replace(/"/g, '""')}"`,
        `"${new Date(r.create_at).toLocaleString('zh-TW')}"`,
        `"${totalSeats}"`,
        `"${occupiedCount}"`,
        `"${rate}"`,
        `"${occupiedSeatsList}"`,
        `"${r.file_url}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `seat_attendance_history_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="animate-fade-in">
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            歷史紀錄簿 <HistoryIcon color="var(--accent-primary)" size={24} />
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>調閱與查詢 Supabase 歷史座位在座點名紀錄 (隱私安全模式)</p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={loadData}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'rgba(255,255,255,0.05)', color: 'white',
              border: '1px solid var(--glass-border)', padding: '10px 18px',
              borderRadius: '8px', fontWeight: 600, cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            重新整理
          </button>

          <button
            onClick={handleExportCSV}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'var(--accent-primary)', color: 'white',
              border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 600,
              cursor: 'pointer', transition: 'background 0.2s',
            }}
          >
            <Download size={18} />
            匯出座位出席報表
          </button>
        </div>
      </header>

      {/* 搜尋列與計數區 */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
          <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input
            type="text"
            placeholder="搜尋通報訊息、座號 (如 A-01) 或關鍵字..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%', padding: '12px 16px 12px 46px',
              background: 'rgba(0,0,0,0.25)', border: '1px solid var(--glass-border)',
              borderRadius: '8px', color: 'white', outline: 'none', fontSize: '0.9rem',
            }}
          />
        </div>

        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          共符合 <strong style={{ color: 'var(--accent-primary)', fontSize: '1.1rem' }}>{filteredRecords.length}</strong> 筆歷史紀錄
        </div>
      </div>

      {/* 照片卡片網格 Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
        {filteredRecords.map((rec) => {
          let ai = rec.ai_analysis;
          if (typeof ai === 'string') {
            try { ai = JSON.parse(ai); } catch (e) {}
          }
          const totalSeats = ai?.total_seats || 4;
          const occupiedCount = ai?.occupied_count ?? (ai?.face_count || 1);
          const rate = ai?.attendance_rate || `${((occupiedCount / totalSeats) * 100).toFixed(1)}%`;
          const occupiedSeats = Array.isArray(ai?.seat_statuses)
            ? ai.seat_statuses.filter((s) => s.status === 'OCCUPIED').map((s) => s.seat_id)
            : [];

          return (
            <div
              key={rec.id}
              className="glass-panel"
              style={{
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'translateY(-3px)'}
              onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              {/* 照片預覽容器 */}
              <div
                onClick={() => setSelectedRecord(rec)}
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '190px',
                  background: '#090d16',
                  cursor: 'pointer',
                  overflow: 'hidden',
                }}
              >
                <img
                  src={rec.file_url}
                  alt={rec.message}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />

                <div style={{
                  position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', opacity: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.2s',
                }}
                onMouseOver={e => e.currentTarget.style.opacity = '1'}
                onMouseOut={e => e.currentTarget.style.opacity = '0'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', background: 'rgba(0,0,0,0.6)', padding: '6px 14px', borderRadius: '20px', fontSize: '0.85rem' }}>
                    <Eye size={16} /> 觀看大圖
                  </div>
                </div>

                {/* 在座率標籤 */}
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  background: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(4px)',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.45)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  zIndex: 2,
                  fontWeight: 600,
                }}>
                  <LayoutGrid size={12} /> 在座率: {rate}
                </div>
              </div>

              {/* 卡片內容 */}
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ fontSize: '0.98rem', fontWeight: 600, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <LayoutGrid size={16} /> {rec.message}
                  </h4>

                  {/* 在座座號標籤列 */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {occupiedSeats.length > 0 ? (
                      occupiedSeats.map((sid) => (
                        <span
                          key={sid}
                          style={{
                            fontSize: '0.74rem',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#10b981',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            fontWeight: 600,
                          }}
                        >
                          🟢 {sid}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                        在座: {occupiedCount}/{totalSeats} 席
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={14} /> {new Date(rec.create_at).toLocaleString('zh-TW')}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 無資料提示 */}
      {filteredRecords.length === 0 && !loading && (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
          <p>沒有找到符合條件的考勤歷史紀錄。</p>
        </div>
      )}

      {/* 大圖檢視 Modal */}
      <ImageModal
        record={selectedRecord}
        imageUrl={typeof selectedRecord === 'string' ? selectedRecord : selectedRecord?.file_url}
        onClose={() => setSelectedRecord(null)}
      />
    </div>
  );
};

export default History;
