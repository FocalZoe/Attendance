import * as React from 'react';
import { Link } from 'react-router-dom';
import { queryStudentAttendance } from '@/lib/parent-query';
import { periodLabel } from '@/lib/periods';
import { PublicShell } from '@/components/layout/public-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InlineAlert } from '@/components/ui/inline-alert';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusLegend, StatusMark } from '@/components/ui/status-mark';
import type { ParentQueryResult } from '@/types/database';

export function ParentQueryPage() {
  const [studentNumber, setStudentNumber] = React.useState('');
  const [phoneLast4, setPhoneLast4] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState('');
  const [result, setResult] = React.useState<ParentQueryResult | null>(null);

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await queryStudentAttendance(studentNumber, phoneLast4);
      if (!res.success) {
        setErrorMsg(res.message || '找不到符合的學生。請確認學號與電話末四碼是否正確。');
        setResult(null);
      } else {
        setResult(res);
      }
    } catch {
      setErrorMsg('查詢失敗。請檢查網路後再試一次。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicShell
      width="wide"
      aside={
        <Link
          to="/login"
          className="hidden h-10 items-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:text-foreground sm:inline-flex"
        >
          教職員登入
        </Link>
      }
    >
      <h1 className="text-3xl font-bold text-foreground">家長查勤</h1>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        輸入孩子的學號，以及學校留存的家長電話末四碼，就能看到最近的出勤紀錄。
      </p>

      <form onSubmit={handleQuery} className="mt-6 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="query-student-number">學號</Label>
          <Input
            id="query-student-number"
            required
            autoComplete="off"
            placeholder="例如 113001"
            value={studentNumber}
            onChange={(e) => setStudentNumber(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="query-phone-last4">家長電話末四碼</Label>
          <Input
            id="query-phone-last4"
            required
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            autoComplete="off"
            placeholder="例如 5678"
            value={phoneLast4}
            onChange={(e) => setPhoneLast4(e.target.value.replace(/\D/g, ''))}
          />
        </div>
        <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
          {loading ? '查詢中' : '查詢'}
        </Button>
      </form>

      {errorMsg && <InlineAlert className="mt-4">{errorMsg}</InlineAlert>}

      {result?.student && (
        <section className="mt-10" aria-live="polite">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-border pb-4">
            <div>
              <h2 className="text-2xl font-bold text-foreground">{result.student.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.student.school_name}　{result.student.class_name}　{result.student.seat_number} 號
              </p>
            </div>
            <p className="tabular text-sm text-muted-foreground">學號 {result.student.student_number}</p>
          </div>

          <div className="mt-4">
            <StatusLegend />
          </div>

          {!result.records || result.records.length === 0 ? (
            <EmptyState
              className="mt-6"
              title="還沒有出勤紀錄"
              description="老師完成點名後，紀錄會出現在這裡。"
            />
          ) : (
            <ul className="mt-4 divide-y divide-border border-y border-border">
              {result.records.map((rec) => (
                <li key={rec.record_id} className="flex items-start gap-4 py-4">
                  <StatusMark status={rec.status} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="tabular font-medium text-foreground">
                      {rec.date}　{rec.period ? periodLabel(rec.period) : '全日'}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {rec.is_overridden
                        ? '老師已更正這筆紀錄'
                        : rec.ai_detected_status === 'present'
                        ? '系統判斷在座位上'
                        : rec.ai_detected_status === 'absent'
                        ? '系統判斷不在座位上'
                        : '手動登記'}
                    </p>
                    {rec.note && <p className="mt-1 text-sm text-foreground">備註：{rec.note}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">只顯示最近 30 筆紀錄。</p>
        </section>
      )}
    </PublicShell>
  );
}
