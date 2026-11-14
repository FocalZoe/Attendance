import * as React from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { Navbar } from '@/components/ui/navbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Bell, Camera, Grid3X3, PlusCircle, Trash2 } from 'lucide-react';
import type { SchoolClass, Student } from '@/types/database';
import { SeatMapEditorModal } from '@/components/attendance/SeatMapEditorModal';
const LiveAttendanceRollcall = React.lazy(() =>
  import('@/components/attendance/LiveAttendanceRollcall').then((m) => ({ default: m.LiveAttendanceRollcall }))
);
import { AttendanceHistoryView } from '@/components/attendance/AttendanceHistoryView';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useRollcallReminders } from '@/hooks/useRollcallReminders';
import { formatTime, getNextSchedule, getTodaySchedules, WEEKDAY_LABELS, weekdayOf } from '@/lib/schedule';
import { periodLabel } from '@/lib/periods';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { toastError } from '@/lib/errors';
import { useProductTour } from '@/hooks/useProductTour';
import { useCameraPermission } from '@/hooks/useCameraPermission';
import { CAMERA_BLOCKED_STEPS } from '@/lib/camera-permission';

interface AssignedClassItem {
  class: SchoolClass;
  role: 'homeroom' | 'subject';
}

const EMPTY_STUDENT_FORM = {
  student_number: '',
  name: '',
  seat_number: 1,
  gender: '未填',
  parent_phone: '',
};

