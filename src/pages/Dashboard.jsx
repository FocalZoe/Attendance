import React, { useState, useEffect } from 'react';
import { Camera, Users, CheckCircle, XCircle, Activity } from 'lucide-react';
import { STUDENTS } from '../mock/data';

const Dashboard = () => {
  const [recentScans, setRecentScans] = useState([]);
  const [latestScan, setLatestScan] = useState(null);
  
  // Simulate incoming scans
  useEffect(() => {
    // Generate initial scans
    const initial = STUDENTS.slice(0, 3).map(s => ({
      ...s,
      timestamp: new Date(),
      confidence: (85 + Math.random() * 14).toFixed(1)
    }));
    setRecentScans(initial);
    setLatestScan(initial[0]);

    const interval = setInterval(() => {
      const randomStudent = STUDENTS[Math.floor(Math.random() * STUDENTS.length)];
      const newScan = {
        ...randomStudent,
        timestamp: new Date(),
        confidence: (85 + Math.random() * 14).toFixed(1)
      };
      
      setLatestScan(newScan);
      setRecentScans(prev => [newScan, ...prev].slice(0, 5));
    }, 5000); // New scan every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="animate-fade-in">
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>即時儀表板</h1>
        <p style={{ color: 'var(--text-secondary)' }}>即時掌握教室內出缺席狀況與最新捕捉影像</p>
      </header>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <div className="glass-panel stat-card" style={{ borderTop: '4px solid var(--accent-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-title">應到人數</div>
              <div className="stat-value">{STUDENTS.length}</div>
            </div>
            <div style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', color: 'var(--accent-primary)' }}>
              <Users size={24} />
            </div>
          </div>
        </div>
        
        <div className="glass-panel stat-card" style={{ borderTop: '4px solid var(--success)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-title">實到人數</div>
              <div className="stat-value">5</div>
            </div>
            <div style={{ padding: '12px', background: 'var(--success-bg)', borderRadius: '12px', color: 'var(--success)' }}>
              <CheckCircle size={24} />
            </div>
          </div>
        </div>

        <div className="glass-panel stat-card" style={{ borderTop: '4px solid var(--danger)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-title">缺席人數</div>
              <div className="stat-value">3</div>
            </div>
            <div style={{ padding: '12px', background: 'var(--danger-bg)', borderRadius: '12px', color: 'var(--danger)' }}>
              <XCircle size={24} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Main Camera / Latest Capture View */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <Camera size={24} color="var(--accent-primary)" />
            <h2 style={{ fontSize: '1.25rem' }}>最新捕捉影像</h2>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', color: 'var(--success)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }}></span>
              系統運作中
            </div>
          </div>
          
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', position: 'relative', overflow: 'hidden', minHeight: '320px' }}>
            {/* Simulated bounding box on video feed */}
            {latestScan ? (
              <div key={latestScan.timestamp.getTime()} className="animate-fade-in" style={{ textAlign: 'center' }}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img src={latestScan.avatar} alt={latestScan.name} style={{ width: '160px', height: '160px', borderRadius: '20px', border: '4px solid var(--success)', padding: '4px', background: 'rgba(255,255,255,0.1)' }} />
                  {/* Bounding box corners simulation */}
                  <div style={{ position: 'absolute', top: '-10px', left: '-10px', width: '30px', height: '30px', borderTop: '4px solid var(--success)', borderLeft: '4px solid var(--success)', borderRadius: '8px 0 0 0' }}></div>
                  <div style={{ position: 'absolute', bottom: '-10px', right: '-10px', width: '30px', height: '30px', borderBottom: '4px solid var(--success)', borderRight: '4px solid var(--success)', borderRadius: '0 0 8px 0' }}></div>
                </div>
                <div style={{ marginTop: '24px' }}>
                  <h3 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>{latestScan.name}</h3>
                  <div style={{ display: 'inline-block', padding: '6px 16px', background: 'var(--success-bg)', color: 'var(--success)', borderRadius: '20px', fontWeight: 600, fontSize: '0.875rem' }}>
                    辨識成功 (信心度: {latestScan.confidence}%)
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-secondary)' }}>等待捕捉中...</div>
            )}
            
            {/* Scanning overlay effect */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '2px',
              background: 'linear-gradient(to right, transparent, var(--success), transparent)',
              boxShadow: '0 0 10px var(--success)',
              animation: 'scan 2s infinite linear'
            }}></div>
            <style>{`
              @keyframes scan {
                0% { transform: translateY(0); opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { transform: translateY(320px); opacity: 0; }
              }
            `}</style>
          </div>
        </div>

        {/* Recent Activity Sidebar */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <Activity size={24} color="var(--accent-primary)" />
            <h2 style={{ fontSize: '1.25rem' }}>即時動態</h2>
          </div>
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {recentScans.map((scan, index) => (
              <div key={index} className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <img src={scan.avatar} alt={scan.name} style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#fff' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>{scan.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {scan.timestamp.toLocaleTimeString('zh-TW', { hour12: false })}
                  </div>
                </div>
                <div style={{ color: 'var(--success)' }}>
                  <CheckCircle size={20} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
