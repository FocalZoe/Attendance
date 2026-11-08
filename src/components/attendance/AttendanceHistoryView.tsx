import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  AttendanceSession,
  AttendanceRecord,
  AttendanceStatus,
  SchoolClass,
  Student,
} from '@/types/database';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { OVERLAY_STYLE, STAMP, StatusLegend, StatusMark, ATTENDANCE_STATUS_ORDER } from '@/components/ui/status-mark';
import { formatFullPeriodMessage } from '@/services/seatOccupancyService';
import { periodLabel } from '@/lib/periods';
import { toCsv, downloadCsv } from '@/lib/csv';
import { ATTENDANCE_STATUS_LABEL } from '@/lib/attendance-status';
import { toastError } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { Camera } from 'lucide-react';
import { toast } from 'sonner';

const PAGE_SIZE = 30;
// PostgREST returns at most 1000 rows per request, so records are fetched in chunks below that
const MAX_ROWS_PER_REQUEST = 900;

/** One seat drawn on top of the photo; ratios are 0-1 of the photo size */
interface OverlayBox {
  key: string;
  student_id: string | null;
  seat_label: string;
  x_ratio: number;
  y_ratio: number;
  w_ratio: number;
  h_ratio: number;
}

interface OverlayData {
  boxes: OverlayBox[];
  /** True when the layout was rebuilt from today's seating chart instead of saved with the rollcall */
  approximate: boolean;
}

interface AttendanceHistoryViewProps {
  classId?: string;
  schoolId?: string;
  isEditable?: boolean; // only teachers and school admins may correct records
}

type RecordMap = Record<string, Record<string, AttendanceRecord>>; // sessionId -> studentId -> record

interface SnapshotView {
  session: AttendanceSession;
  url: string;
}

