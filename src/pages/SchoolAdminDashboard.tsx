import * as React from 'react';
import { supabase, createIsolatedClient } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { Navbar } from '@/components/ui/navbar';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AttendanceHistoryView } from '@/components/attendance/AttendanceHistoryView';
import { SeatMapEditorModal } from '@/components/attendance/SeatMapEditorModal';
import {
  School,
  Users,
  BookOpen,
  PlusCircle,
  GraduationCap,
  AlertCircle,
  Mail,
  UserPlus,
  UserCheck,
  History,
  Trash2,
  Grid3X3,
} from 'lucide-react';
import type { SchoolClass, Profile, Student, ClassTeacher } from '@/types/database';
import { toast } from 'sonner';

export function SchoolAdminDashboard() {
  const { profile } = useAuthStore();
  const schoolId = profile?.school_id;

  const [schoolName, setSchoolName] = React.useState('載入中...');
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
  const [studentForm, setStudentForm] = React.useState({
    student_number: '',
    name: '',
    seat_number: 1,
    gender: '未填',
    parent_phone: '',
  });

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

  const loadData = React.useCallback(async () => {
    if (!schoolId) {
      setSchoolName('未綁定學校單位');
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
        toast.success('已成功建立新班級編制');
        await loadData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '建立班級失敗';
      setClassError(msg);
    } finally {
      setCreatingClass(false);
    }
  };

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherName || !teacherEmail || !teacherPassword || !schoolId) return;

    setCreatingTeacher(true);
    setTeacherError('');

    try {
      const isolated = createIsolatedClient();
      const { data, error } = await isolated.auth.signUp({
        email: teacherEmail.trim(),
        password: teacherPassword.trim(),
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
        toast.success('已指派並開通任課教師初始帳號');
        await loadData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '建立教師帳號失敗';
      setTeacherError(msg);
    } finally {
      setCreatingTeacher(false);
    }
  };

  // 指派班級教師 (班級老師 or 科任老師)
  const handleAssignTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignClassId || !assignTeacherId) {
      toast.error('請先選擇班級與欲指派之任課教師');
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
          toast.error('該教師已在此班級中擔任職務');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success(`已成功指派為 ${assignRole === 'homeroom' ? '班級老師 (導師)' : '科任老師'}`);
        await loadData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '指派失敗';
      toast.error(msg);
    }
  };

  // 移除班級教師指派
  const handleRemoveClassTeacher = async (id: string) => {
    try {
      const { error } = await supabase.from('class_teachers').delete().eq('id', id);
      if (error) throw error;
      toast.success('已解除該教師指派');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '解除失敗';
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

      toast.success('已成功新增在籍學生');
      setStudentModalOpen(false);
      setStudentForm({
        student_number: '',
        name: '',
        seat_number: classStudents.length + 2,
        gender: '未填',
        parent_phone: '',
      });
      loadClassStudents(selectedClassForStudents);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '新增學生失敗';
      toast.error(msg);
    }
  };

  // 刪除在籍學生
  const handleDeleteStudent = async (studentId: string) => {
    if (!confirm('確定要自班級名冊中移除此學生嗎？')) return;
    try {
      const { error } = await supabase.from('students').delete().eq('id', studentId);
      if (error) throw error;
      toast.success('學生資料已移除');
      loadClassStudents(selectedClassForStudents);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '移除失敗';
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar profile={profile} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* 標題與所屬學校 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center space-x-2">
              <School className="w-6 h-6 text-emerald-600" />
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                學校主管管理中心
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-500 font-medium">
              當前所屬單位：
              <span className="text-slate-900 font-bold ml-1">{schoolName}</span>
              {schoolCode && (
                <span className="ml-2 font-mono text-xs bg-slate-100 border border-slate-300 px-2 py-0.5 rounded text-slate-700">
                  {schoolCode}
                </span>
              )}
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <Badge variant="success">校務專屬租戶</Badge>
          </div>
        </div>

        {/* 統計指標卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <Card className="border-slate-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 tracking-wider">
                  全校班級數
                </p>
                <p className="text-3xl font-black text-slate-900 mt-1">
                  {classes.length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <BookOpen className="w-6 h-6" />
              </div>
            </div>
          </Card>

          <Card className="border-slate-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 tracking-wider">
                  任課教師人數
                </p>
                <p className="text-3xl font-black text-slate-900 mt-1">
                  {teachers.length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                <Users className="w-6 h-6" />
              </div>
            </div>
          </Card>

          <Card className="border-slate-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 tracking-wider">
                  全校在籍學生
                </p>
                <p className="text-3xl font-black text-slate-900 mt-1">
                  {studentCount}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
                <GraduationCap className="w-6 h-6" />
              </div>
            </div>
          </Card>
        </div>

        {/* 核心校務分頁 */}
        <Tabs defaultValue="classes_teachers" className="space-y-6">
          <TabsList className="bg-slate-200 p-1">
            <TabsTrigger value="classes_teachers" className="text-xs font-bold">
              班級與教師編制
            </TabsTrigger>
            <TabsTrigger value="students" className="text-xs font-bold">
              學生名冊管理
            </TabsTrigger>
            <TabsTrigger value="attendance_history" className="text-xs font-bold">
              全校考勤狀況
            </TabsTrigger>
          </TabsList>

          {/* 分頁 1: 班級與教師編制 */}
          <TabsContent value="classes_teachers" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* 左側：班級名冊與新增班級 */}
              <div className="space-y-6">
                <Card className="border-slate-300">
                  <CardHeader className="pb-3 border-b border-slate-200">
                    <CardTitle className="text-base flex items-center">
                      <PlusCircle className="w-4 h-4 mr-2 text-emerald-600" />
                      新增班級編制
                    </CardTitle>
                    <CardDescription>
                      為所屬學校新增教學班級以利後續劃位與任課指派
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {classError && (
                      <div className="mb-4 p-2 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs font-medium flex items-center">
                        <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
                        {classError}
                      </div>
                    )}
                    <form onSubmit={handleCreateClass} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="school-academic-year">學年度</Label>
                          <Input
                            id="school-academic-year"
                            name="academic_year"
                            required
                            placeholder="例如：113"
                            value={academicYear}
                            onChange={(e) => setAcademicYear(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="school-class-grade">年級</Label>
                          <Input
                            id="school-class-grade"
                            name="grade"
                            required
                            placeholder="例如：高一 或 七年級"
                            value={classGrade}
                            onChange={(e) => setClassGrade(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="school-class-name">班級名稱</Label>
                        <Input
                          id="school-class-name"
                          name="name"
                          required
                          placeholder="例如：資訊一甲"
                          value={className}
                          onChange={(e) => setClassName(e.target.value)}
                        />
                      </div>
                      <Button type="submit" variant="default" className="w-full" disabled={creatingClass}>
                        {creatingClass ? '建立中...' : '建立班級'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <Card className="border-slate-300">
                  <CardHeader className="pb-3 border-b border-slate-200">
                    <CardTitle className="text-base">現有班級列表 ({classes.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {loading ? (
                      <div className="p-6 text-center text-slate-500 text-xs">載入中...</div>
                    ) : classes.length === 0 ? (
                      <div className="p-6 text-center text-slate-500 text-xs">
                        目前尚未建立任何班級。
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                        {classes.map((c) => (
                          <div key={c.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                            <div>
                              <span className="font-bold text-sm text-slate-900">{c.name}</span>
                              <span className="text-xs text-slate-500 ml-2">({c.academic_year} 學年度 · {c.grade})</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setActiveModalClass({ id: c.id, name: c.name });
                                  setSeatingEditorOpen(true);
                                }}
                                className="h-7 text-xs"
                              >
                                <Grid3X3 className="w-3 h-3 mr-1" />
                                教室劃位
                              </Button>
                              <Badge variant="outline">已啟用</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* 右側：教師帳號派發與任課指派 */}
              <div className="space-y-6">
                <Card className="border-slate-300">
                  <CardHeader className="pb-3 border-b border-slate-200">
                    <CardTitle className="text-base flex items-center">
                      <UserPlus className="w-4 h-4 mr-2 text-blue-600" />
                      派發任課教師初始帳號
                    </CardTitle>
                    <CardDescription>
                      由學校主管直接指派教師初始帳號與密碼，無需額外 SMTP 信箱確認
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {teacherError && (
                      <div className="mb-4 p-2 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs font-medium flex items-center">
                        <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
                        {teacherError}
                      </div>
                    )}
                    <form onSubmit={handleCreateTeacher} className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="teacher-real-name">教師真實姓名</Label>
                        <Input
                          id="teacher-real-name"
                          name="name"
                          required
                          placeholder="例如：王小明 老師"
                          value={teacherName}
                          onChange={(e) => setTeacherName(e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="teacher-email">公務電子信箱</Label>
                          <Input
                            id="teacher-email"
                            name="email"
                            type="email"
                            required
                            placeholder="teacher@school.edu.tw"
                            value={teacherEmail}
                            onChange={(e) => setTeacherEmail(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="teacher-password">初始密碼</Label>
                          <Input
                            id="teacher-password"
                            name="password"
                            type="password"
                            required
                            placeholder="至少 6 個字元"
                            value={teacherPassword}
                            onChange={(e) => setTeacherPassword(e.target.value)}
                          />
                        </div>
                      </div>
                      <Button type="submit" variant="default" className="w-full" disabled={creatingTeacher}>
                        {creatingTeacher ? '派發中...' : '開通教師帳號'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {/* 班級任課與導師職務指派 */}
                <Card className="border-slate-300">
                  <CardHeader className="pb-3 border-b border-slate-200">
                    <CardTitle className="text-base flex items-center">
                      <UserCheck className="w-4 h-4 mr-2 text-indigo-600" />
                      班級任課與導師職務指派
                    </CardTitle>
                    <CardDescription>
                      設定教師為特定班級之「班級老師 (導師)」或「科任老師」
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <form onSubmit={handleAssignTeacher} className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">選擇班級</Label>
                          <Select value={assignClassId} onValueChange={setAssignClassId}>
                            <SelectTrigger className="h-8 text-xs">
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

                        <div className="space-y-1.5">
                          <Label className="text-xs">選擇教師</Label>
                          <Select value={assignTeacherId} onValueChange={setAssignTeacherId}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="選擇教師" />
                            </SelectTrigger>
                            <SelectContent>
                              {teachers.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs">擔任職務</Label>
                          <Select
                            value={assignRole}
                            onValueChange={(val) => setAssignRole(val as 'homeroom' | 'subject')}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="homeroom">班級老師 (導師)</SelectItem>
                              <SelectItem value="subject">科任老師</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button type="submit" variant="default" size="sm" className="w-full text-xs">
                        指派職務
                      </Button>
                    </form>

                    {/* 指派名錄清單 */}
                    <div className="border border-slate-200 rounded divide-y divide-slate-100 max-h-48 overflow-y-auto">
                      {classTeachers.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500">尚無班級教師指派</div>
                      ) : (
                        classTeachers.map((ct) => (
                          <div key={ct.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50">
                            <div>
                              <span className="font-bold text-slate-800">{ct.class?.name || '未知班級'}</span>
                              <span className="mx-2 text-slate-400">·</span>
                              <span className="text-slate-700">{ct.teacher?.name || '未知教師'}</span>
                              <Badge
                                variant={ct.role === 'homeroom' ? 'default' : 'secondary'}
                                className="ml-2 text-[10px]"
                              >
                                {ct.role === 'homeroom' ? '班級導師' : '科任老師'}
                              </Badge>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveClassTeacher(ct.id)}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* 分頁 2: 學生名冊管理 */}
          <TabsContent value="students" className="space-y-4">
            <Card className="border-slate-300">
              <CardHeader className="pb-3 border-b border-slate-200 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center">
                    <GraduationCap className="w-4 h-4 mr-2 text-purple-600" />
                    班級在籍學生名冊
                  </CardTitle>
                  <CardDescription>
                    管理學生基本學籍資料與家長聯絡手機 (供家長查核驗證)
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Select
                    value={selectedClassForStudents}
                    onValueChange={setSelectedClassForStudents}
                  >
                    <SelectTrigger className="w-48 h-8 text-xs">
                      <SelectValue placeholder="選擇檢視班級" />
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
                    variant="default"
                    size="sm"
                    onClick={() => {
                      setStudentForm({
                        student_number: '',
                        name: '',
                        seat_number: classStudents.length + 1,
                        gender: '未填',
                        parent_phone: '',
                      });
                      setStudentModalOpen(true);
                    }}
                    className="h-8 text-xs"
                    disabled={!selectedClassForStudents}
                  >
                    新增學生
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 border-b border-slate-200">
                      <TableHead className="w-16 text-xs font-bold text-slate-700">座號</TableHead>
                      <TableHead className="w-32 text-xs font-bold text-slate-700">學號</TableHead>
                      <TableHead className="w-32 text-xs font-bold text-slate-700">姓名</TableHead>
                      <TableHead className="w-24 text-xs font-bold text-slate-700">性別</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700">家長聯絡電話</TableHead>
                      <TableHead className="w-20 text-xs font-bold text-slate-700 text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-xs text-slate-500">
                          此班級尚無學生資料
                        </TableCell>
                      </TableRow>
                    ) : (
                      classStudents.map((st) => (
                        <TableRow key={st.id} className="border-b border-slate-200 hover:bg-slate-50">
                          <TableCell className="text-xs font-mono font-bold">{st.seat_number}</TableCell>
                          <TableCell className="text-xs font-mono">{st.student_number}</TableCell>
                          <TableCell className="text-xs font-medium text-slate-900">{st.name}</TableCell>
                          <TableCell className="text-xs text-slate-600">{st.gender || '-'}</TableCell>
                          <TableCell className="text-xs font-mono text-slate-600">{st.parent_phone}</TableCell>
                          <TableCell className="text-xs text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteStudent(st.id)}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 分頁 3: 全校考勤狀況 */}
          <TabsContent value="attendance_history">
            <Card className="border-slate-300">
              <CardHeader className="pb-3 border-b border-slate-200">
                <CardTitle className="text-base flex items-center">
                  <History className="w-4 h-4 mr-2 text-slate-700" />
                  全校考勤狀況總覽
                </CardTitle>
                <CardDescription>
                  檢視全校各班歷史點名紀錄與人工覆寫狀態
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                {schoolId && <AttendanceHistoryView schoolId={schoolId} isEditable={true} />}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 新增學生 Modal */}
        <Dialog open={studentModalOpen} onOpenChange={setStudentModalOpen}>
          <DialogContent className="max-w-md p-6 bg-white border border-slate-300">
            <DialogHeader className="border-b border-slate-200 pb-3">
              <DialogTitle className="text-base font-bold text-slate-800">
                新增在籍學生
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateStudent} className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">座號</Label>
                  <Input
                    type="number"
                    required
                    min={1}
                    value={studentForm.seat_number}
                    onChange={(e) =>
                      setStudentForm((prev) => ({ ...prev, seat_number: parseInt(e.target.value) || 1 }))
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">學號</Label>
                  <Input
                    required
                    placeholder="S113001"
                    value={studentForm.student_number}
                    onChange={(e) =>
                      setStudentForm((prev) => ({ ...prev, student_number: e.target.value }))
                    }
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">學生姓名</Label>
                  <Input
                    required
                    placeholder="林小明"
                    value={studentForm.name}
                    onChange={(e) =>
                      setStudentForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">性別</Label>
                  <Select
                    value={studentForm.gender}
                    onValueChange={(val) => setStudentForm((prev) => ({ ...prev, gender: val }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
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

              <div className="space-y-1">
                <Label className="text-xs">家長聯絡手機 (末4碼供查榜驗證)</Label>
                <Input
                  required
                  placeholder="0912345678"
                  value={studentForm.parent_phone}
                  onChange={(e) =>
                    setStudentForm((prev) => ({ ...prev, parent_phone: e.target.value }))
                  }
                  className="h-8 text-xs font-mono"
                />
              </div>

              <DialogFooter className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStudentModalOpen(false)}
                  className="text-xs"
                >
                  取消
                </Button>
                <Button type="submit" variant="default" size="sm" className="text-xs">
                  確認建立
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* 學校主管教室劃位彈窗 */}
        {activeModalClass && (
          <SeatMapEditorModal
            open={seatingEditorOpen}
            onOpenChange={setSeatingEditorOpen}
            classId={activeModalClass.id}
            className={activeModalClass.name}
            students={classStudents}
          />
        )}
      </main>
    </div>
  );
}
