// ==============================================================================
// ClassVision / Zoe Attendance - 自動點名排程管理彈窗 (ScheduleModal.jsx)
// 支援新增/編輯/刪除固定排程、全域開關與標準範本一鍵載入
// ==============================================================================

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Clock, Plus, Trash2, Power, RotateCcw, Calendar, Check, AlertCircle, Sparkles, Bell } from 'lucide-react';
import { getSavedSchedulesConfig, saveSchedulesConfig, getDefaultSchedules, getNextUpcomingSchedule } from '../services/scheduleService';

export const ScheduleModal = ({ isOpen, onClose, onConfigChange }) => {
  const [config, setConfig] = useState(getSavedSchedulesConfig());
  const [newTime, setNewTime] = useState('08:05');
  const [newPeriod, setNewPeriod] = useState('第 1 節');
  const [customPeriod, setCustomPeriod] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const saved = getSavedSchedulesConfig();
      setConfig(saved);
      setSavedNotice(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 儲存並通知父層
  const updateAndSave = (newConfig) => {
    setConfig(newConfig);
    saveSchedulesConfig(newConfig);
    if (onConfigChange) {
      onConfigChange(newConfig);
    }
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  // 切換全域主開關
  const handleToggleGlobal = () => {
    const updated = {
      ...config,
      enabled: !config.enabled,
    };
    updateAndSave(updated);
  };

  // 新增排程
  const handleAddSchedule = (e) => {
    e.preventDefault();
    if (!newTime) return;

    const periodName = customPeriod.trim() ? customPeriod.trim() : newPeriod;

    // 檢查是否重複時間
    const exists = config.schedules.some((s) => s.time === newTime);
    if (exists) {
      alert(`已存在 ${newTime} 的排程時間點，請設定不同時間。`);
      return;
    }

    const newSchedule = {
      id: `sch-${Date.now()}`,
      time: newTime,
      period: periodName,
      enabled: true,
    };

    const updatedSchedules = [...config.schedules, newSchedule].sort((a, b) => a.time.localeCompare(b.time));
    updateAndSave({
      ...config,
      schedules: updatedSchedules,
    });

    setCustomPeriod('');
  };

  // 切換單項排程開關
  const handleToggleItem = (id) => {
    const updatedSchedules = config.schedules.map((s) =>
      s.id === id ? { ...s, enabled: !s.enabled } : s
    );
    updateAndSave({
      ...config,
      schedules: updatedSchedules,
    });
  };

  // 刪除單項排程
  const handleDeleteItem = (id) => {
    const updatedSchedules = config.schedules.filter((s) => s.id !== id);
    updateAndSave({
      ...config,
      schedules: updatedSchedules,
    });
  };

  // 載入預設課堂範本
  const handleLoadDefaults = () => {
    if (window.confirm('確定要載入標準課堂排程範本（08:05, 09:05, 10:05...）嗎？現有排程將被替換。')) {
      const defaults = getDefaultSchedules();
      updateAndSave({
        ...config,
        schedules: defaults,
      });
    }
  };

  // 清空所有排程
  const handleClearAll = () => {
    if (window.confirm('確定要清空所有自動點名排程嗎？')) {
      updateAndSave({
        ...config,
        schedules: [],
      });
    }
  };

  const nextUpcoming = getNextUpcomingSchedule(config);

  const modalContent = (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: '20px',
        boxSizing: 'border-box',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '92vh',
          overflowY: 'auto',
          background: '#1e293b',
          borderRadius: '18px',
          color: '#fff',
          padding: '26px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.9)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Header 標題區 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '10px', background: 'rgba(59, 130, 246, 0.15)', borderRadius: '12px', color: 'var(--accent-primary)' }}>
              <Clock size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                定時自動點名排程管理
              </h2>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                設定固定排程時間，時間一到系統將自動拍照與 AI 辨識通報
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={22} />
          </button>
        </div>

        {/* 全域自動點名總開關面板 */}
        <div
          style={{
            background: config.enabled ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${config.enabled ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.3)'}`,
            padding: '16px 20px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: config.enabled ? '#10b981' : '#ef4444',
                boxShadow: config.enabled ? '0 0 10px #10b981' : 'none',
              }}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: config.enabled ? '#10b981' : '#f87171' }}>
                自動點名系統：{config.enabled ? '運行中 (ENABLED)' : '已暫停 (PAUSED)'}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '2px' }}>
                {config.enabled
                  ? (nextUpcoming ? `下一次預定點名：${nextUpcoming.formattedText}` : '目前無已啟用的排程時間')
                  : '排程已暫停，到達時間將不自動點名 (手動點名仍隨時可用)'}
              </div>
            </div>
          </div>

          <button
            onClick={handleToggleGlobal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.85rem',
              border: 'none',
              cursor: 'pointer',
              background: config.enabled ? 'rgba(239, 68, 68, 0.85)' : 'rgba(16, 185, 129, 0.85)',
              color: '#fff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              transition: 'all 0.2s',
            }}
          >
            <Power size={15} />
            {config.enabled ? '暫停自動點名' : '啟動自動點名'}
          </button>
        </div>

        {/* 新增排程設定表單 */}
        <form
          onSubmit={handleAddSchedule}
          style={{
            background: 'rgba(15, 23, 42, 0.65)',
            padding: '16px',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} /> 新增定時點名排程：
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* 時間選擇 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>排程時間 (時:分)</label>
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                required
                style={{
                  padding: '7px 10px',
                  borderRadius: '6px',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  color: '#fff',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  outline: 'none',
                }}
              />
            </div>

            {/* 節次選擇 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>對應課堂節次</label>
              <select
                value={newPeriod}
                onChange={(e) => setNewPeriod(e.target.value)}
                style={{
                  padding: '7px 10px',
                  borderRadius: '6px',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  color: '#fff',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              >
                {['第 1 節', '第 2 節', '第 3 節', '第 4 節', '第 5 節', '第 6 節', '第 7 節', '第 8 節', '自訂節次'].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* 若選擇自訂節次 */}
            {newPeriod === '自訂節次' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '120px' }}>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>自訂課堂名稱</label>
                <input
                  type="text"
                  placeholder="如: 早自習、社團活動"
                  value={customPeriod}
                  onChange={(e) => setCustomPeriod(e.target.value)}
                  style={{
                    padding: '7px 10px',
                    borderRadius: '6px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none',
                  }}
                />
              </div>
            )}

            <button
              type="submit"
              style={{
                marginTop: 'auto',
                padding: '8px 18px',
                background: 'linear-gradient(135deg, var(--accent-primary), #6366f1)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.35)',
              }}
            >
              <Plus size={16} /> 新增排程
            </button>
          </div>
        </form>

        {/* 排程清單操作列 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={16} color="var(--accent-primary)" />
            已排定時程清單 ({config.schedules.length} 個時段)
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleLoadDefaults}
              style={{
                padding: '4px 10px',
                background: 'rgba(255,255,255,0.06)',
                color: '#94a3b8',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '6px',
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <RotateCcw size={12} /> 載入標準課堂範本
            </button>
            <button
              onClick={handleClearAll}
              style={{
                padding: '4px 10px',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '6px',
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Trash2 size={12} /> 清空
            </button>
          </div>
        </div>

        {/* 排程列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
          {config.schedules.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: '0.85rem' }}>
              目前尚未設定任何定時點名排程，請於上方新增或點擊「載入標準課堂範本」。
            </div>
          ) : (
            config.schedules.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: item.enabled ? 'rgba(15, 23, 42, 0.7)' : 'rgba(15, 23, 42, 0.35)',
                  border: `1px solid ${item.enabled ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255,255,255,0.05)'}`,
                  borderRadius: '10px',
                  opacity: item.enabled ? 1 : 0.6,
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      fontSize: '1.15rem',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      color: item.enabled ? '#38bdf8' : '#94a3b8',
                      background: '#0f172a',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    {item.time}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#fff' }}>{item.period}</div>
                    <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                      自動點名通報：{item.enabled ? '🟢 啟用中' : '⚪ 已停用'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    onClick={() => handleToggleItem(item.id)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                      background: item.enabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.08)',
                      color: item.enabled ? '#10b981' : '#94a3b8',
                      border: item.enabled ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    {item.enabled ? '已啟用' : '已停用'}
                  </button>

                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      padding: '6px',
                      borderRadius: '6px',
                      opacity: 0.8,
                    }}
                    title="刪除此排程"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer 操作區 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
          <div>
            {savedNotice && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '0.85rem' }}>
                <Check size={16} /> 排程設定已即時保存生效！
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '9px 22px',
              background: 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)',
              color: '#fff',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.88rem',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(59, 130, 246, 0.35)',
            }}
          >
            完成設定
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default ScheduleModal;
