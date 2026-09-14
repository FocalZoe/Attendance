// ==============================================================================
// 班級自動化點名系統 - 考勤照片大圖檢視與座號今日出缺席狀態聯動 Modal (ImageModal.jsx)
// 核心升級：
// 1. 照片上的座位框支援點選互動 (pointerEvents: 'auto'，選中時發光高亮)。
// 2. 右側面板即時連動呈現該座號之「今日出缺席歷程明細」與出席率統計。
// 3. 完整相容新舊版 Database ROI 百分比座標結構。
// ==============================================================================

import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { 
  X, Clock, GraduationCap, UserCheck, UserX, 
  Eye, EyeOff, Info 
} from 'lucide-react';
import { getSavedSeatsConfig } from '../services/seatOccupancyService';

export const ImageModal = ({ record, imageUrl, title, allRecords = [], onClose }) => {
  const [imgNaturalSize, setImgNaturalSize] = useState({ width: 0, height: 0 });
  const [viewMode, setViewMode] = useState('all');
  const [showPersonBoxes] = useState(true);
  const [selectedSeatId, setSelectedSeatId] = useState(null);

  const targetRecord = record && typeof record === 'object' ? record : null;
  const targetUrl = targetRecord ? targetRecord.file_url : imageUrl;

  // 1. 解析 Database 存的 ai_analysis
  let aiAnalysis = targetRecord?.ai_analysis;
  if (typeof aiAnalysis === 'string') {
    try {
      aiAnalysis = JSON.parse(aiAnalysis);
    } catch {
      aiAnalysis = undefined;
    }
  }

  // 取得使用者設定的座位清單 (作為座號 ROI 的精準對齊來源)
  const savedConfig = getSavedSeatsConfig();
  const configuredSeats = savedConfig.seats || [];

  // 2. 取得 Database 回傳之座號狀態清單
  let rawStatuses = Array.isArray(aiAnalysis?.seat_statuses) ? aiAnalysis.seat_statuses : [];

  if (rawStatuses.length === 0 && configuredSeats.length > 0) {
    rawStatuses = configuredSeats.map((cs) => ({
      seat_id: cs.seat_id,
      name: cs.name,
      status: 'VACANT',
      confidence: 0,
      overlap_ratio: 0,
      roi: cs.roi,
    }));
  }

  // 3. 為每一個座位解析其真實的 ROI 座標
  const completeSeatStatuses = rawStatuses.map((st) => {
    let resolvedRoi = st.roi;

    if (!resolvedRoi || (typeof resolvedRoi.x_pct !== 'number' && typeof resolvedRoi.x !== 'number')) {
      const matchConfigSeat = configuredSeats.find((cs) => cs.seat_id === st.seat_id);
      if (matchConfigSeat && matchConfigSeat.roi) {
        resolvedRoi = matchConfigSeat.roi;
      }
    }

    return {
      ...st,
      roi: resolvedRoi || null,
    };
  });

  const persons = Array.isArray(aiAnalysis?.persons)
    ? aiAnalysis.persons
    : Array.isArray(aiAnalysis?.faces)
      ? aiAnalysis.faces
      : [];

  const occupiedSeats = completeSeatStatuses.filter((s) => s.status === 'OCCUPIED');
  const vacantSeats = completeSeatStatuses.filter((s) => s.status === 'VACANT');

  const formattedTime = targetRecord?.create_at
    ? new Date(targetRecord.create_at).toLocaleString('zh-TW', { hour12: false })
    : '';

  const periodMessage = targetRecord?.message || title || '課堂點名紀錄';

  // 當前點選的座位物件
  const selectedSeatObj = completeSeatStatuses.find((s) => s.seat_id === selectedSeatId) || null;

  // 計算選取座號之「今日出缺席狀態歷程」
  const todayRecordsTimeline = useMemo(() => {
    if (!selectedSeatId || !targetRecord?.create_at) return [];

    const targetDateStr = new Date(targetRecord.create_at).toISOString().slice(0, 10);

    // 篩選出同日期的所有考勤紀錄
    const dayRecords = allRecords.filter((r) => {
      if (!r.create_at) return false;
      return new Date(r.create_at).toISOString().slice(0, 10) === targetDateStr;
    });

    // 依時間升冪排列
    const sorted = [...dayRecords].sort((a, b) => new Date(a.create_at) - new Date(b.create_at));

    return sorted.map((r) => {
      let analysis = r.ai_analysis;
      if (typeof analysis === 'string') {
        try { analysis = JSON.parse(analysis); } catch {}
      }
      const statuses = Array.isArray(analysis?.seat_statuses) ? analysis.seat_statuses : [];
      const matchStatus = statuses.find((st) => String(st.seat_id) === String(selectedSeatId));
      const isPresent = matchStatus?.status === 'OCCUPIED';

      const timeStr = new Date(r.create_at).toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      return {
        id: r.id,
        time: timeStr,
        period: r.message || '點名紀錄',
        status: matchStatus ? (isPresent ? 'OCCUPIED' : 'VACANT') : 'UNKNOWN',
        isCurrentSnapshot: r.id === targetRecord.id,
      };
    });
  }, [selectedSeatId, targetRecord, allRecords]);

  // 今日統計指標
  const todayStats = useMemo(() => {
    if (todayRecordsTimeline.length === 0) return null;
    const totalPeriods = todayRecordsTimeline.length;
    const attended = todayRecordsTimeline.filter((t) => t.status === 'OCCUPIED').length;
    const absent = todayRecordsTimeline.filter((t) => t.status === 'VACANT').length;
    const rate = totalPeriods > 0 ? ((attended / totalPeriods) * 100).toFixed(1) : '0.0';
    return { totalPeriods, attended, absent, rate };
  }, [todayRecordsTimeline]);

  // 依據標註模式過濾要渲染的座位清單
  const filteredSeatsToDraw = completeSeatStatuses.filter((st) => {
    if (viewMode === 'raw') return false;
    if (viewMode === 'vacant') return st.status === 'VACANT';
    if (viewMode === 'occupied') return st.status === 'OCCUPIED';
    return true;
  });

  // 百分比精準解析函式
  const getSeatPct = (roi) => {
    if (!roi) return { x: 0, y: 0, width: 0, height: 0 };

    if (typeof roi.x_pct === 'number' && typeof roi.width_pct === 'number' && roi.width_pct > 0) {
      return {
        x: roi.x_pct,
        y: roi.y_pct,
        width: roi.width_pct,
        height: roi.height_pct,
      };
    }

    if (typeof roi.x === 'number' && roi.x <= 100 && (roi.width || 0) <= 100 && (roi.width || 0) > 0) {
      return {
        x: roi.x,
        y: roi.y,
        width: roi.width,
        height: roi.height,
      };
    }

    const bw = savedConfig.base_width || 640;
    const bh = savedConfig.base_height || 480;
    if (typeof roi.x === 'number' && (roi.width || roi.w || 0) > 0) {
      return {
        x: (roi.x / bw) * 100,
        y: (roi.y / bh) * 100,
        width: ((roi.width || roi.w || 0) / bw) * 100,
        height: ((roi.height || roi.h || 0) / bh) * 100,
      };
    }

    return { x: 0, y: 0, width: 0, height: 0 };
  };

  if (!targetUrl) return null;

  return ReactDOM.createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      {/* 頂部資訊列 */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '96vw',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#ffffff',
          border: '1px solid var(--glass-border)',
          padding: '10px 18px',
          borderRadius: '8px',
          marginBottom: '10px',
          color: '#0f172a',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {/* 左側：節次、時間與統計 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <GraduationCap size={20} color="var(--accent-primary)" />
            {periodMessage}
          </span>

          {formattedTime && (
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={14} /> {formattedTime}
            </span>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', background: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: '6px', border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
              <UserCheck size={13} /> 在座: {occupiedSeats.length} / {completeSeatStatuses.length}
            </span>

            {vacantSeats.length > 0 && (
              <span style={{ fontSize: '0.78rem', background: '#fef2f2', color: '#dc2626', padding: '2px 8px', borderRadius: '6px', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
                <UserX size={13} /> 未到: {vacantSeats.length} 席
              </span>
            )}
          </div>
        </div>

        {/* 右側：標註過濾工具列與關閉按鈕 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f1f5f9', padding: '3px 6px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <button
              onClick={() => setViewMode('all')}
              style={{
                padding: '4px 8px', borderRadius: '6px', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer',
                background: viewMode === 'all' ? 'var(--accent-primary)' : 'transparent',
                color: viewMode === 'all' ? '#fff' : 'var(--text-secondary)', border: 'none',
              }}
            >
              全部 ({completeSeatStatuses.length})
            </button>

            <button
              onClick={() => setViewMode('vacant')}
              style={{
                padding: '4px 8px', borderRadius: '6px', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer',
                background: viewMode === 'vacant' ? '#fee2e2' : 'transparent',
                color: viewMode === 'vacant' ? '#dc2626' : 'var(--text-secondary)', border: 'none',
              }}
            >
              僅未到 ({vacantSeats.length})
            </button>

            <button
              onClick={() => setViewMode('occupied')}
              style={{
                padding: '4px 8px', borderRadius: '6px', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer',
                background: viewMode === 'occupied' ? '#d1fae5' : 'transparent',
                color: viewMode === 'occupied' ? '#059669' : 'var(--text-secondary)', border: 'none',
              }}
            >
              僅在座 ({occupiedSeats.length})
            </button>

            <button
              onClick={() => setViewMode(viewMode === 'raw' ? 'all' : 'raw')}
              style={{
                padding: '4px 8px', borderRadius: '6px', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '3px',
                background: viewMode === 'raw' ? '#e2e8f0' : 'transparent',
                color: viewMode === 'raw' ? '#0f172a' : 'var(--text-secondary)', border: 'none',
              }}
            >
              {viewMode === 'raw' ? <EyeOff size={13} /> : <Eye size={13} />}
              {viewMode === 'raw' ? '純淨' : '照片'}
            </button>
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#0f172a',
              borderRadius: '4px', width: '32px', height: '32px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* 主體區：左側相片大圖 + 右側座號今日出勤明細側面板 */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'flex',
          gap: '16px',
          maxWidth: '96vw',
          maxHeight: '84vh',
          width: '100%',
          alignItems: 'stretch',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {/* 左側：相片與座位框疊加畫布 */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            maxHeight: '84vh',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid #334155',
            background: '#020617',
          }}
        >
          <img
            src={targetUrl}
            alt={periodMessage}
            onLoad={(e) => {
              const target = e.currentTarget;
              if (target.naturalWidth > 0 && target.naturalHeight > 0) {
                setImgNaturalSize({
                  width: target.naturalWidth,
                  height: target.naturalHeight,
                });
              }
            }}
            style={{
              display: 'block',
              maxWidth: '100%',
              maxHeight: '84vh',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              userSelect: 'none',
            }}
          />

          {/* 繪製人員邊框 (藍色虛線框) */}
          {viewMode !== 'raw' && showPersonBoxes && persons.map((person, idx) => {
            const box = person.bounding_box || person;
            if (!box || typeof box.x !== 'number') return null;
            const bW = box.width || box.w || 0;
            const bH = box.height || box.h || 0;
            if (bW <= 0 || bH <= 0) return null;

            const pBaseW = box.base_width || (imgNaturalSize.width > 0 ? imgNaturalSize.width : 1920);
            const pBaseH = box.base_height || (imgNaturalSize.height > 0 ? imgNaturalSize.height : 1080);

            const leftPct = typeof box.x_pct === 'number' ? box.x_pct : (box.x / pBaseW) * 100;
            const topPct = typeof box.y_pct === 'number' ? box.y_pct : (box.y / pBaseH) * 100;
            const widthPct = typeof box.width_pct === 'number' ? box.width_pct : (bW / pBaseW) * 100;
            const heightPct = typeof box.height_pct === 'number' ? box.height_pct : (bH / pBaseH) * 100;

            return (
              <div
                key={`person-${idx}`}
                style={{
                  position: 'absolute',
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  width: `${widthPct}%`,
                  height: `${heightPct}%`,
                  border: '1.5px dashed #38bdf8',
                  borderRadius: '4px',
                  pointerEvents: 'none',
                  zIndex: 10,
                }}
              />
            );
          })}

          {/* 繪製座號真實座位 ROI 邊框 (支援滑鼠點選互動) */}
          {filteredSeatsToDraw.map((st, index) => {
            const sp = getSeatPct(st.roi);
            if (sp.width <= 0 || sp.height <= 0) return null;

            const isOcc = st.status === 'OCCUPIED';
            const isSelected = String(st.seat_id) === String(selectedSeatId);
            const labelText = isOcc
              ? `🟢 [${st.seat_id}] 在座`
              : `❌ [${st.seat_id}] 未到`;

            return (
              <div
                key={`seat-${index}-${st.seat_id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedSeatId(st.seat_id);
                }}
                style={{
                  position: 'absolute',
                  left: `${sp.x}%`,
                  top: `${sp.y}%`,
                  width: `${sp.width}%`,
                  height: `${sp.height}%`,
                  border: isSelected 
                    ? '3.5px solid #3b82f6' 
                    : isOcc ? '2.5px solid #10b981' : '2px dashed #ef4444',
                  background: isSelected
                    ? 'rgba(59, 130, 246, 0.35)'
                    : isOcc ? 'rgba(16, 185, 129, 0.22)' : 'rgba(239, 68, 68, 0.18)',
                  boxShadow: isSelected ? '0 0 12px #3b82f6' : 'none',
                  borderRadius: '8px',
                  boxSizing: 'border-box',
                  pointerEvents: 'auto',
                  cursor: 'pointer',
                  zIndex: isSelected ? 25 : 15,
                  transition: 'all 0.15s ease',
                }}
                title={`點擊查看座號 ${st.seat_id} 今日出缺席狀態`}
              >
                {/* 四角 L 型邊框 */}
                <div style={{ position: 'absolute', top: 0, left: 0, width: '8px', height: '8px', borderTop: `2.5px solid ${isSelected ? '#3b82f6' : isOcc ? '#10b981' : '#ef4444'}`, borderLeft: `2.5px solid ${isSelected ? '#3b82f6' : isOcc ? '#10b981' : '#ef4444'}` }} />
                <div style={{ position: 'absolute', top: 0, right: 0, width: '8px', height: '8px', borderTop: `2.5px solid ${isSelected ? '#3b82f6' : isOcc ? '#10b981' : '#ef4444'}`, borderRight: `2.5px solid ${isSelected ? '#3b82f6' : isOcc ? '#10b981' : '#ef4444'}` }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, width: '8px', height: '8px', borderBottom: `2.5px solid ${isSelected ? '#3b82f6' : isOcc ? '#10b981' : '#ef4444'}`, borderLeft: `2.5px solid ${isSelected ? '#3b82f6' : isOcc ? '#10b981' : '#ef4444'}` }} />
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: '8px', height: '8px', borderBottom: `2.5px solid ${isSelected ? '#3b82f6' : isOcc ? '#10b981' : '#ef4444'}`, borderRight: `2.5px solid ${isSelected ? '#3b82f6' : isOcc ? '#10b981' : '#ef4444'}` }} />

                {/* 座號狀態標籤 */}
                <div
                  style={{
                    position: 'absolute',
                    top: sp.y > 8 ? '-22px' : '4px',
                    left: '4px',
                    background: isSelected 
                      ? '#2563eb' 
                      : isOcc ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)',
                    color: '#ffffff',
                    border: `1px solid ${isSelected ? '#3b82f6' : isOcc ? '#10b981' : '#ef4444'}`,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {labelText}
                </div>
              </div>
            );
          })}
        </div>

        {/* 右側：座號詳細出勤狀況與今日歷程面板 */}
        <div
          style={{
            width: '320px',
            background: '#ffffff',
            borderRadius: '8px',
            border: '1px solid var(--glass-border)',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            overflowY: 'auto',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <GraduationCap size={18} color="var(--accent-primary)" />
              座號今日出勤明細
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              點選左側照片上的座位框框即時連動
            </span>
          </div>

          {selectedSeatObj ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* 選取之座位標題與當前狀態 */}
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                    座號 #{selectedSeatObj.seat_id}
                  </span>
                  <span style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: selectedSeatObj.status === 'OCCUPIED' ? '#ecfdf5' : '#fef2f2',
                    color: selectedSeatObj.status === 'OCCUPIED' ? '#059669' : '#dc2626',
                    border: `1px solid ${selectedSeatObj.status === 'OCCUPIED' ? '#a7f3d0' : '#fecaca'}`,
                  }}>
                    {selectedSeatObj.status === 'OCCUPIED' ? '本節在座出席' : '本節缺席未到'}
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  {selectedSeatObj.name || `第 ${selectedSeatObj.seat_id} 號座位`}
                </div>
              </div>

              {/* 今日出席率統計指標卡 */}
              {todayStats && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '6px', border: '1px solid #bfdbfe', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: '#1e40af', display: 'block', fontWeight: 600 }}>今日出席率</span>
                    <strong style={{ fontSize: '1.25rem', color: 'var(--accent-primary)' }}>{todayStats.rate}%</strong>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', fontWeight: 600 }}>出席 / 總節次</span>
                    <strong style={{ fontSize: '1.15rem', color: '#0f172a' }}>{todayStats.attended} / {todayStats.totalPeriods}</strong>
                  </div>
                </div>
              )}

              {/* 今日各節次出缺席歷程時間軸 */}
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  📅 今日歷次點名記錄 ({todayRecordsTimeline.length} 次)
                </div>

                {todayRecordsTimeline.length === 0 ? (
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', textAlign: 'center', padding: '16px' }}>
                    查無今日其他節次紀錄
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '280px', overflowY: 'auto' }}>
                    {todayRecordsTimeline.map((item, idx) => {
                      const isOcc = item.status === 'OCCUPIED';
                      return (
                        <div
                          key={`timeline-${idx}`}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            background: item.isCurrentSnapshot ? '#eff6ff' : '#f8fafc',
                            border: item.isCurrentSnapshot ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                            fontSize: '0.78rem',
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 600, color: '#0f172a' }}>{item.period}</span>
                            <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: '6px' }}>{item.time}</span>
                            {item.isCurrentSnapshot && (
                              <span style={{ fontSize: '0.68rem', background: '#3b82f6', color: '#ffffff', padding: '1px 4px', borderRadius: '3px', marginLeft: '6px' }}>
                                本相片
                              </span>
                            )}
                          </div>

                          <span style={{
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: isOcc ? '#ecfdf5' : '#fef2f2',
                            color: isOcc ? '#059669' : '#dc2626',
                          }}>
                            {isOcc ? '在座' : '缺席'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '260px', color: '#94a3b8', textAlign: 'center', gap: '10px' }}>
              <Info size={32} style={{ opacity: 0.4 }} />
              <div style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
                請點擊左側相片上的座位框框<br />
                即可在此即時檢視該座號的<br />
                <strong>今日出缺席狀態歷程</strong>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ImageModal;
