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
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '12px',
              color: '#dc2626',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <AlertTriangle size={32} color="#dc2626" />
            <h4 style={{ margin: 0, fontSize: '1rem', color: '#991b1b', fontWeight: 600 }}>
              此模組載入發生異常
            </h4>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
              {this.state.error?.message || '發生未知的執行階段錯誤'}
            </p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <button
                onClick={this.handleResetState}
                style={{
                  padding: '6px 14px',
                  background: '#eff6ff',
                  color: '#2563eb',
                  border: '1px solid #bfdbfe',
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

      // 全域全螢幕現代扁平淺色錯誤頁面
      return (
        <div
          style={{
            minHeight: '100vh',
            width: '100vw',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            boxSizing: 'border-box',
            color: '#0f172a',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '680px',
              background: '#ffffff',
              border: '1px solid var(--glass-border)',
              borderRadius: '6px',
              padding: '32px',
              boxShadow: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* 頂部純色警示條 */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: '#dc2626',
              }}
            />

            {/* 標題與圖示 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '18px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '6px',
                  background: '#fee2e2',
                  border: '1px solid #fecaca',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <ShieldAlert size={26} color="#dc2626" />
              </div>
              <div>
                <h1 style={{ margin: '0 0 6px 0', fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#0f172a' }}>
                  系統遭遇非預期狀況
                </h1>
                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  ClassVision 已為您啟動自動防護機制，主應用程式未崩潰終止。請選擇以下修復操作進行自癒恢復。
                </p>
              </div>
            </div>

            {/* 錯誤摘要卡片 */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid var(--glass-border)',
                borderRadius: '6px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={14} /> 例外錯誤訊息
              </div>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.84rem',
                  color: '#991b1b',
                  wordBreak: 'break-all',
                  background: '#fee2e2',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: '1px solid #fecaca',
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
                  padding: '10px 18px',
                  borderRadius: '6px',
                  background: '#0f172a',
                  color: '#fff',
                  border: '1px solid #0f172a',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: 'none',
                  transition: 'background 0.15s ease',
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = '#334155')}
                onMouseOut={(e) => (e.currentTarget.style.background = '#0f172a')}
              >
                <RefreshCw size={15} /> 重新載入系統
              </button>

              <button
                onClick={this.handleGoHome}
                style={{
                  flex: '1 1 140px',
                  padding: '10px 18px',
                  borderRadius: '6px',
                  background: '#f1f5f9',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: 'none',
                  transition: 'background 0.15s ease',
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = '#e2e8f0')}
                onMouseOut={(e) => (e.currentTarget.style.background = '#f1f5f9')}
              >
                <Home size={15} /> 返回監控儀表板
              </button>

              <button
                onClick={this.handleClearCacheAndReload}
                style={{
                  padding: '10px 16px',
                  borderRadius: '6px',
                  background: '#fee2e2',
                  color: '#dc2626',
                  border: '1px solid #fecaca',
                  fontWeight: 600,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: 'none',
                  transition: 'background 0.15s ease',
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = '#fecaca')}
                onMouseOut={(e) => (e.currentTarget.style.background = '#fee2e2')}
                title="清除瀏覽器快取與劃位設定"
              >
                <Trash2 size={14} /> 清理快取並重設
              </button>
            </div>

            {/* 技術詳細資訊折疊開關 */}
            <div>
              <button
                onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
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
                    background: '#f8fafc',
                    border: '1px solid var(--glass-border)',
                    color: '#475569',
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
