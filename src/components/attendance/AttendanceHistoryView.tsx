import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { AttendanceSession, AttendanceRecord, AttendanceStatus } from '@/types/database';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatFullPeriodMessage } from '@/services/seatOccupancyService';
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
      {/* 頂部選取器 */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 border border-slate-300 rounded">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-700">點名紀錄批次：</span>
          {sessions.length > 0 ? (
            <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
              <SelectTrigger className="w-72 h-8 text-xs">
                <SelectValue placeholder="選擇紀錄場次" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((s) => {
                  const prefix = s.class?.name ? `${s.class.name} · ` : '';
                  return (
                    <SelectItem key={s.id} value={s.id}>
                      {prefix}{formatFullPeriodMessage(s.session_date, s.period)}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-xs text-slate-500">尚無任何點名紀錄</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {totalPages > 1 && (
            <div className="flex items-center gap-1 text-xs text-slate-600">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={page === 0 || loading}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                上一頁
              </Button>
              <span className="px-1">
                {page + 1} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
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
            className="h-8 text-xs"
          >
            匯出 CSV
          </Button>
          {currentSession?.snapshot_path && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenSnapshot(currentSession.snapshot_path)}
              className="h-8 text-xs"
            >
              檢視全景快照存證
            </Button>
          )}
        </div>
      </div>

      {/* 點名出缺席明細表格 */}
      <div className="bg-white border border-slate-300 rounded overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 border-b border-slate-200">
              <TableHead className="w-20 text-xs font-bold text-slate-700">座號</TableHead>
              <TableHead className="w-32 text-xs font-bold text-slate-700">學號</TableHead>
              <TableHead className="w-32 text-xs font-bold text-slate-700">姓名</TableHead>
              <TableHead className="w-32 text-xs font-bold text-slate-700">AI 初判</TableHead>
              <TableHead className="w-36 text-xs font-bold text-slate-700">最終狀態</TableHead>
              <TableHead className="text-xs font-bold text-slate-700">狀態標籤</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-xs text-slate-500">
                  載入明細中...
                </TableCell>
              </TableRow>
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-xs text-slate-500">
                  查無學生出缺席資料
                </TableCell>
              </TableRow>
            ) : (
              records.map((rec) => {
                const s = rec.student;
                return (
                  <TableRow key={rec.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <TableCell className="text-xs font-mono">{s?.seat_number || '-'}</TableCell>
                    <TableCell className="text-xs font-mono">{s?.student_number || '-'}</TableCell>
                    <TableCell className="text-xs font-medium text-slate-800">{s?.name || '-'}</TableCell>
                    <TableCell className="text-xs">
                      {rec.ai_detected_status === 'present' ? (
                        <span className="text-emerald-600 font-medium">在座 (AI)</span>
                      ) : (
                        <span className="text-slate-400">缺席 (AI)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {isEditable ? (
                        <Select
                          value={rec.status}
                          onValueChange={(val) => handleUpdateStatus(rec.id, val as AttendanceStatus)}
                        >
                          <SelectTrigger className="h-7 w-28 text-xs">
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
                      ) : (
                        <span className="font-semibold text-slate-700">
                          {ATTENDANCE_STATUS_LABEL[rec.status]}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {rec.is_overridden ? (
                        <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50 text-[10px]">
                          手動覆寫
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-slate-300 text-slate-500 text-[10px]">
                          系統原判
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* 存證快照彈窗 */}
      <Dialog open={!!selectedSnapshot} onOpenChange={() => setSelectedSnapshot(null)}>
        <DialogContent className="max-w-3xl p-4 bg-white border border-slate-300">
          <DialogHeader className="border-b border-slate-200 pb-2">
            <DialogTitle className="text-sm font-bold text-slate-800">
              點名存證全景快照
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {selectedSnapshot && (
              <img
                src={selectedSnapshot}
                alt="Attendance snapshot"
                className="w-full rounded border border-slate-200"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
