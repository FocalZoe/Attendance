import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { AttendanceSession, AttendanceRecord, AttendanceStatus } from '@/types/database';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatFullPeriodMessage } from '@/services/seatOccupancyService';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { StatusLegend, StatusMark } from '@/components/ui/status-mark';
import { toCsv, downloadCsv } from '@/lib/csv';
import { ATTENDANCE_STATUS_LABEL, ATTENDANCE_STATUS_OPTIONS } from '@/lib/attendance-status';
import { toast } from 'sonner';

const PAGE_SIZE = 30;

interface AttendanceHistoryViewProps {
  classId?: string;
  schoolId?: string;
  isEditable?: boolean; // 僅老師或學校總管具修改權限
}

type SessionWithClass = AttendanceSession & { class?: { name: string } | null };

export const AttendanceHistoryView: React.FC<AttendanceHistoryViewProps> = ({
  classId,
  schoolId,
  isEditable = false,
}) => {
  const [sessions, setSessions] = useState<SessionWithClass[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);
  const [page, setPage] = useState<number>(0);
  const [totalSessions, setTotalSessions] = useState<number>(0);

  const totalPages = Math.max(1, Math.ceil(totalSessions / PAGE_SIZE));

  // 切換班級 / 學校範圍時回到第一頁
  useEffect(() => {
    setPage(0);
  }, [classId, schoolId]);

  // 1. 載入點名批次紀錄 (包含所屬班級名稱)，分頁載入避免一次載入全部歷史
  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('attendance_sessions')
        .select('*, class:classes(name)', { count: 'exact' })
        .order('session_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (classId) {
        query = query.eq('class_id', classId);
      } else if (schoolId) {
        // 若以學校維度查詢，聯集 classes
        const { data: classes } = await supabase
          .from('classes')
          .select('id')
          .eq('school_id', schoolId);

        if (classes && classes.length > 0) {
          const classIds = classes.map((c) => c.id);
          query = query.in('class_id', classIds);
        } else {
          setSessions([]);
          setTotalSessions(0);
          setLoading(false);
          return;
        }
      }

      const { data, error, count } = await query;
      if (error) throw error;

      const mapped = (data || []) as unknown as SessionWithClass[];
      setSessions(mapped);
      setTotalSessions(count ?? mapped.length);
      if (mapped.length > 0) {
        setSelectedSessionId(mapped[0].id);
      } else {
        setSelectedSessionId('');
        setRecords([]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '載入點名批次失敗';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [classId, schoolId, page]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // 2. 載入特定點名批次的學生出缺席明細 (依座號由小至大排序)
  const loadRecords = useCallback(async (sessionId: string) => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*, student:students(*)')
        .eq('session_id', sessionId);

      if (error) throw error;
      const sorted = (data || []).sort(
        (a, b) => (a.student?.seat_number ?? 0) - (b.student?.seat_number ?? 0)
      );
      setRecords(sorted);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '載入出缺席明細失敗';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      loadRecords(selectedSessionId);
    }
  }, [selectedSessionId, loadRecords]);

  // 3. 人工覆寫出缺席狀態 (老師/總管權限)
  const handleUpdateStatus = async (recordId: string, newStatus: AttendanceStatus) => {
    if (!isEditable) return;
    try {
      const { error } = await supabase
        .from('attendance_records')
        .update({
          status: newStatus,
          is_overridden: true,
        })
        .eq('id', recordId);

      if (error) throw error;

      setRecords((prev) =>
        prev.map((r) =>
          r.id === recordId ? { ...r, status: newStatus, is_overridden: true } : r
        )
      );
      toast.success('狀態已手動覆寫更新');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '覆寫失敗';
      toast.error(msg);
    }
  };

  const currentSession = sessions.find((s) => s.id === selectedSessionId);

  // 匯出目前所選場次之出缺席明細 (UTF-8 BOM，Excel 可直接開啟)
  const handleExportCsv = () => {
    if (!currentSession || records.length === 0) {
      toast.error('目前沒有可匯出的出缺席明細');
      return;
    }

    const header = ['日期', '節次', '班級', '座號', '學號', '姓名', 'AI 初判', '最終狀態', '手動覆寫', '備註'];
    const rows = records.map((rec) => [
      currentSession.session_date,
      formatFullPeriodMessage(currentSession.session_date, currentSession.period),
      currentSession.class?.name ?? '',
      rec.student?.seat_number ?? '',
      rec.student?.student_number ?? '',
      rec.student?.name ?? '',
      rec.ai_detected_status ? ATTENDANCE_STATUS_LABEL[rec.ai_detected_status] : '',
      ATTENDANCE_STATUS_LABEL[rec.status],
      rec.is_overridden ? '是' : '否',
      rec.note ?? '',
    ]);

    const safePeriod = (currentSession.period ?? 'all').replace(/[^\w-]/g, '_');
    downloadCsv(`attendance_${currentSession.session_date}_${safePeriod}.csv`, toCsv([header, ...rows]));
  };

  // 取得快照安全簽名 URL (有效時效 1 小時，嚴格防範無效與公開洩漏)
  const handleOpenSnapshot = async (path: string | null) => {
    if (!path) return;
    try {
      const { data, error } = await supabase.storage
        .from('attendance-snapshots')
        .createSignedUrl(path, 3600);

      if (error) throw error;
      if (data?.signedUrl) {
        setSelectedSnapshot(data.signedUrl);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '載入快照存證失敗';
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-4">
      {/* 場次選擇與工具列 */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 lg:w-96">
          {sessions.length > 0 ? (
            <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
              <SelectTrigger aria-label="選擇點名場次">
                <SelectValue placeholder="選擇點名場次" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((s) => {
                  const prefix = s.class?.name ? `${s.class.name}　` : '';
                  return (
                    <SelectItem key={s.id} value={s.id}>
                      {prefix}{formatFullPeriodMessage(s.session_date, s.period)}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {totalPages > 1 && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page === 0 || loading}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                上一頁
              </Button>
              <span className="tabular px-2">
                {page + 1} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1 || loading}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              >
                下一頁
              </Button>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={!currentSession || records.length === 0}
          >
            匯出 CSV
          </Button>
          {currentSession?.snapshot_path && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenSnapshot(currentSession.snapshot_path)}
            >
              查看當時照片
            </Button>
          )}
        </div>
      </div>

      <StatusLegend />

      {!loading && sessions.length === 0 ? (
        <EmptyState
          title="還沒有點名紀錄"
          description="完成第一次點名後，紀錄會出現在這裡，你可以更正狀態或匯出成 CSV。"
        />
      ) : loading ? (
        <ListSkeleton rows={5} />
      ) : records.length === 0 ? (
        <EmptyState title="這個場次沒有學生資料" description="可能是這班的名冊在點名後被清空了。" />
      ) : (
        <>
          {/* 手機：列表 */}
          <ul className="divide-y divide-border border-y border-border md:hidden">
            {records.map((rec) => (
              <li key={rec.id} className="flex items-center gap-3 py-3">
                <span className="tabular w-8 shrink-0 text-right font-bold text-muted-foreground">
                  {rec.student?.seat_number ?? '-'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{rec.student?.name ?? '-'}</p>
                  <p className="text-sm text-muted-foreground">
                    {rec.is_overridden ? '老師已更正' : '系統判斷'}
                  </p>
                </div>
                {isEditable ? (
                  <StatusSelect value={rec.status} onChange={(v) => handleUpdateStatus(rec.id, v)} />
                ) : (
                  <StatusMark status={rec.status} showLabel />
                )}
              </li>
            ))}
          </ul>

          {/* 桌機：表格 */}
          <div className="hidden overflow-hidden rounded-lg border border-border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">座號</TableHead>
                  <TableHead className="w-32">學號</TableHead>
                  <TableHead className="w-32">姓名</TableHead>
                  <TableHead className="w-36">系統判斷</TableHead>
                  <TableHead className="w-44">最終狀態</TableHead>
                  <TableHead>來源</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((rec) => {
                  const s = rec.student;
                  return (
                    <TableRow key={rec.id}>
                      <TableCell className="tabular">{s?.seat_number ?? '-'}</TableCell>
                      <TableCell className="tabular">{s?.student_number ?? '-'}</TableCell>
                      <TableCell className="font-medium text-foreground">{s?.name ?? '-'}</TableCell>
                      <TableCell>
                        {rec.ai_detected_status ? (
                          <StatusMark status={rec.ai_detected_status} size="sm" showLabel />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditable ? (
                          <StatusSelect value={rec.status} onChange={(v) => handleUpdateStatus(rec.id, v)} />
                        ) : (
                          <StatusMark status={rec.status} size="sm" showLabel />
                        )}
                      </TableCell>
                      <TableCell>
                        {rec.is_overridden ? (
                          <Badge variant="warning">老師已更正</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">系統判斷</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* 存證快照彈窗 */}
      <Dialog open={!!selectedSnapshot} onOpenChange={() => setSelectedSnapshot(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>點名當時的照片</DialogTitle>
          </DialogHeader>
          {selectedSnapshot && (
            <img
              src={selectedSnapshot}
              alt="點名當時的教室全景"
              className="w-full rounded-md border border-border"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

/** 四態選單：選項前附蓋章格，色盲也能分辨 */
function StatusSelect({
  value,
  onChange,
}: {
  value: AttendanceStatus;
  onChange: (value: AttendanceStatus) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as AttendanceStatus)}>
      <SelectTrigger className="h-10 w-36" aria-label="出勤狀態">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ATTENDANCE_STATUS_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
