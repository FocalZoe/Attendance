import * as React from 'react';
import { supabase } from '@/lib/supabase';
import { deleteClassEverything, deleteSessionRecord, deleteStudentRecord } from '@/lib/hard-delete';
import { periodLabel } from '@/lib/periods';
import { toastError } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DangerConfirmDialog } from '@/components/ui/danger-confirm-dialog';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { AttendanceSession, School, SchoolClass, Student } from '@/types/database';

interface DataPanelProps {
  schools: School[];
  /** Refresh totals shown elsewhere after something is deleted */
  onChanged?: () => void;
}

type Target =
  | { kind: 'class'; item: SchoolClass }
  | { kind: 'student'; item: Student }
  | { kind: 'session'; item: AttendanceSession };

const SESSION_PAGE = 50;
const PHOTO_LEFTOVER_WARNING =
  '資料已刪除，但有些點名照片沒有清除乾淨。請確認已重跑 schema.sql，再到 Supabase Storage 手動清理。';

export function DataPanel({ schools, onChanged }: DataPanelProps) {
  const [schoolId, setSchoolId] = React.useState('');
  const [classes, setClasses] = React.useState<SchoolClass[]>([]);
  const [classId, setClassId] = React.useState('');
  const [students, setStudents] = React.useState<Student[]>([]);
  const [sessions, setSessions] = React.useState<AttendanceSession[]>([]);
  const [sessionTotal, setSessionTotal] = React.useState(0);
  const [loadingMore, setLoadingMore] = React.useState(false);
  // Latest-request guards: ignore responses that arrive after the selection changed
  const classReq = React.useRef(0);
  const studentReq = React.useRef(0);
  const sessionReq = React.useRef(0);
  const [studentSearch, setStudentSearch] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [target, setTarget] = React.useState<Target | null>(null);

  React.useEffect(() => {
    if (!schoolId && schools.length > 0) setSchoolId(schools[0].id);
  }, [schools, schoolId]);

  const loadClasses = React.useCallback(async () => {
    if (!schoolId) return;
    const req = ++classReq.current;
    setLoading(true);
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .eq('school_id', schoolId)
      .order('academic_year', { ascending: false })
      .order('name', { ascending: true });
    if (req !== classReq.current) return;
    if (error) toastError(error, '讀取班級失敗。請重新整理頁面。');
    const list = (data ?? []) as SchoolClass[];
    setClasses(list);
    setClassId((prev) => (list.some((c) => c.id === prev) ? prev : list[0]?.id ?? ''));
    setLoading(false);
  }, [schoolId]);

  const loadStudents = React.useCallback(async () => {
    const req = ++studentReq.current;
    if (!classId) {
      setStudents([]);
      return;
    }
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('class_id', classId)
      .order('seat_number', { ascending: true });
    if (req !== studentReq.current) return;
    if (error) toastError(error, '讀取學生失敗。請重新整理頁面。');
    setStudents((data ?? []) as Student[]);
  }, [classId]);

  const loadSessions = React.useCallback(
    async (append = false, offset = 0) => {
      const req = ++sessionReq.current;
      if (!classId) {
        setSessions([]);
        setSessionTotal(0);
        return;
      }
      if (!append) setSessions([]);
      const { data, error, count } = await supabase
        .from('attendance_sessions')
        .select('*', { count: 'exact' })
        .eq('class_id', classId)
        .order('session_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + SESSION_PAGE - 1);
      if (req !== sessionReq.current) return;
      if (error) {
        toastError(error, '讀取點名紀錄失敗。請重新整理頁面。');
        return;
      }
      const rows = (data ?? []) as AttendanceSession[];
      setSessions((prev) => (append ? [...prev, ...rows] : rows));
      setSessionTotal(count ?? rows.length);
    },
    [classId]
  );

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await loadSessions(true, sessions.length);
    setLoadingMore(false);
  };

  React.useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  React.useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  React.useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const visibleStudents = React.useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.name.toLowerCase().includes(q) || s.student_number.toLowerCase().includes(q));
  }, [students, studentSearch]);

  const handleDelete = async () => {
    if (!target) return;
    try {
      if (target.kind === 'class') {
        const photos = await deleteClassEverything(target.item.id);
        toast.success(`已永久刪除班級「${target.item.name}」，並清除 ${photos.removed} 張照片`);
        if (photos.failed) toast.warning(PHOTO_LEFTOVER_WARNING);
        await loadClasses();
      } else if (target.kind === 'session') {
        const photos = await deleteSessionRecord(target.item.id, target.item.snapshot_path);
        toast.success('已永久刪除這次點名紀錄');
        if (photos.failed) toast.warning(PHOTO_LEFTOVER_WARNING);
        setSessions((list) => list.filter((x) => x.id !== target.item.id));
        setSessionTotal((n) => Math.max(0, n - 1));
      } else {
        await deleteStudentRecord(target.item.id);
        toast.success(`已永久刪除學生「${target.item.name}」`);
        setStudents((list) => list.filter((s) => s.id !== target.item.id));
      }
      onChanged?.();
    } catch (err) {
      toastError(err, '刪除失敗。請稍後再試。');
      throw err;
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-bold text-foreground">班級與學生</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          先選學校，再選要處理的班級。刪除班級會連同學生、點名紀錄和點名照片一起刪除。
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="dp-school">學校</Label>
          <Select value={schoolId} onValueChange={setSchoolId}>
            <SelectTrigger id="dp-school">
              <SelectValue placeholder="選擇學校" />
            </SelectTrigger>
            <SelectContent>
              {schools.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <ListSkeleton rows={3} />
      ) : classes.length === 0 ? (
        <EmptyState title="這間學校還沒有班級" description="學校主管建立班級後會顯示在這裡。" />
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-3">
            <h3 className="text-base font-bold text-foreground">班級（{classes.length}）</h3>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {classes.map((c) => (
                <li
                  key={c.id}
                  className={`flex items-center justify-between gap-3 px-3 py-3 ${c.id === classId ? 'bg-secondary/60' : ''}`}
                >
                  <button type="button" className="min-w-0 text-left" onClick={() => setClassId(c.id)} aria-pressed={c.id === classId}>
                    <span className="block font-medium text-foreground">{c.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {c.academic_year} 學年　{c.grade}
                    </span>
                  </button>
                  <IconButton
                    label={`永久刪除班級 ${c.name}`}
                    onClick={() => setTarget({ kind: 'class', item: c })}
                    className="text-absent hover:text-absent"
                  >
                    <Trash2 aria-hidden="true" />
                  </IconButton>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-bold text-foreground">
              學生（{students.length}）
            </h3>
            <Input
              aria-label="搜尋學生姓名或學號"
              placeholder="搜尋學生姓名或學號"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
            />
            {visibleStudents.length === 0 ? (
              <EmptyState title="沒有符合的學生" description="這個班級沒有學生，或換個關鍵字試試。" />
            ) : (
              <ScrollArea className="rounded-lg border border-border" viewportClassName="max-h-96">
                <ul className="divide-y divide-border">
                  {visibleStudents.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-3">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">
                          <span className="tabular mr-2 text-muted-foreground">{s.seat_number}</span>
                          {s.name}
                        </p>
                        <p className="tabular text-sm text-muted-foreground">{s.student_number}</p>
                      </div>
                      <IconButton
                        label={`永久刪除學生 ${s.name}`}
                        onClick={() => setTarget({ kind: 'student', item: s })}
                        className="text-absent hover:text-absent"
                      >
                        <Trash2 aria-hidden="true" />
                      </IconButton>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </div>

          <div className="space-y-3 lg:col-span-2">
            <h3 className="text-base font-bold text-foreground">點名紀錄（{sessionTotal}）</h3>
            <p className="text-sm text-muted-foreground">
              選好上方的班級後，可以單獨刪除某一次點名。刪除會一併刪除當次所有學生的出缺席與點名照片。
            </p>
            {sessions.length === 0 ? (
              <EmptyState title="這個班還沒有點名紀錄" description="老師完成點名後會出現在這裡。" />
            ) : (
              <ScrollArea className="rounded-lg border border-border" viewportClassName="max-h-96">
                <ul className="divide-y divide-border">
                  {sessions.map((sess) => (
                    <li key={sess.id} className="flex items-center justify-between gap-3 px-3 py-3">
                      <p className="tabular font-medium text-foreground">
                        {sess.session_date}
                        <span className="ml-3 text-muted-foreground">
                          {sess.period ? periodLabel(sess.period) : '一般'}
                        </span>
                        {!sess.snapshot_path && <span className="ml-3 text-sm text-muted-foreground">沒有照片</span>}
                      </p>
                      <IconButton
                        label={`永久刪除 ${sess.session_date} 這次點名`}
                        onClick={() => setTarget({ kind: 'session', item: sess })}
                        className="text-absent hover:text-absent"
                      >
                        <Trash2 aria-hidden="true" />
                      </IconButton>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
            {sessions.length < sessionTotal && (
              <Button type="button" variant="outline" disabled={loadingMore} onClick={handleLoadMore}>
                {loadingMore ? '載入中…' : `載入更早的紀錄（還有 ${sessionTotal - sessions.length} 筆）`}
              </Button>
            )}
          </div>
        </div>
      )}

      <DangerConfirmDialog
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title={
          target?.kind === 'class'
            ? `永久刪除班級「${target.item.name}」？`
            : target?.kind === 'session'
            ? `永久刪除 ${target.item.session_date} 的這次點名？`
            : `永久刪除學生「${target?.item.name ?? ''}」？`
        }
        confirmText={
          target?.kind === 'session' ? target.item.session_date : (target as { item: { name: string } } | null)?.item.name ?? ''
        }
        consequences={
          target?.kind === 'class'
            ? ['班級裡所有學生', '這個班所有點名紀錄與座位表', '這個班所有點名時拍的照片', '這個班的課表']
            : target?.kind === 'session'
            ? ['這次點名所有學生的出缺席', '這次點名時拍的照片']
            : ['這位學生的資料', '這位學生所有出缺席紀錄']
        }
        onConfirm={handleDelete}
      />
    </section>
  );
}
