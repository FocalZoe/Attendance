import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Navbar } from '@/components/ui/navbar';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClassAction, createTeacherAccountAction } from '@/app/actions/school-admin';
import { School, Users, BookOpen, PlusCircle, GraduationCap } from 'lucide-react';
import type { SchoolClass, Profile } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function SchoolAdminDashboard() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect('/login');
  }

  if (profile.role !== 'school_admin' && profile.role !== 'sys_admin') {
    redirect('/dashboard');
  }

  const supabase = await createClient();

  // 若使用者為學校主管但無 school_id，引導綁定或提示
  const schoolId = profile.school_id;

  // 取得該校資料
  let schoolName = '未綁定學校';
  let schoolCode = 'N/A';
  if (schoolId) {
    const { data: schoolData } = await supabase
      .from('schools')
      .select('name, code')
      .eq('id', schoolId)
      .single();
    if (schoolData) {
      schoolName = schoolData.name;
      schoolCode = schoolData.code;
    }
  }

  // 取得該校班級清單
  const { data: classesData } = schoolId
    ? await supabase
        .from('classes')
        .select('*')
        .eq('school_id', schoolId)
        .order('academic_year', { ascending: false })
    : { data: [] };

  const classes: SchoolClass[] = classesData || [];

  // 取得該校教師清單
  const { data: teachersData } = schoolId
    ? await supabase
        .from('profiles')
        .select('*')
        .eq('school_id', schoolId)
        .eq('role', 'teacher')
        .order('name', { ascending: true })
    : { data: [] };

  const teachers: Profile[] = teachersData || [];

  // 取得該校學生總數
  const { count: studentCount } = schoolId
    ? await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId)
    : { count: 0 };

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
              <span className="text-slate-900 font-bold">{schoolName}</span>
              <span className="ml-2 font-mono text-xs bg-slate-100 border border-slate-300 px-2 py-0.5 rounded text-slate-700">
                {schoolCode}
              </span>
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <Badge variant="success">校務專屬租戶</Badge>
          </div>
        </div>

        {/* 核心指標卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <Card className="border-slate-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 tracking-wider">任教導師數</p>
                <p className="text-3xl font-black text-slate-900 mt-1">{teachers.length}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
                <Users className="w-6 h-6" />
              </div>
            </div>
          </Card>

          <Card className="border-slate-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 tracking-wider">班級數量</p>
                <p className="text-3xl font-black text-slate-900 mt-1">{classes.length}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <BookOpen className="w-6 h-6" />
              </div>
            </div>
          </Card>

          <Card className="border-slate-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 tracking-wider">學生在籍人數</p>
                <p className="text-3xl font-black text-slate-900 mt-1">{studentCount || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
                <GraduationCap className="w-6 h-6" />
              </div>
            </div>
          </Card>
        </div>

        {/* 雙區塊：班級管理 & 教師帳號派發 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 班級管理區塊 */}
          <div className="space-y-4">
            <Card className="border-slate-300">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle className="text-lg">班級列表</CardTitle>
                  <CardDescription>管理校內各學期與各年級之班級實體</CardDescription>
                </div>
                <Badge variant="outline">{classes.length} 個班級</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                {classes.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center border border-dashed border-slate-200 rounded">
                    目前尚未建立班級，請使用下方表單新增
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600">
                        <tr>
                          <th className="py-2.5 px-3">班級名稱</th>
                          <th className="py-2.5 px-3">年級</th>
                          <th className="py-2.5 px-3">學年度</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                        {classes.map((cls) => (
                          <tr key={cls.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-bold text-slate-900">{cls.name}</td>
                            <td className="py-2.5 px-3 text-xs">{cls.grade}</td>
                            <td className="py-2.5 px-3 text-xs text-slate-500">{cls.academic_year}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 新增班級表單 */}
                <div className="pt-4 border-t border-slate-200">
                  <h4 className="text-xs font-bold text-slate-700 mb-3 flex items-center">
                    <PlusCircle className="w-4 h-4 mr-1.5 text-blue-600" />
                    新增班級
                  </h4>
                  <form action={createClassAction} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input type="hidden" name="school_id" value={schoolId || ''} />
                    <Input name="name" required placeholder="班級名稱 (如: 資訊科一甲)" />
                    <Input name="grade" required placeholder="年級 (如: 高一)" />
                    <Input name="academic_year" required placeholder="學年度 (如: 113)" />
                    <div className="sm:col-span-3">
                      <Button type="submit" variant="primary" size="sm" className="w-full mt-1">
                        建立班級
                      </Button>
                    </div>
                  </form>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 教師管理與派發區塊 */}
          <div className="space-y-4">
            <Card className="border-slate-300">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle className="text-lg">任教導師名冊</CardTitle>
                  <CardDescription>指派教師並開通點名權限</CardDescription>
                </div>
                <Badge variant="outline">{teachers.length} 位教師</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                {teachers.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center border border-dashed border-slate-200 rounded">
                    目前尚未建立教師帳號，請使用下方表單指派
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600">
                        <tr>
                          <th className="py-2.5 px-3">教師姓名</th>
                          <th className="py-2.5 px-3">公務信箱</th>
                          <th className="py-2.5 px-3 text-right">身分</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                        {teachers.map((t) => (
                          <tr key={t.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-bold text-slate-900">{t.name}</td>
                            <td className="py-2.5 px-3 text-xs text-slate-600">{t.email}</td>
                            <td className="py-2.5 px-3 text-right">
                              <Badge variant="info">專任教師</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 派發教師帳號表單 */}
                <div className="pt-4 border-t border-slate-200">
                  <h4 className="text-xs font-bold text-slate-700 mb-3 flex items-center">
                    <PlusCircle className="w-4 h-4 mr-1.5 text-emerald-600" />
                    開通新教師帳號（直接派發初始憑證）
                  </h4>
                  <form action={createTeacherAccountAction} className="space-y-2.5">
                    <input type="hidden" name="school_id" value={schoolId || ''} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input name="name" required placeholder="教師姓名 (如: 陳志強)" />
                      <Input name="email" type="email" required placeholder="教師 Email" />
                    </div>
                    <Input
                      name="password"
                      type="password"
                      required
                      placeholder="初始預設密碼 (登入後可修改)"
                    />
                    <Button type="submit" variant="success" size="sm" className="w-full mt-1">
                      開通教師帳號
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
