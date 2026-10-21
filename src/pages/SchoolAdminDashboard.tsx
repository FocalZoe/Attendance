import * as React from 'react';
import { supabase, createIsolatedClient } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { Navbar } from '@/components/ui/navbar';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { School, Users, BookOpen, PlusCircle, GraduationCap, AlertCircle, Mail, UserPlus } from 'lucide-react';
import type { SchoolClass, Profile } from '@/types/database';

export function SchoolAdminDashboard() {
  const { profile } = useAuthStore();
  const schoolId = profile?.school_id;

  const [schoolName, setSchoolName] = React.useState('載入中...');
  const [schoolCode, setSchoolCode] = React.useState('');
  const [classes, setClasses] = React.useState<SchoolClass[]>([]);
  const [teachers, setTeachers] = React.useState<Profile[]>([]);
  const [studentCount, setStudentCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

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
  }, [schoolId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

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
            role: 'teacher',
            school_id: schoolId,
          },
        },
      });

      if (error) {
        setTeacherError(error.message);
      } else {
        // 同步寫入 profiles（若觸發器未及時執行）
        if (data.user) {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            school_id: schoolId,
            role: 'teacher',
            name: teacherName.trim(),
            email: teacherEmail.trim(),
          });
        }
        setTeacherName('');
        setTeacherEmail('');
        setTeacherPassword('');
        await loadData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '建立教師帳號失敗';
      setTeacherError(msg);
    } finally {
      setCreatingTeacher(false);
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

        {/* 核心校務管理：班級與教師 */}
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
                    <Input
                      label="學年度"
                      name="academic_year"
                      required
                      placeholder="例如：113"
                      value={academicYear}
                      onChange={(e) => setAcademicYear(e.target.value)}
                    />
                    <Input
                      label="年級"
                      name="grade"
                      required
                      placeholder="例如：高一 或 七年級"
                      value={classGrade}
                      onChange={(e) => setClassGrade(e.target.value)}
                    />
                  </div>
                  <Input
                    label="班級名稱"
                    name="name"
                    required
                    placeholder="例如：資訊一甲"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                  />
                  <Button type="submit" variant="primary" className="w-full" disabled={creatingClass}>
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
                        <Badge variant="outline">已啟用</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 右側：教師帳號派發與名單 */}
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
                  <Input
                    label="教師真實姓名"
                    name="name"
                    required
                    placeholder="例如：王小明 老師"
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="公務電子信箱"
                      name="email"
                      type="email"
                      required
                      placeholder="teacher@school.edu.tw"
                      value={teacherEmail}
                      onChange={(e) => setTeacherEmail(e.target.value)}
                    />
                    <Input
                      label="初始密碼"
                      name="password"
                      type="password"
                      required
                      placeholder="至少 6 個字元"
                      value={teacherPassword}
                      onChange={(e) => setTeacherPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" variant="primary" className="w-full" disabled={creatingTeacher}>
                    {creatingTeacher ? '派發中...' : '開通教師帳號'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-slate-300">
              <CardHeader className="pb-3 border-b border-slate-200">
                <CardTitle className="text-base">校內任課教師名冊 ({teachers.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-6 text-center text-slate-500 text-xs">載入中...</div>
                ) : teachers.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-xs">
                    目前尚未指派任何任課教師。
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                    {teachers.map((t) => (
                      <div key={t.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                        <div>
                          <div className="font-bold text-sm text-slate-900">{t.name}</div>
                          <div className="text-xs text-slate-500 flex items-center mt-0.5">
                            <Mail className="w-3 h-3 mr-1 text-slate-400" />
                            {t.email}
                          </div>
                        </div>
                        <Badge variant="info">專任教師</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
