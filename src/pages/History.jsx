// TEAM_001: 參考 Frontend-web 重構歷史紀錄卡片與大圖燈箱 (History.jsx)
import React, { useState, useEffect, useMemo } from 'react';
import { fetchHistoryRecords } from '../services/api';
import ImageModal from '../components/ImageModal';
import { Search, RefreshCw, Eye, Calendar, User, Download, History as HistoryIcon } from 'lucide-react';

const History = () => {
  const [records, setRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchHistoryRecords({ limit: 100, search: '' });
      setRecords(data);
    } catch (err) {
      console.error('[TEAM_001 History] Load data failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 根據搜尋關鍵字過濾紀錄
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const term = searchTerm.toLowerCase();
    return records.filter((r) =>
      (r.message || '').toLowerCase().includes(term) ||
      (r.id || '').toLowerCase().includes(term)
    );
  }, [records, searchTerm]);

  // 匯出 CSV 報表
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      alert('目前無紀錄可匯出');
      return;
    }
    const headers = ['UUID', '通報訊息 (Message)', '打卡時間 (create_at)', '圖片網址 (file_url)'];
    const rows = filteredRecords.map((r) => [
      `"${r.id}"`,
      `"${(r.message || '').replace(/"/g, '""')}"`,
      `"${new Date(r.create_at).toLocaleString('zh-TW')}"`,
      `"${r.file_url}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `attendance_history_${new Date().toISOString().slice(0, 10)}.csv`);
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
          <p style={{ color: 'var(--text-secondary)' }}>調閱與查詢 Supabase store_data 過往所有考勤打卡圖片紀錄</p>
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
              transition: 'background 0.2s'
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
              cursor: 'pointer', transition: 'background 0.2s'
            }}
          >
            <Download size={18} />
            匯出報表
          </button>
        </div>
      </header>

      {/* 搜尋列與計數區 */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
          <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input
            type="text"
            placeholder="搜尋打卡訊息、人員姓名或關鍵字..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%', padding: '12px 16px 12px 46px',
              background: 'rgba(0,0,0,0.25)', border: '1px solid var(--glass-border)',
              borderRadius: '8px', color: 'white', outline: 'none', fontSize: '0.9rem'
            }}
          />
        </div>

        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          共符合 <strong style={{ color: 'var(--accent-primary)', fontSize: '1.1rem' }}>{filteredRecords.length}</strong> 筆歷史紀錄
        </div>
      </div>

      {/* 照片卡片網格 Layout (參考 Frontend-web HistoryList) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
        {filteredRecords.map((rec) => (
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
            {/* 照片容器：點擊開啟 ImageModal 大圖 */}
            <div
              onClick={() => setSelectedImage(rec.file_url)}
              style={{
                position: 'relative',
                width: '100%',
                height: '200px',
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
            </div>

            {/* 卡片資訊 */}
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, justifyContent: 'space-between' }}>
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <User size={16} /> {rec.message}
                </h4>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={14} /> {new Date(rec.create_at).toLocaleString('zh-TW')}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 無資料提示 */}
      {filteredRecords.length === 0 && !loading && (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
          <p>沒有找到符合條件的考勤歷史紀錄。</p>
        </div>
      )}

      {/* TEAM_001: 大圖檢視 Modal */}
      <ImageModal
        imageUrl={selectedImage}
        onClose={() => setSelectedImage(null)}
      />
    </div>
  );
};

export default History;
