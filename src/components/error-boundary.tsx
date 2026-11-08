import * as React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('未捕捉的畫面錯誤:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-300 p-6 rounded-lg max-w-md text-center space-y-3">
          <h2 className="text-base font-bold text-slate-900">頁面發生未預期錯誤</h2>
          <p className="text-xs text-slate-600">請重新整理頁面；若問題持續，請聯繫系統管理員。</p>
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="text-xs px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-50"
            >
              重試
            </button>
            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              回首頁
            </button>
          </div>
        </div>
      </div>
    );
  }
}