export function TeacherDashboard() {
  const { profile } = useAuthStore();
  const schoolId = profile?.school_id;

  const [assignedClasses, setAssignedClasses] = React.useState<AssignedClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = React.useState<string>('');
  const [classStudents, setClassStudents] = React.useState<Student[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  useProductTour({ role: 'teacher', userId: profile?.id, ready: !loading });
  const cameraPermission = useCameraPermission();
  const [attendanceRefreshKey, setAttendanceRefreshKey] = React.useState<number>(0);
  const [now, setNow] = React.useState<Date>(() => new Date());

  // 模態視窗狀態
  const [seatingEditorOpen, setSeatingEditorOpen] = React.useState<boolean>(false);
  const [liveRollcallOpen, setLiveRollcallOpen] = React.useState<boolean>(false);
  const [activeModalClass, setActiveModalClass] = React.useState<{ id: string; name: string } | null>(null);
  const [rollcallPeriod, setRollcallPeriod] = React.useState<string | undefined>(undefined);
  const { request: requestConfirm, dialog: confirmDialog } = useConfirm();

  // 班級學生管理 Modal (導師專用)
  const [studentModalOpen, setStudentModalOpen] = React.useState<boolean>(false);
  const [studentForm, setStudentForm] = React.useState(EMPTY_STUDENT_FORM);

  // 每分鐘更新目前時間，讓「下一節」自動前進
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // Load every class this teacher is assigned to (homeroom and subject).
  // Only the first load shows the page skeleton; later refreshes keep the page in place.
  const hasLoadedRef = React.useRef(false);
  const loadAssignedClasses = React.useCallback(async () => {
    if (!profile) return;
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('class_teachers')
        .select('role, class:classes(*)')
        .eq('teacher_id', profile.id);

      if (error) throw error;

      if (data && data.length > 0) {
        const mapped: AssignedClassItem[] = data
          .filter((item) => item.class !== null)
          .map((item) => ({
            class: item.class as unknown as SchoolClass,
            role: item.role as 'homeroom' | 'subject',
          }));

        setAssignedClasses(mapped);
        // Functional update: keep the current selection, only default to the first class
        if (mapped.length > 0) setSelectedClassId((prev) => prev || mapped[0].class.id);
      } else {
        // No class_teachers rows yet: fall back to every class in the school as subject teacher
        if (schoolId) {
          const { data: schoolClasses } = await supabase
            .from('classes')
            .select('*')
            .eq('school_id', schoolId);

          if (schoolClasses && schoolClasses.length > 0) {
            const mapped: AssignedClassItem[] = schoolClasses.map((c) => ({
              class: c,
              role: 'subject',
            }));
            setAssignedClasses(mapped);
            setSelectedClassId((prev) => prev || mapped[0].class.id);
          }
        }
      }
    } catch (err: unknown) {
      console.error('載入教師班級失敗:', err);
      toast.error('無法載入你的班級。請重新整理頁面，若仍失敗請聯繫學校主管。');
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
    }
  }, [profile, schoolId]);

  React.useEffect(() => {
    loadAssignedClasses();
  }, [loadAssignedClasses]);

  // 2. 載入選定班級之學生清單
  const loadStudents = React.useCallback(async (cId: string) => {
    if (!cId) return;
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', cId)
        .order('seat_number', { ascending: true });

      if (error) throw error;
      setClassStudents(data || []);
    } catch (err: unknown) {
      console.error('載入學生失敗:', err);
    }
  }, []);

  React.useEffect(() => {
    if (selectedClassId) {
      loadStudents(selectedClassId);
    }
  }, [selectedClassId, loadStudents]);

  const currentAssigned = assignedClasses.find((item) => item.class.id === selectedClassId);
  const isCurrentHomeroom = currentAssigned?.role === 'homeroom';

  // 快速啟動劃位
  const handleOpenSeating = (cls: SchoolClass) => {
    setSelectedClassId(cls.id);
    setActiveModalClass({ id: cls.id, name: cls.name });
    setSeatingEditorOpen(true);
  };

  // 快速啟動點名
  const handleOpenRollcall = (cls: SchoolClass, period?: string) => {
    setSelectedClassId(cls.id);
    setActiveModalClass({ id: cls.id, name: cls.name });
    setRollcallPeriod(period);
    setLiveRollcallOpen(true);
  };

  // 導師新增在籍學生
  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId || !schoolId) return;

    try {
      const { error } = await supabase.from('students').insert({
        school_id: schoolId,
        class_id: selectedClassId,
        student_number: studentForm.student_number.trim(),
        name: studentForm.name.trim(),
        seat_number: Number(studentForm.seat_number),
        gender: studentForm.gender,
        parent_phone: studentForm.parent_phone.trim(),
      });

      if (error) throw error;

      toast.success('已新增學生');
      setStudentModalOpen(false);
      setStudentForm({ ...EMPTY_STUDENT_FORM, seat_number: classStudents.length + 2 });
      loadStudents(selectedClassId);
    } catch (err: unknown) {
      toastError(err, '新增學生失敗。請確認學號沒有重複後再試一次。');
    }
  };

  // 導師刪除在籍學生
  const deleteStudent = async (studentId: string) => {
    const previous = classStudents;
    setClassStudents((list) => list.filter((st) => st.id !== studentId));
    try {
      const { error } = await supabase.from('students').delete().eq('id', studentId);
      if (error) throw error;
      toast.success('已移除學生');
    } catch (err: unknown) {
      setClassStudents(previous);
      toastError(err, '移除失敗。請稍後再試。');
    }
  };

  const handleDeleteStudent = (studentId: string, studentName: string) => {
    requestConfirm({
      title: `移除學生「${studentName}」？`,
      description: '將自班級名冊移除，該學生的出缺勤紀錄也會一併刪除，無法復原。',
      confirmLabel: '移除學生',
      destructive: true,
      action: () => deleteStudent(studentId),
    });
  };

  // 課表提醒觸發：切換到該班並開啟點名（節次預選，不自動開鏡頭）
  const handleReminderStart = React.useCallback(
    (classId: string, period: string) => {
      const target = assignedClasses.find((item) => item.class.id === classId);
      if (!target) return;
      setSelectedClassId(classId);
      setActiveModalClass({ id: classId, name: target.class.name });
      setRollcallPeriod(period);
      setLiveRollcallOpen(true);
    },
    [assignedClasses]
  );

  const { schedules, permission, requestPermission } = useRollcallReminders({
    teacherId: profile?.id,
    schoolId,
    onStart: handleReminderStart,
  });

  const todaySchedules = React.useMemo(() => getTodaySchedules(schedules, now), [schedules, now]);
  const nextSchedule = React.useMemo(() => getNextSchedule(schedules, now), [schedules, now]);
  const laterToday = todaySchedules.filter(
    (s) => nextSchedule && s.id !== nextSchedule.id && s.start_time > nextSchedule.start_time
  );

  const nextClass = nextSchedule
    ? assignedClasses.find((item) => item.class.id === nextSchedule.class_id)?.class
    : undefined;

  const dateLabel = `${now.getMonth() + 1} 月 ${now.getDate()} 日　${WEEKDAY_LABELS[weekdayOf(now)]}`;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar profile={profile} />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-10 px-4 py-8 sm:px-6 lg:px-8">
        {/* 今日優先 */}
        <section aria-labelledby="today-heading" data-tour="today">
          <p className="tabular text-sm text-muted-foreground">{dateLabel}</p>
          <h1 id="today-heading" className="mt-1 text-3xl font-bold text-foreground">
            {profile?.name || ''} 老師，今天的點名
          </h1>

          {loading ? (
            <div className="mt-5">
              <ListSkeleton rows={2} />
            </div>
          ) : nextSchedule && nextClass ? (
            <div className="mt-5 rounded-lg bg-primary p-5 text-primary-foreground sm:p-6">
              <p className="text-sm opacity-90">下一節</p>
              <p className="mt-1 font-display text-2xl font-bold">
                {nextClass.name}　{periodLabel(nextSchedule.period)}
              </p>
              <p className="tabular mt-1 text-sm opacity-90">
                {formatTime(nextSchedule.start_time)} 開始
              </p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Button
                  size="lg"
                  className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                  onClick={() => handleOpenRollcall(nextClass, nextSchedule.period)}
                >
                  <Camera aria-hidden="true" />
                  開始點名
                </Button>
              </div>
            </div>
          ) : (
            <EmptyState
              className="mt-5"
              title={schedules.length === 0 ? '學校主管還沒有為你設定點名時間' : '今天沒有其他點名時段了'}
              description={
                schedules.length === 0
                  ? '點名時間由學校主管設定，設定好後時間快到時這裡會提醒你。想臨時點名，可以從下方選一個班級直接開始。'
                  : '想臨時點名，可以從下方選一個班級直接開始。'
              }
            />
          )}

          {(cameraPermission.state === 'prompt' || cameraPermission.state === 'denied') && (
            <div
              data-tour="camera-permission"
              className="mt-5 flex flex-col gap-3 rounded-lg border border-border bg-secondary p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              {cameraPermission.state === 'prompt' ? (
                <>
                  <div>
                    <p className="font-bold text-foreground">先允許使用鏡頭</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      第一次使用請先允許鏡頭，之後點名時才能自動辨識座位上有沒有人。
                    </p>
                  </div>
                  <Button type="button" onClick={() => cameraPermission.request()}>
                    <Camera aria-hidden="true" />
                    允許使用鏡頭
                  </Button>
                </>
              ) : (
                <>
                  <div>
                    <p className="font-bold text-foreground">鏡頭被瀏覽器擋住了</p>
                    <ol className="mt-1 list-inside list-decimal text-sm text-muted-foreground">
                      {CAMERA_BLOCKED_STEPS.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </div>
                  <Button type="button" variant="outline" onClick={() => cameraPermission.recheck()}>
                    我改好了，重新檢查
                  </Button>
                </>
              )}
            </div>
          )}

          {laterToday.length > 0 && (
            <div className="mt-5">
              <h2 className="text-base font-bold text-foreground">今天稍後</h2>
              <ul className="mt-2 divide-y divide-border border-y border-border">
                {laterToday.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span className="tabular w-14 shrink-0 text-muted-foreground">{formatTime(s.start_time)}</span>
                    <span className="min-w-0 flex-1 truncate text-foreground">
                      {s.class?.name ?? '班級'}　{periodLabel(s.period)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {permission === 'default' && schedules.length > 0 && (
            <Button type="button" variant="ghost" size="sm" className="mt-4" onClick={requestPermission}>
              <Bell aria-hidden="true" />
              開啟桌面提醒（分頁在背景時也會通知）
            </Button>
          )}
        </section>

        {/* 我的班級 */}
        <section aria-labelledby="classes-heading" data-tour="classes">
          <h2 id="classes-heading" className="text-xl font-bold text-foreground">
            我的班級（{assignedClasses.length}）
          </h2>

          {loading ? (
            <div className="mt-4">
              <ListSkeleton rows={3} />
            </div>
          ) : assignedClasses.length === 0 ? (
            <EmptyState
              className="mt-4"
              title="你還沒有被指派任何班級"
              description="請聯繫學校主管，請他在「班級與教師」頁籤的「指派導師與科任老師」把你加入班級。"
            />
          ) : (
            <ul className="mt-4 divide-y divide-border border-y border-border">
              {assignedClasses.map((item, index) => {
                const isSelected = item.class.id === selectedClassId;
                const isHomeroom = item.role === 'homeroom';

                return (
                  <li
                    key={item.class.id}
                    className={cn(
                      'flex flex-col gap-3 border-l-2 py-4 pl-4 sm:flex-row sm:items-center sm:justify-between',
                      isSelected ? 'border-primary bg-secondary/50' : 'border-transparent'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedClassId(item.class.id)}
                      className="min-w-0 text-left"
                      aria-pressed={isSelected}
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-lg font-bold text-foreground">{item.class.name}</span>
                        <Badge variant={isHomeroom ? 'default' : 'outline'}>{isHomeroom ? '導師' : '科任'}</Badge>
                      </span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        {item.class.academic_year} 學年　{item.class.grade}
                      </span>
                    </button>

                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" data-tour={index === 0 ? 'rollcall' : undefined} onClick={() => handleOpenRollcall(item.class)}>
                        <Camera aria-hidden="true" />
                        點名
                      </Button>
                      <Button size="sm" variant="outline" data-tour={index === 0 ? 'seat' : undefined} onClick={() => handleOpenSeating(item.class)}>
                        <Grid3X3 aria-hidden="true" />
                        座位
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 選定班級：紀錄與名冊 */}
        {currentAssigned && (
          <section aria-labelledby="class-detail-heading">
            <h2 id="class-detail-heading" className="text-xl font-bold text-foreground">
              {currentAssigned.class.name}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isCurrentHomeroom ? '你是這班的導師，可以新增與移除學生。' : '你是這班的科任老師，可以點名與查看紀錄，但不能更動學生名冊。'}
            </p>

            <Tabs defaultValue="attendance_records" className="mt-5">
              <TabsList>
                <TabsTrigger value="attendance_records" data-tour="records">點名紀錄</TabsTrigger>
                <TabsTrigger value="roster">學生名冊（{classStudents.length}）</TabsTrigger>
              </TabsList>

              <TabsContent value="attendance_records">
                <AttendanceHistoryView
                  key={attendanceRefreshKey}
                  classId={currentAssigned.class.id}
                  isEditable={true}
                />
              </TabsContent>

              <TabsContent value="roster">
                {isCurrentHomeroom && (
                  <div className="mb-3 flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setStudentForm({ ...EMPTY_STUDENT_FORM, seat_number: classStudents.length + 1 });
                        setStudentModalOpen(true);
                      }}
                    >
                      <PlusCircle aria-hidden="true" />
                      新增學生
                    </Button>
                  </div>
                )}

                {classStudents.length === 0 ? (
                  <EmptyState
                    title="這個班級還沒有學生"
                    description={isCurrentHomeroom ? '按「新增學生」建立名冊，之後才能在座位表上指定座位。' : '請聯繫這班的導師或學校主管建立名冊。'}
                  />
                ) : (
                  <>
                    {/* 手機：列表 */}
                    <ul className="divide-y divide-border border-y border-border md:hidden">
                      {classStudents.map((st) => (
                        <li key={st.id} className="flex items-center gap-3 py-3">
                          <span className="tabular w-8 shrink-0 text-right font-bold text-muted-foreground">
                            {st.seat_number}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-foreground">{st.name}</p>
                            <p className="tabular text-sm text-muted-foreground">{st.student_number}</p>
                          </div>
                          {isCurrentHomeroom && (
                            <IconButton label={`移除 ${st.name}`} onClick={() => handleDeleteStudent(st.id, st.name)}>
<Trash2 aria-hidden="true" />
</IconButton>
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
                            <TableHead className="w-36">學號</TableHead>
                            <TableHead className="w-36">姓名</TableHead>
                            <TableHead className="w-24">性別</TableHead>
                            <TableHead>家長聯絡電話</TableHead>
                            {isCurrentHomeroom && <TableHead className="w-20 text-right">操作</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {classStudents.map((st) => (
                            <TableRow key={st.id}>
                              <TableCell className="tabular font-bold">{st.seat_number}</TableCell>
                              <TableCell className="tabular">{st.student_number}</TableCell>
                              <TableCell className="font-medium text-foreground">{st.name}</TableCell>
                              <TableCell className="text-muted-foreground">{st.gender || '-'}</TableCell>
                              <TableCell className="tabular text-muted-foreground">{st.parent_phone}</TableCell>
                              {isCurrentHomeroom && (
                                <TableCell className="text-right">
                                  <IconButton label={`移除 ${st.name}`} onClick={() => handleDeleteStudent(st.id, st.name)}>
<Trash2 aria-hidden="true" />
</IconButton>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </TabsContent>
            </Tabs>
          </section>
        )}

        {/* 教室座位彈窗 */}
        {activeModalClass && (
          <SeatMapEditorModal
            open={seatingEditorOpen}
            onOpenChange={setSeatingEditorOpen}
            classId={activeModalClass.id}
            className={activeModalClass.name}
            students={classStudents}
            onSaved={() => {
              setAttendanceRefreshKey((k) => k + 1);
            }}
          />
        )}

        {/* AI 鏡頭點名彈窗 */}
        {activeModalClass && profile && (
          <React.Suspense fallback={null}>
          <LiveAttendanceRollcall
            open={liveRollcallOpen}
            onOpenChange={setLiveRollcallOpen}
            classId={activeModalClass.id}
            className={activeModalClass.name}
            teacherId={profile.id}
            students={classStudents}
            initialPeriod={rollcallPeriod}
            onAttendanceCompleted={() => {
              setAttendanceRefreshKey((k) => k + 1);
            }}
          />
          </React.Suspense>
        )}

        {confirmDialog}

        {/* 導師新增學生 Modal */}
        <Dialog open={studentModalOpen} onOpenChange={setStudentModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>新增學生・{currentAssigned?.class.name}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateStudent} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="ts-seat">座號</Label>
                  <Input
                    id="ts-seat"
                    autoFocus
                    type="number"
                    required
                    min={1}
                    value={studentForm.seat_number}
                    onChange={(e) =>
                      setStudentForm((prev) => ({ ...prev, seat_number: parseInt(e.target.value) || 1 }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ts-number">學號</Label>
                  <Input
                    id="ts-number"
                    required
                    placeholder="S113001"
                    value={studentForm.student_number}
                    onChange={(e) => setStudentForm((prev) => ({ ...prev, student_number: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="ts-name">姓名</Label>
                  <Input
                    id="ts-name"
                    required
                    placeholder="林小明"
                    value={studentForm.name}
                    onChange={(e) => setStudentForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ts-gender">性別</Label>
                  <Select
                    value={studentForm.gender}
                    onValueChange={(val) => setStudentForm((prev) => ({ ...prev, gender: val }))}
                  >
                    <SelectTrigger id="ts-gender">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="男">男</SelectItem>
                      <SelectItem value="女">女</SelectItem>
                      <SelectItem value="未填">未填</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ts-phone">家長聯絡電話</Label>
                <Input
                  id="ts-phone"
                  required
                  type="tel"
                  placeholder="0912345678"
                  value={studentForm.parent_phone}
                  onChange={(e) => setStudentForm((prev) => ({ ...prev, parent_phone: e.target.value }))}
                />
                <p className="text-sm text-muted-foreground">電話末四碼會用於家長查勤驗證。</p>
              </div>

              <DialogFooter className="gap-2 sm:space-x-0">
                <Button type="submit">新增學生</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
