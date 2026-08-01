import React, { useState, useMemo } from 'react';
import { generateHistoryData } from '../mock/data';
import { Calendar, Filter, Search, Download } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const History = () => {
  // Generate static data for demo
  const [data] = useState(() => generateHistoryData(50));
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const filteredData = useMemo(() => {
    return data.filter(record => {
      const matchesSearch = record.studentName.includes(searchTerm) || record.studentId.includes(searchTerm);
      const matchesStatus = filterStatus === 'all' || record.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [data, searchTerm, filterStatus]);

  return (
    <div className="animate-fade-in">
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>歷史紀錄簿</h1>
          <p style={{ color: 'var(--text-secondary)' }}>查詢與匯出過往的點名紀錄</p>
        </div>
        <button style={{ 
          display: 'flex', alignItems: 'center', gap: '8px', 
          background: 'var(--accent-primary)', color: 'white', 
          padding: '10px 20px', borderRadius: '8px', fontWeight: 600,
          transition: 'background 0.2s'
        }}
        onMouseOver={e => e.currentTarget.style.background = 'var(--accent-hover)'}
        onMouseOut={e => e.currentTarget.style.background = 'var(--accent-primary)'}
        >
          <Download size={18} />
          匯出報表
        </button>
      </header>

      <div className="glass-panel" style={{ padding: '24px' }}>
        {/* Filters */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              placeholder="搜尋姓名或學號..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%', padding: '12px 16px 12px 42px',
                background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)',
                borderRadius: '8px', color: 'white', outline: 'none'
              }}
            />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '0 16px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <Filter size={18} color="var(--text-secondary)" />
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                background: 'transparent', border: 'none', color: 'white', 
                padding: '12px 0', outline: 'none', cursor: 'pointer'
              }}
            >
              <option value="all" style={{ background: 'var(--bg-secondary)' }}>全部狀態</option>
              <option value="present" style={{ background: 'var(--bg-secondary)' }}>出席</option>
              <option value="absent" style={{ background: 'var(--bg-secondary)' }}>缺席</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '0 16px', borderRadius: '8px', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
            <Calendar size={18} />
            <span style={{ fontSize: '0.875rem' }}>{format(new Date(), 'yyyy-MM-dd')}</span>
          </div>
        </div>

        {/* Data Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="history-table">
            <thead>
              <tr>
                <th>學生</th>
                <th>學號</th>
                <th>捕捉時間</th>
                <th>狀態</th>
                <th>辨識信心度</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length > 0 ? (
                filteredData.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img src={record.avatar} alt={record.studentName} style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fff' }} />
                        <span style={{ fontWeight: 500 }}>{record.studentName}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{record.studentId}</td>
                    <td>{format(parseISO(record.timestamp), 'HH:mm:ss')}</td>
                    <td>
                      {record.status === 'present' ? (
                        <span className="status-badge status-present">出席</span>
                      ) : (
                        <span className="status-badge status-absent">缺席</span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{record.confidence}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
                    查無符合條件的紀錄
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          <div>顯示 {filteredData.length} 筆紀錄</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', color: 'white' }}>上一頁</button>
            <button style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', color: 'white' }}>下一頁</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default History;
