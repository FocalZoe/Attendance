import * as React from 'react';
import { buildIssueUrl } from '@/lib/report-issue';

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

    const reportUrl = buildIssueUrl({
      where: window.location.pathname,
      summary: '畫面發生未預期錯誤',
      detail: this.state.error.message,
    });

    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
        <div className="max-w-md space-y-4 rounded-lg border border-border bg-card p-6 text-center">
          <h2 className="text-lg font-bold text-foreground">這個畫面出了點問題</h2>
          <p className="text-sm text-muted-foreground">
            你剛才的操作沒有遺失。先按「重試」；還是不行的話，請回報問題，我們會盡快處理。
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="h-10 rounded-md border border-border px-4 text-sm font-medium hover:bg-secondary"
            >
              重試
            </button>
            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="h-10 rounded-md border border-border px-4 text-sm font-medium hover:bg-secondary"
            >
              回首頁
            </button>
            <a
              href={reportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              回報問題
            </a>
          </div>
        </div>
      </div>
    );
  }
}
