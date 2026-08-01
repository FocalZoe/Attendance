// TEAM_001: 實體 WebRTC 相機打卡與測試彈窗 (CameraSimulatorModal.jsx)
import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Send, RefreshCw, VideoOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { sendTelemetry } from '../services/api';

const CameraSimulatorModal = ({ isOpen, onClose, onSuccess }) => {
  const [message, setMessage] = useState('網路攝像機考勤打卡: 張小明');
  const [isSending, setIsSending] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const getCameraDevices = React.useCallback(async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices.filter((device) => device.kind === 'videoinput');
      setDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
    } catch (err) {
      console.warn('[TEAM_001 Webcam] Enumerate devices error:', err);
    }
  }, [selectedDeviceId]);

  const stopCamera = React.useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const startCamera = React.useCallback(async (deviceId) => {
    setCameraError(null);
    stopCamera();

    try {
      const constraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : { width: { ideal: 1280 }, height: { ideal: 720 } },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      setCameraActive(true);
      await getCameraDevices();
    } catch (err) {
      console.error('[TEAM_001 Webcam Error]', err);
      setCameraError('無法開啟網路攝像機，請確認已授權瀏覽器相機權限或裝置未被其他程式佔用。');
      setCameraActive(false);
    }
  }, [stopCamera, getCameraDevices]);

  useEffect(() => {
    if (isOpen) {
      startCamera(selectedDeviceId);
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, selectedDeviceId, startCamera, stopCamera]);

  if (!isOpen) return null;

  const captureRealWebcamFrame = () => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 繪製半透明黑框與天藍色文字浮印
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(10, canvas.height - 40, 360, 30);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`CAM-01 | ${new Date().toLocaleString('zh-TW')}`, 20, canvas.height - 20);

    return canvas.toDataURL('image/jpeg', 0.88);
  };

  const handleSendTelemetry = async () => {
    setIsSending(true);
    try {
      const base64Data = captureRealWebcamFrame();
      if (!base64Data) {
        alert('擷取攝像機畫面失敗，請確認相機畫面已正常運作。');
        setIsSending(false);
        return;
      }

      await sendTelemetry({
        message,
        file: base64Data,
        timestamp: new Date().toISOString(),
      });

      if (onSuccess) onSuccess();
      if (onClose) onClose();
    } catch (err) {
      console.error('[TEAM_001 Telemetry Error]', err);
      alert(`發送失敗: ${err.message || '網路或伺服器異常'}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
    }}>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div className="glass-panel" style={{ width: '100%', maxWidth: '640px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Camera size={24} color="var(--accent-primary)" />
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>模擬 Ameba 傳遞資料 (Webcam 實體相機)</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>擷取相機即時畫面並打包 JSON 上傳至 Supabase</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={22} />
          </button>
        </div>

        <div style={{
          position: 'relative',
          width: '100%',
          height: '340px',
          borderRadius: '12px',
          overflow: 'hidden',
          background: '#090d16',
          border: '1px solid var(--glass-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: cameraActive ? 'block' : 'none' }}
          />

          {!cameraActive && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', maxWidth: '400px' }}>
              {cameraError ? (
                <>
                  <AlertCircle size={48} color="var(--danger)" style={{ marginBottom: '12px' }} />
                  <p style={{ color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '16px' }}>{cameraError}</p>
                  <button onClick={() => startCamera(selectedDeviceId)} className="btn-secondary" style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', color: 'white' }}>
                    <RefreshCw size={16} /> 重新連接攝像機
                  </button>
                </>
              ) : (
                <>
                  <VideoOff size={48} style={{ opacity: 0.4, marginBottom: '12px' }} />
                  <p>正在啟動網路攝像機...</p>
                </>
              )}
            </div>
          )}

          {cameraActive && (
            <div style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              background: 'rgba(0,0,0,0.6)',
              padding: '4px 12px',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8rem',
              color: 'var(--success)',
            }}>
              <CheckCircle2 size={14} /> 相機即時串流中
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>選擇攝像機裝置</label>
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid var(--glass-border)',
                background: 'rgba(0,0,0,0.3)',
                color: '#ffffff',
                outline: 'none',
              }}
            >
              {devices.length > 0 ? (
                devices.map((d, index) => (
                  <option key={d.deviceId} value={d.deviceId} style={{ background: '#0f172a' }}>
                    {d.label || `網路攝像機 #${index + 1}`}
                  </option>
                ))
              ) : (
                <option value="" style={{ background: '#0f172a' }}>預設系統攝像機</option>
              )}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>通報訊息 (Message)</label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="例如: 門禁考勤刷卡成功..."
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid var(--glass-border)',
                background: 'rgba(0,0,0,0.3)',
                color: '#ffffff',
                outline: 'none',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            onClick={onClose}
            style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', color: 'white', fontWeight: 600 }}
          >
            取消
          </button>
          <button
            onClick={handleSendTelemetry}
            disabled={isSending || !cameraActive}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 20px', background: 'var(--accent-primary)',
              color: 'white', borderRadius: '8px', fontWeight: 600,
              opacity: !cameraActive || isSending ? 0.6 : 1,
              cursor: !cameraActive || isSending ? 'not-allowed' : 'pointer'
            }}
          >
            <Send size={16} />
            {isSending ? '上傳 Supabase 中...' : '📸 拍照並傳送 JSON 至 Supabase'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default CameraSimulatorModal;
