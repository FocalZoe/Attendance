import React from 'react';
import { AlertTriangle, RefreshCw, Home, Trash2, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';

/**
 * 現代深色玻璃擬態 Error Boundary 錯誤保護元件
 * 支援全域頁面防護與局部模態框防護，提供友善繁體中文診斷與一鍵自癒修復
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ClassVision ErrorBoundary] 捕捉到非預期執行階段例外:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetState = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  handleClearCacheAndReload = () => {
    if (window.confirm('確定要清除本機暫存並重新載入系統嗎？這將重設本地快取與視訊設定。')) {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        console.warn('Clear storage error:', e);
      }
      window.location.href = '/';
    }
  };

  render() {
    if (this.state.hasError) {
      const isCompact = this.props.compact || false;

      // 局部輕量錯誤提示 (適用於彈窗或局部卡片)
      if (isCompact) {
        return (
          <div
            style={{
              padding: '24px',
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '12px',
              color: '#f87171',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <AlertTriangle size={32} color="#ef4444" />
            <h4 style={{ margin: 0, fontSize: '1rem', color: '#fca5a5' }}>
              此模組載入發生異常
            </h4>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#cbd5e1' }}>
              {this.state.error?.message || '發生未知的執行階段錯誤'}
            </p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <button
                onClick={this.handleResetState}
                style={{
                  padding: '6px 14px',
                  background: 'rgba(59, 130, 246, 0.2)',
                  color: '#60a5fa',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <RefreshCw size={13} /> 重試此模組
              </button>
            </div>
          </div>
        );
      }

      // 全域全螢幕深色玻璃擬態錯誤頁面
      return (
        <div
          style={{
            minHeight: '100vh',
            width: '100vw',
            background: 'radial-gradient(circle at top right, #1e1b4b, #090d16 60%, #030712)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            boxSizing: 'border-box',
            color: '#f8fafc',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '680px',
              background: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '20px',
              padding: '36px',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.85), 0 0 40px rgba(239, 68, 68, 0.12)',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* 頂部裝飾警示發光條 */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: 'linear-gradient(90deg, #ef4444, #f97316, #ef4444)',
              }}
            />

            {/* 標題與圖示 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '18px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 0 20px rgba(239, 68, 68, 0.25)',
                }}
              >
                <ShieldAlert size={30} color="#ef4444" />
              </div>
              <div>
                <h1 style={{ margin: '0 0 6px 0', fontSize: '1.45rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#fff' }}>
                  系統遭遇非預期狀況
                </h1>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8', lineHeight: 1.5 }}>
                  ClassVision 已為您啟動自動防護機制，主應用程式未崩潰終止。請選擇以下修復操作進行自癒恢復。
                </p>
              </div>
            </div>

            {/* 錯誤摘要卡片 */}
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ fontSize: '0.78rem', color: '#f87171', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={14} /> 例外錯誤訊息
              </div>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.86rem',
                  color: '#e2e8f0',
                  wordBreak: 'break-all',
                  background: 'rgba(239, 68, 68, 0.08)',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                }}
              >
                {this.state.error?.toString() || '未知執行階段錯誤'}
              </div>
            </div>

            {/* 自我修復操作按鈕群 */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={this.handleReload}
                style={{
                  flex: '1 1 140px',
                  padding: '12px 18px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, var(--accent-primary, #0284c7), #3b82f6)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)',
                  transition: 'transform 0.15s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                <RefreshCw size={16} /> 重新載入系統
              </button>

              <button
                onClick={this.handleGoHome}
                style={{
                  flex: '1 1 140px',
                  padding: '12px 18px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#e2e8f0',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'background 0.2s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.14)')}
                onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)')}
              >
                <Home size={16} /> 返回監控儀表板
              </button>

              <button
                onClick={this.handleClearCacheAndReload}
                style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: '#f87171',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  fontWeight: 600,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'background 0.2s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.22)')}
                onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)')}
                title="清除瀏覽器快取與劃位設定"
              >
                <Trash2 size={15} /> 清理快取並重設
              </button>
            </div>

            {/* 技術詳細資訊折疊開關 */}
            <div>
              <button
                onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: 0,
                }}
              >
                {this.state.showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {this.state.showDetails ? '隱藏技術堆疊追蹤資訊' : '檢視技術堆疊追蹤資訊 (排查專用)'}
              </button>

              {this.state.showDetails && (
                <pre
                  style={{
                    marginTop: '10px',
                    padding: '14px',
                    borderRadius: '10px',
                    background: '#030712',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    color: '#94a3b8',
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    overflowX: 'auto',
                    maxHeight: '220px',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.4,
                  }}
                >
                  {this.state.error?.stack || '無可用之 Stack 資訊'}
                  {this.state.errorInfo?.componentStack && `\n\nComponent Stack:${this.state.errorInfo.componentStack}`}
                </pre>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
