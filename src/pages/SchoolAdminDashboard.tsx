import * as React from 'react';
import { supabase, createIsolatedClient } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { Navbar } from '@/components/ui/navbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { InlineAlert } from '@/components/ui/inline-alert';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { validatePassword } from '@/lib/password';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AttendanceHistoryView } from '@/components/attendance/AttendanceHistoryView';
import { SeatMapEditorModal } from '@/components/attendance/SeatMapEditorModal';
import { Grid3X3, Trash2, UserCheck, UserX } from 'lucide-react';
import type { SchoolClass, Profile, Student, ClassTeacher } from '@/types/database';
import { toast } from 'sonner';

const EMPTY_STUDENT_FORM = {
  student_number: '',
  name: '',
  seat_number: 1,
  gender: '未填',
  parent_phone: '',
};

export function SchoolAdminDashboard() {
  const { profile } = useAuthStore();
  const schoolId = profile?.school_id;

  const [schoolName, setSchoolName] = React.useState('');
  const [schoolCode, setSchoolCode] = React.useState('');
  const [classes, setClasses] = React.useState<SchoolClass[]>([]);
  const [teachers, setTeachers] = React.useState<Profile[]>([]);
  const [studentCount, setStudentCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  // 班級指派與關聯列表
  const [classTeachers, setClassTeachers] = React.useState<ClassTeacher[]>([]);
  const [assignClassId, setAssignClassId] = React.useState<string>('');
  const [assignTeacherId, setAssignTeacherId] = React.useState<string>('');
  const [assignRole, setAssignRole] = React.useState<'homeroom' | 'subject'>('homeroom');

  // 學生名冊管理
  const [selectedClassForStudents, setSelectedClassForStudents] = React.useState<string>('');
  const [classStudents, setClassStudents] = React.useState<Student[]>([]);
  const [studentModalOpen, setStudentModalOpen] = React.useState<boolean>(false);
  const [studentForm, setStudentForm] = React.useState(EMPTY_STUDENT_FORM);

  // 學校主管劃位檢視狀態
  const [seatingEditorOpen, setSeatingEditorOpen] = React.useState<boolean>(false);
  const [activeModalClass, setActiveModalClass] = React.useState<{ id: string; name: string } | null>(null);

  // Form states
  const [className, setClassName] = React.useState('');
  const [classGrade, setClassGrade] = React.useState('');
  const [academicYear, setAcademicYear] = React.useState('113');
  const [creatingClass, setCreatingClass] = React.useState(false);
  const [classError, setClassError] = React.useState('');

  const [teacherName, setTeacherName] = React.useState('');
  const [teacherEmail, setTeacherEmail] = React.useState('');
  const [teacherPassword, setTeacherPassword] = React.useState('');
  const [creatingTeacher, setCreatingTeacher] = React.useState(false);
  const [teacherError, setTeacherError] = React.useState('');

  const { request: requestConfirm, dialog: confirmDialog } = useConfirm();
  const activeTeachers = React.useMemo(
    () => teachers.filter((t) => t.is_active !== false),
    [teachers]
  );

  const loadData = React.useCallback(async () => {
    if (!schoolId) {
      setLoading(false);
      return;
    }

    try {
      const [schoolRes, classesRes, teachersRes, studentsCountRes] = await Promise.all([
        supabase.from('schools').select('name, code').eq('id', schoolId).single(),
        supabase.from('classes').select('*').eq('school_id', schoolId).order('academic_year', { ascending: false }),
        supabase.from('profiles').select('*').eq('school_id', schoolId).eq('role', 'teacher').order('name', { ascending: true }),
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', schoolId),
      ]);

      if (schoolRes.data) {
        setSchoolName(schoolRes.data.name);
        setSchoolCode(schoolRes.data.code);
      }
      if (classesRes.data) {
        setClasses(classesRes.data);
        if (classesRes.data.length > 0 && !selectedClassForStudents) {
          setSelectedClassForStudents(classesRes.data[0].id);
        }

        // 僅查詢本校班級之師資指派，嚴格落實多租戶隔離
        const classIds = classesRes.data.map((c) => c.id);
        if (classIds.length > 0) {
          const { data: ctData } = await supabase
            .from('class_teachers')
            .select('*, teacher:profiles(*), class:classes(*)')
            .in('class_id', classIds);
          setClassTeachers((ctData || []) as ClassTeacher[]);
        } else {
          setClassTeachers([]);
        }
      }
      if (teachersRes.data) {
        setTeachers(teachersRes.data);
      }
      setStudentCount(studentsCountRes.count || 0);
    } catch (err) {
      console.error('載入學校數據失敗:', err);
      toast.error('無法載入學校資料。請重新整理頁面再試一次。');
    } finally {
      setLoading(false);
    }
  }, [schoolId, selectedClassForStudents]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // 載入所選班級的學生清單
  const loadClassStudents = React.useCallback(async (cId: string) => {
    if (!cId) return;
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', cId)
        .order('seat_number', { ascending: true });

      if (error) throw error;
      setClassStudents(data || []);
    } catch (err) {
      console.error('載入學生失敗:', err);
    }
  }, []);

  React.useEffect(() => {
    if (selectedClassForStudents) {
      loadClassStudents(selectedClassForStudents);
    }
  }, [selectedClassForStudents, loadClassStudents]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!className || !classGrade || !academicYear || !schoolId) return;

    setCreatingClass(true);
    setClassError('');

    try {
      const { error } = await supabase.from('classes').insert({
        school_id: schoolId,
        name: className.trim(),
        grade: classGrade.trim(),
        academic_year: academicYear.trim(),
      });

      if (error) {
        setClassError(error.message);
      } else {
        setClassName('');
        setClassGrade('');
        toast.success('已建立班級');
        await loadData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '建立班級失敗。請稍後再試。';
      setClassError(msg);
    } finally {
      setCreatingClass(false);
    }
  };

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherName || !teacherEmail || !teacherPassword || !schoolId) return;

    const passwordError = validatePassword(teacherPassword);
    if (passwordError) {
      setTeacherError(passwordError);
      return;
    }

    setCreatingTeacher(true);
    setTeacherError('');

    try {
      const isolated = createIsolatedClient();
      const { data, error } = await isolated.auth.signUp({
        email: teacherEmail.trim(),
        password: teacherPassword,
        options: {
          data: {
            name: teacherName.trim(),
          },
        },
      });

      if (error) {
        setTeacherError(error.message);
      } else {
        if (data.user) {
          // 學校綁定僅能經由伺服器端 RPC（驗證呼叫者為本校主管）
          const { error: assignError } = await supabase.rpc('assign_teacher_to_school', {
            p_teacher_id: data.user.id,
            p_name: teacherName.trim(),
            p_phone: null,
          });
          if (assignError) {
            setTeacherError(assignError.message);
            return;
          }
        }
        setTeacherName('');
        setTeacherEmail('');
        setTeacherPassword('');
        toast.success('已建立教師帳號');
        await loadData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '建立教師帳號失敗。請稍後再試。';
      setTeacherError(msg);
    } finally {
      setCreatingTeacher(false);
    }
  };

  // 指派班級教師 (班級老師 or 科任老師)
  const handleAssignTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignClassId || !assignTeacherId) {
      toast.error('請先選擇班級與教師，再按「指派」。');
      return;
    }

    try {
      const { error } = await supabase.from('class_teachers').insert({
        class_id: assignClassId,
        teacher_id: assignTeacherId,
        role: assignRole,
      });

      if (error) {
        if (error.code === '23505') {
          toast.error('這位教師已經在這個班級任職了。');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success(`已指派為${assignRole === 'homeroom' ? '導師' : '科任老師'}`);
        await loadData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '指派失敗。請稍後再試。';
      toast.error(msg);
    }
  };

  // 移除班級教師指派
  const handleRemoveClassTeacher = async (id: string) => {
    try {
      const { error } = await supabase.from('class_teachers').delete().eq('id', id);
      if (error) throw error;
      toast.success('已解除指派');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '解除失敗。請稍後再試。';
      toast.error(msg);
    }
  };

  // 新增在籍學生
  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassForStudents || !schoolId) return;

    try {
      const { error } = await supabase.from('students').insert({
        school_id: schoolId,
        class_id: selectedClassForStudents,
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
      loadClassStudents(selectedClassForStudents);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '新增學生失敗。請確認學號沒有重複後再試一次。';
      toast.error(msg);
    }
  };

  // 刪除在籍學生
  const deleteStudent = async (studentId: string) => {
    try {
      const { error } = await supabase.from('students').delete().eq('id', studentId);
      if (error) throw error;
      toast.success('已移除學生');
      loadClassStudents(selectedClassForStudents);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '移除失敗。請稍後再試。';
      toast.error(msg);
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

  // 教師帳號停用 / 啟用（離職移除，保留歷史點名紀錄）
  const setTeacherActive = async (teacherId: string, active: boolean) => {
    try {
      const { error } = await supabase.rpc('set_user_active', {
        p_profile_id: teacherId,
        p_active: active,
      });
      if (error) throw error;
      toast.success(active ? '已重新啟用教師帳號' : '已停用教師帳號，歷史點名紀錄會保留');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '帳號狀態變更失敗。請稍後再試。';
      toast.error(msg);
    }
  };

  const handleDeactivateTeacher = (teacherId: string, teacherName: string) => {
    requestConfirm({
      title: `停用教師「${teacherName}」？`,
      description: '停用後這位教師無法登入，並會解除所有班級指派與課表。歷史點名紀錄會保留，之後可以重新啟用。',
      confirmLabel: '停用帳號',
      destructive: true,
      action: () => setTeacherActive(teacherId, false),
    });
  };

  const stats = [
    { label: '班級', value: classes.length },
    { label: '任課教師', value: activeTeachers.length },
    { label: '在籍學生', value: studentCount },
  ];

  const sectionHeading = 'font-display text-lg font-bold text-foreground';

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar profile={profile} />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        {/* 標題與統計 */}
        <section className="flex flex-col gap-6 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {loading ? '校務管理' : schoolName || '尚未綁定學校'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              校務管理
              {schoolCode && (
                <span className="tabular ml-2 rounded-sm border border-border bg-secondary px-1.5 py-0.5 font-mono text-xs text-foreground">
                  {schoolCode}
                </span>
              )}
            </p>
          </div>

          <dl className="grid grid-cols-3 divide-x divide-border">
            {stats.map((item) => (
              <div key={item.label} className="px-4 first:pl-0 sm:px-6">
                <dd className="tabular font-display text-3xl font-bold text-foreground">{item.value}</dd>
                <dt className="text-sm text-muted-foreground">{item.label}</dt>
              </div>
            ))}
          </dl>
        </section>

        {!schoolId && !loading ? (
          <EmptyState
            title="你的帳號還沒有綁定學校"
            description="請聯繫系統總管，請他把你指派為學校主管。"
          />
        ) : (
          <Tabs defaultValue="classes_teachers">
            <TabsList>
              <TabsTrigger value="classes_teachers">班級與教師</TabsTrigger>
              <TabsTrigger value="students">學生名冊</TabsTrigger>
              <TabsTrigger value="attendance_history">全校出勤</TabsTrigger>
            </TabsList>

            {/* 班級與教師 */}
            <TabsContent value="classes_teachers" className="mt-6">
              <div className="grid gap-10 lg:grid-cols-2">
                {/* 班級 */}
                <div className="space-y-8">
                  <section className="space-y-4">
                    <h2 className={sectionHeading}>班級（{classes.length}）</h2>
                    {loading ? (
                      <ListSkeleton rows={3} />
                    ) : classes.length === 0 ? (
                      <EmptyState
                        title="還沒有班級"
                        description="先在下方建立班級，才能指派教師、建立名冊與座位。"
                      />
                    ) : (
                      <ul className="divide-y divide-border border-y border-border">
                        {classes.map((c) => (
                          <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                            <div className="min-w-0">
                              <p className="font-medium text-foreground">{c.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {c.academic_year} 學年　{c.grade}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setActiveModalClass({ id: c.id, name: c.name });
                                setSeatingEditorOpen(true);
                              }}
                            >
                              <Grid3X3 aria-hidden="true" />
                              座位
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="space-y-4">
                    <h2 className={sectionHeading}>新增班級</h2>
                    {classError && <InlineAlert>{classError}</InlineAlert>}
                    <form onSubmit={handleCreateClass} className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="school-academic-year">學年度</Label>
                          <Input
                            id="school-academic-year"
                            required
                            placeholder="例如 113"
                            value={academicYear}
                            onChange={(e) => setAcademicYear(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="school-class-grade">年級</Label>
                          <Input
                            id="school-class-grade"
                            required
                            placeholder="例如 高一"
                            value={classGrade}
                            onChange={(e) => setClassGrade(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="school-class-name">班級名稱</Label>
                        <Input
                          id="school-class-name"
                          required
                          placeholder="例如 資訊一甲"
                          value={className}
                          onChange={(e) => setClassName(e.target.value)}
                        />
                      </div>
                      <Button type="submit" disabled={creatingClass}>
                        {creatingClass ? '建立中' : '建立班級'}
                      </Button>
                    </form>
                  </section>
                </div>

                {/* 教師 */}
                <div className="space-y-8">
                  <section className="space-y-4">
                    <h2 className={sectionHeading}>教師帳號（{teachers.length}）</h2>
                    <p className="text-sm text-muted-foreground">
                      教師離職時可停用帳號。歷史點名紀錄會保留，之後也能重新啟用。
                    </p>
                    {loading ? (
                      <ListSkeleton rows={3} />
                    ) : teachers.length === 0 ? (
                      <EmptyState title="還沒有教師帳號" description="在下方建立第一位教師的帳號。" />
                    ) : (
                      <ul className="max-h-72 divide-y divide-border overflow-y-auto border-y border-border">
                        {teachers.map((t) => (
                          <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                            <div className="min-w-0">
                              <p className="flex items-center gap-2 font-medium text-foreground">
                                <span className="truncate">{t.name}</span>
                                {t.is_active === false && <Badge variant="destructive">已停用</Badge>}
                              </p>
                              <p className="truncate text-sm text-muted-foreground">{t.email}</p>
                            </div>
                            {t.is_active === false ? (
                              <Button type="button" variant="outline" size="sm" onClick={() => setTeacherActive(t.id, true)}>
                                <UserCheck aria-hidden="true" />
                                啟用
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeactivateTeacher(t.id, t.name)}
                              >
                                <UserX aria-hidden="true" />
                                停用
                              </Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="space-y-4">
                    <h2 className={sectionHeading}>新增教師帳號</h2>
                    <p className="text-sm text-muted-foreground">
                      由你設定初始密碼，教師登入後可自行修改。
                    </p>
                    {teacherError && <InlineAlert>{teacherError}</InlineAlert>}
                    <form onSubmit={handleCreateTeacher} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="teacher-real-name">姓名</Label>
                        <Input
                          id="teacher-real-name"
                          required
                          placeholder="例如 王小明"
                          value={teacherName}
                          onChange={(e) => setTeacherName(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="teacher-email">登入信箱</Label>
                          <Input
                            id="teacher-email"
                            type="email"
                            required
                            placeholder="teacher@school.edu.tw"
                            value={teacherEmail}
                            onChange={(e) => setTeacherEmail(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="teacher-password">初始密碼</Label>
                          <PasswordInput
                            id="teacher-password"
                            autoComplete="new-password"
                            required
                            placeholder="至少 6 個字元"
                            value={teacherPassword}
                            onChange={(e) => setTeacherPassword(e.target.value)}
                          />
                        </div>
                      </div>
                      <Button type="submit" disabled={creatingTeacher}>
                        {creatingTeacher ? '建立中' : '建立教師帳號'}
                      </Button>
                    </form>
                  </section>

                  <section className="space-y-4">
                    <h2 className={sectionHeading}>指派導師與科任老師</h2>
                    <form onSubmit={handleAssignTeacher} className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor="assign-class">班級</Label>
                          <Select value={assignClassId} onValueChange={setAssignClassId}>
                            <SelectTrigger id="assign-class">
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
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="assign-teacher">教師</Label>
                          <Select value={assignTeacherId} onValueChange={setAssignTeacherId}>
                            <SelectTrigger id="assign-teacher">
                              <SelectValue placeholder="選擇教師" />
                            </SelectTrigger>
                            <SelectContent>
                              {activeTeachers.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="assign-role">職務</Label>
                          <Select
                            value={assignRole}
                            onValueChange={(val) => setAssignRole(val as 'homeroom' | 'subject')}
                          >
                            <SelectTrigger id="assign-role">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="homeroom">導師</SelectItem>
                              <SelectItem value="subject">科任老師</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button type="submit">指派</Button>
                    </form>

                    {classTeachers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">還沒有任何指派。</p>
                    ) : (
                      <ul className="max-h-60 divide-y divide-border overflow-y-auto border-y border-border">
                        {classTeachers.map((ct) => (
                          <li key={ct.id} className="flex items-center justify-between gap-3 py-2.5">
                            <p className="min-w-0 truncate text-sm text-foreground">
                              <span className="font-medium">{ct.class?.name || '未知班級'}</span>
                              <span className="mx-2 text-muted-foreground">{ct.teacher?.name || '未知教師'}</span>
                              <Badge variant={ct.role === 'homeroom' ? 'default' : 'outline'}>
                                {ct.role === 'homeroom' ? '導師' : '科任'}
                              </Badge>
                            </p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveClassTeacher(ct.id)}
                              aria-label="解除指派"
                            >
                              <Trash2 aria-hidden="true" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
              </div>
            </TabsContent>

            {/* 學生名冊 */}
            <TabsContent value="students" className="mt-6 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className={sectionHeading}>學生名冊</h2>
                <div className="flex gap-3">
                  <Select value={selectedClassForStudents} onValueChange={setSelectedClassForStudents}>
                    <SelectTrigger className="w-full sm:w-52" aria-label="選擇班級">
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
                  <Button
                    type="button"
                    onClick={() => {
                      setStudentForm({ ...EMPTY_STUDENT_FORM, seat_number: classStudents.length + 1 });
                      setStudentModalOpen(true);
                    }}
                    disabled={!selectedClassForStudents}
                  >
                    新增學生
                  </Button>
                </div>
              </div>

              {classes.length === 0 ? (
                <EmptyState title="還沒有班級" description="先建立班級，才能新增學生。" />
              ) : classStudents.length === 0 ? (
                <EmptyState title="這個班級還沒有學生" description="按「新增學生」建立名冊。電話末四碼會用於家長查勤驗證。" />
              ) : (
                <>
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
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteStudent(st.id, st.name)}
                          aria-label={`移除 ${st.name}`}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </li>
                    ))}
                  </ul>

                  <div className="hidden overflow-hidden rounded-lg border border-border md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">座號</TableHead>
                          <TableHead className="w-36">學號</TableHead>
                          <TableHead className="w-36">姓名</TableHead>
                          <TableHead className="w-24">性別</TableHead>
                          <TableHead>家長聯絡電話</TableHead>
                          <TableHead className="w-20 text-right">操作</TableHead>
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
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteStudent(st.id, st.name)}
                                aria-label={`移除 ${st.name}`}
                              >
                                <Trash2 aria-hidden="true" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </TabsContent>

            {/* 全校出勤 */}
            <TabsContent value="attendance_history" className="mt-6 space-y-4">
              <h2 className={sectionHeading}>全校出勤紀錄</h2>
              {schoolId && <AttendanceHistoryView schoolId={schoolId} isEditable={true} />}
            </TabsContent>
          </Tabs>
        )}

        {/* 新增學生 Modal */}
        <Dialog open={studentModalOpen} onOpenChange={setStudentModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>新增學生</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateStudent} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="sa-seat">座號</Label>
                  <Input
                    id="sa-seat"
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
                  <Label htmlFor="sa-number">學號</Label>
                  <Input
                    id="sa-number"
                    required
                    placeholder="S113001"
                    value={studentForm.student_number}
                    onChange={(e) => setStudentForm((prev) => ({ ...prev, student_number: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="sa-name">姓名</Label>
                  <Input
                    id="sa-name"
                    required
                    placeholder="林小明"
                    value={studentForm.name}
                    onChange={(e) => setStudentForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sa-gender">性別</Label>
                  <Select
                    value={studentForm.gender}
                    onValueChange={(val) => setStudentForm((prev) => ({ ...prev, gender: val }))}
                  >
                    <SelectTrigger id="sa-gender">
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
                <Label htmlFor="sa-phone">家長聯絡電話</Label>
                <Input
                  id="sa-phone"
                  required
                  type="tel"
                  placeholder="0912345678"
                  value={studentForm.parent_phone}
                  onChange={(e) => setStudentForm((prev) => ({ ...prev, parent_phone: e.target.value }))}
                />
                <p className="text-sm text-muted-foreground">電話末四碼會用於家長查勤驗證。</p>
              </div>

              <DialogFooter className="gap-2 sm:space-x-0">
                <Button type="button" variant="outline" onClick={() => setStudentModalOpen(false)}>
                  取消
                </Button>
                <Button type="submit">新增學生</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* 學校主管教室座位彈窗 */}
        {activeModalClass && (
          <SeatMapEditorModal
            open={seatingEditorOpen}
            onOpenChange={setSeatingEditorOpen}
            classId={activeModalClass.id}
            className={activeModalClass.name}
            students={classStudents}
          />
        )}

        {confirmDialog}
      </main>
    </div>
  );
}
