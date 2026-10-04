import React, { memo } from 'react';
import { Camera, AlertTriangle, UserX, UserCheck, RefreshCw, Clock, Eye } from 'lucide-react';

const CameraPreview = memo(({
  isMobile,
  previewTab,
  setPreviewTab,
  cameraActive,
  cameraError,
  videoRef,
  overlayCanvasRef,
  latestRecord,
  setSelectedRecord,
  latestVacantSeatIds,
  currentTotalSeats,
  currentOccupiedCount,
  currentAttendanceRate,
  formatFullDateTime,
  devices,
  selectedDeviceId,
  onDeviceChange,
  onRestartCamera,
  onExecuteRollcall,
  isSending,
  currentPeriodTitle,
}) => {
  return (
    <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
      {/* 卡片標題與分頁切換 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Camera size={22} color="var(--accent-primary)" />
          <h2 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--text-primary)' }}>最新點名捕捉影像</h2>
          {isMobile && (
            <span
              style={{
                fontSize: '0.72rem',
                padding: '2px 8px',
                borderRadius: '10px',
                background: 'var(--accent-light)',
                color: 'var(--accent-primary)',
                fontWeight: 600,
              }}
            >
              最後通報相片
            </span>
          )}
        </div>

        {/* 即時鏡頭 / 最後通報 切換 Tab */}
        {!isMobile && (
          <div
            style={{
              display: 'flex',
              gap: '6px',
              background: 'var(--accent-light)',
              padding: '4px',
              borderRadius: '6px',
              border: '1px solid var(--glass-border)',
            }}
          >
            <button
              onClick={() => setPreviewTab('live')}
              style={{
                padding: '5px 12px',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                background: previewTab === 'live' ? '#ffffff' : 'transparent',
                color: previewTab === 'live' ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: previewTab === 'live' ? '1px solid var(--glass-border)' : '1px solid transparent',
                boxShadow: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: cameraActive ? '#15803d' : '#b91c1c',
                }}
              />
              即時鏡頭 (Live)
            </button>

            <button
              onClick={() => setPreviewTab('latest')}
              style={{
                padding: '5px 12px',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                background: previewTab === 'latest' ? '#ffffff' : 'transparent',
                color: previewTab === 'latest' ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: 'none',
                border: previewTab === 'latest' ? '1px solid var(--glass-border)' : '1px solid transparent',
              }}
            >
              最後通報相片
            </button>
          </div>
        )}
      </div>

      {/* 視訊畫面 / 照片顯示區 */}
      <div className="camera-preview-container">
        {/* 即時相機視訊區塊 */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            display: previewTab === 'live' ? 'flex' : 'none',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              display: cameraActive ? 'block' : 'none',
              maxWidth: '100%',
              maxHeight: '100%',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
            }}
          />

          {cameraActive && (
            <canvas
              ref={overlayCanvasRef}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
                zIndex: 2,
              }}
            />
          )}

          {!cameraActive && (
            <div
              style={{
                padding: '24px',
                textAlign: 'center',
                color: '#94a3b8',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <div
                style={{
                  padding: '16px',
                  background: 'rgba(185, 28, 28, 0.15)',
                  borderRadius: '50%',
                  color: '#b91c1c',
                }}
              >
                <AlertTriangle size={36} />
              </div>
              <h4 style={{ color: '#b91c1c', margin: '4px 0 0 0' }}>尚未啟動相機鏡頭</h4>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>
                {cameraError || '請選擇鏡頭或授權攝影機存取以開啟即時預覽。'}
              </p>
            </div>
          )}
        </div>

        {/* 最後通報相片區塊 */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            display: previewTab === 'latest' ? 'flex' : 'none',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {latestRecord ? (
            <div
              key={latestRecord.id}
              className="animate-fade-in"
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                onClick={() => setSelectedRecord(latestRecord)}
                title="點擊放大檢視清晰相片"
              >
                <img
                  src={latestRecord.file_url}
                  alt={latestRecord.message}
                  style={{
                    width: '100%',
                    height: '100%',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              </div>

              {/* 浮動沉底狀態資訊列 */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '14px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                  background: 'rgba(26, 22, 19, 0.88)',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  boxShadow: 'none',
                  zIndex: 10,
                  pointerEvents: 'none',
                  maxWidth: '92%',
                }}
              >
                {latestVacantSeatIds.length > 0 ? (
                  <span
                    style={{
                      fontSize: '0.82rem',
                      padding: '2px 10px',
                      borderRadius: '4px',
                      background: '#b91c1c',
                      color: '#ffffff',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <UserX size={13} /> 未到: {latestVacantSeatIds.join(', ')} (共 {latestVacantSeatIds.length} 席)
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '0.82rem',
                      padding: '2px 10px',
                      borderRadius: '4px',
                      background: '#15803d',
                      color: '#ffffff',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <UserCheck size={13} /> 全員在座 (共 {currentTotalSeats} 席)
                  </span>
                )}

                <span
                  style={{
                    fontSize: '0.82rem',
                    padding: '2px 10px',
                    borderRadius: '4px',
                    background: 'var(--accent-primary)',
                    color: '#ffffff',
                    fontWeight: 600,
                  }}
                >
                  在座率: {currentAttendanceRate} ({currentOccupiedCount}/{currentTotalSeats} 席)
                </span>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
              <Camera size={44} style={{ opacity: 0.3, marginBottom: '10px' }} />
              <p style={{ margin: 0 }}>尚未有任何通報紀錄</p>
            </div>
          )}
        </div>
      </div>

      {/* 底部控制器 */}
      <div
        style={{
          marginTop: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {!isMobile && previewTab === 'live' ? (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
                flex: '1 1 auto',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  flex: '1 1 auto',
                  minWidth: '180px',
                }}
              >
                <Camera size={16} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                <select
                  value={selectedDeviceId}
                  onChange={(e) => onDeviceChange(e.target.value)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '6px',
                    background: '#ffffff',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--glass-border)',
                    fontSize: '0.82rem',
                    width: '100%',
                    maxWidth: '280px',
                    outline: 'none',
                  }}
                >
                  {devices.map((d) => (
                    <option key={d.id || d.deviceId} value={d.id || d.deviceId}>
                      {d.name || d.label || `鏡頭 (${d.deviceId})`}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={onRestartCamera}
                title="重新載入相機串流"
                style={{
                  padding: '7px 12px',
                  borderRadius: '4px',
                  background: '#ffffff',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--glass-border)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  whiteSpace: 'nowrap',
                }}
              >
                <RefreshCw size={13} /> 重新整理鏡頭
              </button>
            </div>

            <button
              onClick={() => onExecuteRollcall(null, false)}
              disabled={isSending || !cameraActive}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '9px 20px',
                borderRadius: '6px',
                background: cameraActive && !isSending ? 'var(--accent-primary)' : '#e2e8f0',
                color: cameraActive && !isSending ? '#fff' : '#94a3b8',
                fontWeight: 600,
                fontSize: '0.88rem',
                border: cameraActive && !isSending ? '1px solid var(--accent-primary)' : '1px solid #cbd5e1',
                cursor: isSending || !cameraActive ? 'not-allowed' : 'pointer',
                boxShadow: 'none',
                transition: 'background 0.15s ease',
                flex: '1 1 auto',
                minWidth: '200px',
                opacity: cameraActive && !isSending ? 1 : 0.7,
              }}
              onMouseOver={(e) => {
                if (cameraActive && !isSending) e.currentTarget.style.background = 'var(--accent-hover)';
              }}
              onMouseOut={(e) => {
                if (cameraActive && !isSending) e.currentTarget.style.background = 'var(--accent-primary)';
              }}
            >
              <Camera size={16} />
              {!cameraActive
                ? '請先開啟相機'
                : isSending
                ? '通報點名中...'
                : `📸 立即記錄點名 (${currentPeriodTitle})`}
            </button>
          </>
        ) : (
          <>
            <div
              style={{
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                flexWrap: 'wrap',
              }}
            >
              <Clock size={15} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
              <span>
                {latestRecord
                  ? `最後紀錄：${formatFullDateTime(latestRecord.create_at)}`
                  : '尚無點名照片'}
              </span>
            </div>

            {latestRecord && (
              <button
                onClick={() => setSelectedRecord(latestRecord)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 18px',
                  background: 'var(--accent-primary)',
                  color: 'white',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  border: '1px solid var(--accent-primary)',
                  cursor: 'pointer',
                  marginLeft: 'auto',
                  boxShadow: 'none',
                  transition: 'background 0.15s ease',
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = 'var(--accent-hover)')}
                onMouseOut={(e) => (e.currentTarget.style.background = 'var(--accent-primary)')}
              >
                <Eye size={15} /> 觀看大圖
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
});

CameraPreview.displayName = 'CameraPreview';
export default CameraPreview;