export const AttendanceHistoryView: React.FC<AttendanceHistoryViewProps> = ({
  classId,
  schoolId,
  isEditable = false,
}) => {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [pickedClassId, setPickedClassId] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [recordMap, setRecordMap] = useState<RecordMap>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(0);
  const [totalSessions, setTotalSessions] = useState<number>(0);
  const [snapshot, setSnapshot] = useState<SnapshotView | null>(null);
  const [overlay, setOverlay] = useState<OverlayData | null>(null);
  const [overlayLoading, setOverlayLoading] = useState(false);
  const loadReq = useRef(0);

  const activeClassId = classId ?? pickedClassId;
  const totalPages = Math.max(1, Math.ceil(totalSessions / PAGE_SIZE));

  // School admins: load the class list first and default to the first class
  useEffect(() => {
    if (classId || !schoolId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('school_id', schoolId)
        .order('name', { ascending: true });
      if (cancelled) return;
      if (error) {
        toastError(error, '讀取班級失敗。請重新整理頁面。');
        setLoading(false);
        return;
      }
      const list = (data || []) as SchoolClass[];
      setClasses(list);
      setPickedClassId((prev) => prev || list[0]?.id || '');
      if (list.length === 0) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [classId, schoolId]);

  // Back to the first page when the class changes
  useEffect(() => {
    setPage(0);
  }, [activeClassId]);

  // Load the roster, this page of rollcalls, and every student's record for each rollcall
  const load = useCallback(async () => {
    if (!activeClassId) return;
    const req = ++loadReq.current;
    setLoading(true);
    try {
      const [studentsRes, sessionsRes] = await Promise.all([
        supabase
          .from('students')
          .select('*')
          .eq('class_id', activeClassId)
          .order('seat_number', { ascending: true }),
        supabase
          .from('attendance_sessions')
          .select('*', { count: 'exact' })
          .eq('class_id', activeClassId)
          .order('session_date', { ascending: false })
          .order('created_at', { ascending: false })
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1),
      ]);

      if (studentsRes.error) throw studentsRes.error;
      if (sessionsRes.error) throw sessionsRes.error;
      if (req !== loadReq.current) return;

      const sessionList = (sessionsRes.data || []) as AttendanceSession[];
      const roster = (studentsRes.data || []) as Student[];
      setStudents(roster);
      setSessions(sessionList);
      setTotalSessions(sessionsRes.count ?? sessionList.length);

      if (sessionList.length === 0) {
        setRecordMap({});
        return;
      }

      // Keep every request under the 1000-row cap: sessions-per-chunk x students <= MAX_ROWS_PER_REQUEST
      const perChunk = Math.max(1, Math.floor(MAX_ROWS_PER_REQUEST / Math.max(roster.length, 1)));
      const chunks: AttendanceSession[][] = [];
      for (let i = 0; i < sessionList.length; i += perChunk) chunks.push(sessionList.slice(i, i + perChunk));

      const results = await Promise.all(
        chunks.map((chunk) =>
          supabase
            .from('attendance_records')
            .select('*')
            .in(
              'session_id',
              chunk.map((s) => s.id)
            )
        )
      );
      const failed = results.find((res) => res.error);
      if (failed?.error) throw failed.error;
      if (req !== loadReq.current) return;

      const map: RecordMap = {};
      for (const res of results) {
        for (const rec of (res.data || []) as AttendanceRecord[]) {
          (map[rec.session_id] ??= {})[rec.student_id] = rec;
        }
      }
      setRecordMap(map);
    } catch (err: unknown) {
      if (req === loadReq.current) toastError(err, '讀取點名紀錄失敗。請重新整理頁面。');
    } finally {
      if (req === loadReq.current) setLoading(false);
    }
  }, [activeClassId, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Correct one student's status in one rollcall (optimistic, rolled back on failure)
  const handleChangeStatus = async (record: AttendanceRecord, next: AttendanceStatus) => {
    if (!isEditable || record.status === next) return;
    const previous = record;
    const updated = { ...record, status: next, is_overridden: true };
    setRecordMap((m) => ({
      ...m,
      [record.session_id]: { ...m[record.session_id], [record.student_id]: updated },
    }));

    const { error } = await supabase
      .from('attendance_records')
      .update({ status: next, is_overridden: true })
      .eq('id', record.id);

    if (error) {
      setRecordMap((m) => ({
        ...m,
        [record.session_id]: { ...m[record.session_id], [record.student_id]: previous },
      }));
      toastError(error, '更正失敗。請稍後再試。');
      return;
    }
    toast.success(`已改為${ATTENDANCE_STATUS_LABEL[next]}`);
  };

  const sessionLabel = (s: AttendanceSession) => formatFullPeriodMessage(s.session_date, s.period);

  // Download this page: one column per rollcall, one row per student (UTF-8 BOM so Excel opens it)
  const handleExportCsv = () => {
    if (sessions.length === 0 || students.length === 0) {
      toast.error('目前沒有可下載的紀錄。');
      return;
    }
    const header = [
      '座號',
      '姓名',
      ...sessions.map((s) => `${s.session_date} ${s.period ? periodLabel(s.period) : ''}`.trim()),
    ];
    const rows = students.map((st) => [
      st.seat_number,
      st.name,
      ...sessions.map((s) => {
        const rec = recordMap[s.id]?.[st.id];
        return rec ? ATTENDANCE_STATUS_LABEL[rec.status] : '';
      }),
    ]);
    downloadCsv(`attendance_page${page + 1}.csv`, toCsv([header, ...rows]));
  };

  // Open a rollcall photo (signed URL, valid for 1 hour) together with the seat layout saved at that time
  const handleOpenSnapshot = async (session: AttendanceSession) => {
    if (!session.snapshot_path) return;
    try {
      const { data, error } = await supabase.storage
        .from('attendance-snapshots')
        .createSignedUrl(session.snapshot_path, 3600);
      if (error) throw error;
      if (!data?.signedUrl) return;

      setOverlay(null);
      setOverlayLoading(true);
      setSnapshot({ session, url: data.signedUrl });

      // Newer rollcalls store the exact seat layout; older ones fall back to the current seating chart
      const saved = (session.detection_raw_json as { seats?: SavedSeat[] } | null)?.seats;
      if (Array.isArray(saved) && saved.length > 0) {
        setOverlay({
          boxes: saved.map((seat, index) => ({ key: `saved-${index}`, ...seat })),
          approximate: false,
        });
      } else if (session.chart_id) {
        const { data: boxes } = await supabase.from('seating_boxes').select('*').eq('chart_id', session.chart_id);
        const list = boxes || [];
        setOverlay(
          list.length > 0
            ? {
                boxes: list.map((b) => ({
                  key: b.id,
                  student_id: b.student_id,
                  seat_label: b.seat_label,
                  x_ratio: b.x_ratio,
                  y_ratio: b.y_ratio,
                  w_ratio: b.w_ratio,
                  h_ratio: b.h_ratio,
                })),
                approximate: true,
              }
            : null
        );
      }
    } catch (err: unknown) {
      toastError(err, '讀取照片失敗。請稍後再試。');
    } finally {
      setOverlayLoading(false);
    }
  };

  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 lg:w-72">
          {!classId && classes.length > 0 && (
            <Select value={pickedClassId} onValueChange={setPickedClassId}>
              <SelectTrigger aria-label="選擇班級">
                <SelectValue placeholder="選擇班級" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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
                較新
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
                較舊
              </Button>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={sessions.length === 0 || students.length === 0}
          >
            下載成 Excel 檔
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        <StatusLegend />
        <p className="text-sm text-muted-foreground">
          {isEditable
            ? '每一欄是一次點名，每一列是一位學生。想更正，直接點那個圖示。'
            : '每一欄是一次點名，每一列是一位學生。'}
        </p>
      </div>

      {loading ? (
        <ListSkeleton rows={5} />
      ) : !activeClassId ? (
        <EmptyState title="還沒有班級" description="先建立班級，才會有點名紀錄。" />
      ) : sessions.length === 0 ? (
        <EmptyState
          title="還沒有點名紀錄"
          description="完成第一次點名後，結果會出現在這裡。你可以點圖示更正，或下載成 Excel 檔。"
        />
      ) : students.length === 0 ? (
        <EmptyState title="這個班級還沒有學生" description="先到「學生名冊」新增學生，之後的點名才會有紀錄。" />
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 min-w-36 bg-secondary">學生</TableHead>
                {sessions.map((s) => (
                  <TableHead key={s.id} className="min-w-28 px-2 text-center">
                    <span className="tabular block text-sm text-foreground">{s.session_date}</span>
                    <span className="flex items-center justify-center gap-1 text-xs font-normal text-muted-foreground">
                      {s.period ? periodLabel(s.period) : '一般'}
                      {s.snapshot_path && (
                        <IconButton
                          label="看這次點名拍的照片"
                          className="h-8 w-8"
                          onClick={() => handleOpenSnapshot(s)}
                        >
                          <Camera aria-hidden="true" />
                        </IconButton>
                      )}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((st) => (
                <TableRow key={st.id}>
                  <TableCell className="sticky left-0 z-10 min-w-36 bg-card p-3">
                    <span className="tabular mr-2 text-muted-foreground">{st.seat_number}</span>
                    <span className="font-medium text-foreground">{st.name}</span>
                  </TableCell>
                  {sessions.map((s) => {
                    const rec = recordMap[s.id]?.[st.id];
                    return (
                      <TableCell key={s.id} className="p-1 text-center">
                        {rec ? (
                          <StatusCell
                            record={rec}
                            studentName={st.name}
                            editable={isEditable}
                            onChange={(next) => handleChangeStatus(rec, next)}
                          />
                        ) : (
                          <span className="text-muted-foreground" aria-label="當時還不在名冊">
                            –
                          </span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!snapshot} onOpenChange={(o) => !o && setSnapshot(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>點名時拍的照片</DialogTitle>
            <DialogDescription>{snapshot ? sessionLabel(snapshot.session) : ''}</DialogDescription>
          </DialogHeader>
          {snapshot && (
            <Tabs defaultValue="photo">
              <TabsList>
                <TabsTrigger value="photo">只看照片</TabsTrigger>
                <TabsTrigger value="seats" disabled={!overlay}>
                  座位與出缺席
                </TabsTrigger>
              </TabsList>

              <TabsContent value="photo">
                <img
                  src={snapshot.url}
                  alt="點名時的教室照片"
                  className="w-full rounded-md border border-border"
                />
              </TabsContent>

              <TabsContent value="seats" className="space-y-3">
                <SeatOverlay
                  url={snapshot.url}
                  boxes={overlay?.boxes ?? []}
                  records={recordMap[snapshot.session.id] ?? {}}
                  studentById={studentById}
                />
                {overlay?.approximate && (
                  <p className="text-sm text-muted-foreground">
                    這是較早的紀錄，座位框用的是現在的座位表，位置可能和當時不同。
                  </p>
                )}
                <StatusLegend />
              </TabsContent>
            </Tabs>
          )}
          {snapshot && !overlay && !overlayLoading && (
            <p className="text-sm text-muted-foreground">
              這次點名沒有留下座位資料，所以只能看照片。
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

/** One matrix cell: when editable, a click opens the four status icons to choose from */
function StatusCell({
  record,
  studentName,
  editable,
  onChange,
}: {
  record: AttendanceRecord;
  studentName: string;
  editable: boolean;
  onChange: (next: AttendanceStatus) => void;
}) {
  const [open, setOpen] = useState(false);

  const mark = (
    <span className="relative inline-flex">
      <StatusMark status={record.status} />
      {record.is_overridden && (
        <span
          className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-primary"
          title="老師已更正"
          aria-hidden="true"
        />
      )}
    </span>
  );

  if (!editable) return mark;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${studentName}：${ATTENDANCE_STATUS_LABEL[record.status]}，點一下更正`}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {mark}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 space-y-1">
        <p className="px-2 pb-1 text-xs text-muted-foreground">{studentName} 改為</p>
        {ATTENDANCE_STATUS_ORDER.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => {
              setOpen(false);
              onChange(status);
            }}
            className={cn(
              'flex h-10 w-full items-center rounded-md px-2 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              status === record.status && 'bg-secondary'
            )}
          >
            <StatusMark status={status} size="sm" showLabel />
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** Seat layout stored in attendance_sessions.detection_raw_json.seats when a rollcall is saved */
interface SavedSeat {
  student_id: string | null;
  seat_label: string;
  x_ratio: number;
  y_ratio: number;
  w_ratio: number;
  h_ratio: number;
}

/** Seat boxes drawn over the photo; border color and glyph follow the attendance status */
function SeatOverlay({
  url,
  boxes,
  records,
  studentById,
}: {
  url: string;
  boxes: OverlayBox[];
  records: Record<string, AttendanceRecord>;
  studentById: Map<string, Student>;
}) {
  const seatedIds = new Set(boxes.map((b) => b.student_id).filter(Boolean) as string[]);
  const unseated = Object.values(records).filter((r) => !seatedIds.has(r.student_id));

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-md border border-border">
        <img src={url} alt="點名時的教室照片，上面標示了座位" className="block w-full" />
        {boxes.map((box) => {
          const rec = box.student_id ? records[box.student_id] : undefined;
          const student = box.student_id ? studentById.get(box.student_id) : undefined;
          const stamp = rec ? STAMP[rec.status] : null;
          return (
            <div
              key={box.key}
              className={cn(
                'absolute flex items-start justify-start overflow-hidden rounded-sm border-2 p-0.5',
                rec ? OVERLAY_STYLE[rec.status] : 'border-border bg-card/10'
              )}
              style={{
                left: `${box.x_ratio * 100}%`,
                top: `${box.y_ratio * 100}%`,
                width: `${box.w_ratio * 100}%`,
                height: `${box.h_ratio * 100}%`,
              }}
              title={student ? `${student.name}：${rec ? ATTENDANCE_STATUS_LABEL[rec.status] : '沒有紀錄'}` : '空位'}
            >
              <span
                className={cn(
                  'inline-flex max-w-full items-center gap-1 rounded-sm bg-card/90 px-1 py-0.5 text-[10px] font-medium leading-none text-foreground sm:text-xs',
                  stamp && stamp.className.split(' ').find((c) => c.startsWith('text-'))
                )}
              >
                {stamp && <span className="font-bold">{stamp.glyph}</span>}
                <span className="truncate text-foreground">{student?.name ?? box.seat_label}</span>
              </span>
            </div>
          );
        })}
      </div>

      {unseated.length > 0 && (
        <p className="text-sm text-muted-foreground">
          沒有排在座位表上的學生：
          {unseated
            .map((r) => {
              const st = studentById.get(r.student_id);
              return st ? `${st.name}（${ATTENDANCE_STATUS_LABEL[r.status]}）` : null;
            })
            .filter(Boolean)
            .join('、')}
        </p>
      )}
    </div>
  );
}
