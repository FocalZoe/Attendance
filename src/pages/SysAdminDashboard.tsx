import * as React from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { Navbar } from '@/components/ui/navbar';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { SchoolAdminModal } from '@/components/sys-admin/school-admin-modal';
import { School, Shield, PlusCircle, Building, Users } from 'lucide-react';
import type { School as SchoolType } from '@/types/database';

export function SysAdminDashboard() {
  const { profile } = useAuthStore();
  const [schools, setSchools] = React.useState<SchoolType[]>([]);
  const [allAdmins, setAllAdmins] = React.useState<{ id: string; name: string; email: string; phone: string | null; school_id: string | null; created_at: string }[]>([]);
  const [totalUsers, setTotalUsers] = React.useState(0);
  const [totalClasses, setTotalClasses] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [creatingSchool, setCreatingSchool] = React.useState(false);
  const [schoolName, setSchoolName] = React.useState('');
  const [schoolCode, setSchoolCode] = React.useState('');
  const [errorMsg, setErrorMsg] = React.useState('');

  const loadData = React.useCallback(async () => {
    try {
      const [schoolsRes, adminsRes, usersCountRes, classesCountRes] = await Promise.all([
        supabase.from('schools').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, name, email, phone, school_id, created_at').eq('role', 'school_admin'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('classes').select('*', { count: 'exact', head: true }),
      ]);

      if (schoolsRes.data) {
        setSchools(schoolsRes.data);
      }
      if (adminsRes.data) {
        setAllAdmins(adminsRes.data);
      }
      setTotalUsers(usersCountRes.count || 0);
      setTotalClasses(classesCountRes.count || 0);
    } catch (err) {
      console.error('載入系統總管數據失敗:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolName || !schoolCode) return;

    setCreatingSchool(true);
    setErrorMsg('');

    try {
      const { error } = await supabase.from('schools').insert({
        name: schoolName.trim(),
        code: schoolCode.trim().toUpperCase(),
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setSchoolName('');
        setSchoolCode('');
        await loadData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '建立學校發生錯誤';
      setErrorMsg(msg);
    } finally {
      setCreatingSchool(false);
    }
  };

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
              平台全域管理 · 多校租戶監控、學校機構開通與主管名冊授權維護
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
                  全平台註冊教職數
                </p>
                <p className="text-3xl font-black text-slate-900 mt-1">
                  {totalUsers}
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
                  全平台班級總數
                </p>
                <p className="text-3xl font-black text-slate-900 mt-1">
                  {totalClasses}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <Building className="w-6 h-6" />
              </div>
            </div>
          </Card>
        </div>

        {/* 學校機構管理區塊 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 左側：快速新增學校機構 (Flat Card) */}
          <div className="lg:col-span-1">
            <Card className="border-slate-300">
              <CardHeader className="pb-3 border-b border-slate-200">
                <CardTitle className="text-base flex items-center">
                  <PlusCircle className="w-4 h-4 mr-2 text-blue-600" />
                  建立新學校機構
                </CardTitle>
                <CardDescription>
                  為新合作之大專院校或高級中學配置專屬多租戶代碼
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                {errorMsg && (
                  <div className="mb-4 p-2 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs font-medium">
                    {errorMsg}
                  </div>
                )}
                <form onSubmit={handleCreateSchool} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="sys-school-name">學校全名</Label>
                    <Input
                      id="sys-school-name"
                      name="name"
                      required
                      placeholder="例如：國立示範科技大學"
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sys-school-code">學校代碼 (大寫英文/數字)</Label>
                    <Input
                      id="sys-school-code"
                      name="code"
                      required
                      placeholder="例如：DEMO-TECH"
                      value={schoolCode}
                      onChange={(e) => setSchoolCode(e.target.value)}
                    />
                  </div>
                  <Button type="submit" variant="default" className="w-full" disabled={creatingSchool}>
                    <PlusCircle className="w-4 h-4 mr-1.5" />
                    {creatingSchool ? '建立中...' : '確認開通學校'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* 右側：學校清單列表 */}
          <div className="lg:col-span-2">
            <Card className="border-slate-300">
              <CardHeader className="pb-3 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">全域學校租戶列表</CardTitle>
                    <CardDescription>
                      檢視已註冊之各校代碼、加入日期及指派管理主管名冊
                    </CardDescription>
                  </div>
                  <Badge variant="outline">{schools.length} 所學校</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-8 text-center text-slate-500 text-sm">
                    載入學校清單中...
                  </div>
                ) : schools.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-sm">
                    目前尚未建立任何學校單位。請由左側表單新增第一所學校。
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>學校全稱</TableHead>
                        <TableHead>專屬代碼</TableHead>
                        <TableHead>管理團隊 (主管數)</TableHead>
                        <TableHead>開通時間</TableHead>
                        <TableHead className="text-right">管理操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schools.map((s) => {
                        const schoolAdmins = allAdmins.filter((a) => a.school_id === s.id);
                        return (
                          <TableRow key={s.id}>
                            <TableCell className="font-bold text-slate-900">
                              {s.name}
                            </TableCell>
                            <TableCell className="font-mono text-slate-600">
                              <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-bold">
                                {s.code}
                              </span>
                            </TableCell>
                            <TableCell>
                              {schoolAdmins.length === 0 ? (
                                <span className="text-amber-600 font-medium">尚未配置</span>
                              ) : (
                                <div className="flex items-center space-x-1.5">
                                  <span className="font-semibold text-slate-800">
                                    {schoolAdmins.map((a) => a.name).join(', ')}
                                  </span>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-slate-500 font-mono">
                              {new Date(s.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <SchoolAdminModal
                                school={{ id: s.id, name: s.name, code: s.code }}
                                admins={schoolAdmins}
                                onRefresh={loadData}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
