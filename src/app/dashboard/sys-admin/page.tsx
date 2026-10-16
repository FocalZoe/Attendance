import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Navbar } from '@/components/ui/navbar';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createSchoolAction } from '@/app/actions/schools';
import { School, Shield, PlusCircle, Building, Users } from 'lucide-react';
import type { School as SchoolType } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function SysAdminDashboard() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect('/login');
  }

  if (profile.role !== 'sys_admin') {
    redirect('/dashboard');
  }

  const supabase = await createClient();

  // 取得所有學校列表
  const { data: schoolsData } = await supabase
    .from('schools')
    .select('*')
    .order('created_at', { ascending: false });

  const schools: SchoolType[] = schoolsData || [];

  // 取得系統概況統計
  const { count: totalUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  const { count: totalClasses } = await supabase
    .from('classes')
    .select('*', { count: 'exact', head: true });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar profile={profile} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* 頁面標題列 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center space-x-2">
              <Shield className="w-6 h-6 text-slate-800" />
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                系統總管理員控制台
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              平台全域管理 · 多校租戶監控與學校組織授權
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex items-center space-x-2">
            <Badge variant="default" className="bg-slate-900 text-white">
              平台超級權限 (Super Admin)
            </Badge>
          </div>
        </div>

        {/* 統計指標卡片 (Flat Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <Card className="border-slate-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 tracking-wider">
                  已開通學校數
                </p>
                <p className="text-3xl font-black text-slate-900 mt-1">
                  {schools.length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                <School className="w-6 h-6" />
              </div>
            </div>
          </Card>

          <Card className="border-slate-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 tracking-wider">
                  已註冊使用者數
                </p>
                <p className="text-3xl font-black text-slate-900 mt-1">
                  {totalUsers || 0}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <Users className="w-6 h-6" />
              </div>
            </div>
          </Card>

          <Card className="border-slate-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 tracking-wider">
                  全平台開班總數
                </p>
                <p className="text-3xl font-black text-slate-900 mt-1">
                  {totalClasses || 0}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <Building className="w-6 h-6" />
              </div>
            </div>
          </Card>
        </div>

        {/* 學校清單與新增學校 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 左側：學校清單 */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="border-slate-300">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle>已註冊學校清單</CardTitle>
                  <CardDescription>各校擁有獨立的資料庫隔離範疇與管理員</CardDescription>
                </div>
                <Badge variant="outline">{schools.length} 所學校</Badge>
              </CardHeader>
              <CardContent>
                {schools.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
                    <School className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700">尚未建立任何學校</p>
                    <p className="text-xs text-slate-400 mt-1">
                      請在右側表單新增第一所學校以啟動校務組織
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600">
                        <tr>
                          <th className="py-3 px-4">學校名稱</th>
                          <th className="py-3 px-4">學校代碼</th>
                          <th className="py-3 px-4">建立時間</th>
                          <th className="py-3 px-4 text-right">狀態</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                        {schools.map((school) => (
                          <tr key={school.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-4 font-bold text-slate-900">
                              {school.name}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-mono text-xs bg-slate-100 border border-slate-300 px-2 py-0.5 rounded text-slate-700">
                                {school.code}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-500">
                              {new Date(school.created_at).toLocaleDateString('zh-TW')}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Badge variant="success">已啟用</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 右側：新增學校表單 */}
          <div>
            <Card className="border-slate-300 sticky top-24">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <PlusCircle className="w-5 h-5 text-blue-600" />
                  <CardTitle className="text-base">新增學校組織</CardTitle>
                </div>
                <CardDescription>
                  建立後系統將生成唯一的學校代碼，以供校長或主管綁定
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={createSchoolAction} className="space-y-4">
                  <Input
                    label="學校名稱"
                    name="name"
                    required
                    placeholder="例如：國立示範高級中學"
                  />
                  <Input
                    label="學校代碼 (Unique Code)"
                    name="code"
                    required
                    placeholder="例如：DEMO-HS"
                  />
                  <Button type="submit" variant="primary" className="w-full">
                    確認新增學校
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
