import * as React from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { Navbar } from '@/components/ui/navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InlineAlert } from '@/components/ui/inline-alert';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { SchoolAdminModal, type SchoolAdminInfo } from '@/components/sys-admin/school-admin-modal';
import type { School as SchoolType } from '@/types/database';
import { toast } from 'sonner';

type AdminRow = SchoolAdminInfo & { school_id: string | null };

function adminSummary(admins: AdminRow[]): string {
  const active = admins.filter((a) => a.is_active !== false);
  return active.length === 0 ? '' : active.map((a) => a.name).join('、');
}

export function SysAdminDashboard() {
  const { profile } = useAuthStore();
  const [schools, setSchools] = React.useState<SchoolType[]>([]);
  const [allAdmins, setAllAdmins] = React.useState<AdminRow[]>([]);
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
        supabase.from('profiles').select('id, name, email, phone, school_id, is_active, created_at').eq('role', 'school_admin'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('classes').select('*', { count: 'exact', head: true }),
      ]);

      if (schoolsRes.data) {
        setSchools(schoolsRes.data);
      }
      if (adminsRes.data) {
        setAllAdmins(adminsRes.data as AdminRow[]);
      }
      setTotalUsers(usersCountRes.count || 0);
      setTotalClasses(classesCountRes.count || 0);
    } catch (err) {
      console.error('載入系統總管數據失敗:', err);
      toast.error('無法載入平台資料。請重新整理頁面再試一次。');
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
        setErrorMsg(
          error.code === '23505' ? '這個學校代碼已經被使用。請換一個代碼。' : error.message
        );
      } else {
        setSchoolName('');
        setSchoolCode('');
        toast.success('已建立學校');
        await loadData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '建立學校失敗。請稍後再試。';
      setErrorMsg(msg);
    } finally {
      setCreatingSchool(false);
    }
  };

  const stats = [
    { label: '學校', value: schools.length },
    { label: '帳號', value: totalUsers },
    { label: '班級', value: totalClasses },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar profile={profile} />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <section className="flex flex-col gap-6 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">學校組織</h1>
            <p className="mt-1 text-sm text-muted-foreground">開通學校、指派學校主管，查看平台整體狀況。</p>
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

        <div className="grid gap-10 lg:grid-cols-[20rem_1fr]">
          {/* 新增學校 */}
          <section className="space-y-4">
            <h2 className="font-display text-lg font-bold text-foreground">新增學校</h2>
            <p className="text-sm text-muted-foreground">
              學校代碼是學校的唯一識別，建立後主管註冊時會用到。
            </p>
            {errorMsg && <InlineAlert>{errorMsg}</InlineAlert>}
            <form onSubmit={handleCreateSchool} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sys-school-name">學校全名</Label>
                <Input
                  id="sys-school-name"
                  required
                  placeholder="例如：示範科技大學"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sys-school-code">學校代碼</Label>
                <Input
                  id="sys-school-code"
                  required
                  placeholder="例如：DEMO-TECH"
                  value={schoolCode}
                  onChange={(e) => setSchoolCode(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={creatingSchool}>
                {creatingSchool ? '建立中' : '建立學校'}
              </Button>
            </form>
          </section>

          {/* 學校列表 */}
          <section className="space-y-4">
            <h2 className="font-display text-lg font-bold text-foreground">所有學校（{schools.length}）</h2>

            {loading ? (
              <ListSkeleton rows={4} />
            ) : schools.length === 0 ? (
              <EmptyState title="還沒有學校" description="先在左側建立第一所學校。" />
            ) : (
              <>
                {/* 手機：列表 */}
                <ul className="divide-y divide-border border-y border-border md:hidden">
                  {schools.map((s) => {
                    const schoolAdmins = allAdmins.filter((a) => a.school_id === s.id);
                    const summary = adminSummary(schoolAdmins);
                    return (
                      <li key={s.id} className="space-y-2 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">{s.name}</p>
                            <p className="tabular text-sm text-muted-foreground">{s.code}</p>
                          </div>
                          <SchoolAdminModal
                            school={{ id: s.id, name: s.name, code: s.code }}
                            admins={schoolAdmins}
                            onRefresh={loadData}
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          主管：{summary || <span className="font-medium text-late">還沒有主管</span>}
                        </p>
                      </li>
                    );
                  })}
                </ul>

                {/* 桌機：表格 */}
                <div className="hidden overflow-hidden rounded-lg border border-border md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>學校</TableHead>
                        <TableHead>代碼</TableHead>
                        <TableHead>主管</TableHead>
                        <TableHead>開通日</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schools.map((s) => {
                        const schoolAdmins = allAdmins.filter((a) => a.school_id === s.id);
                        const summary = adminSummary(schoolAdmins);
                        return (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium text-foreground">{s.name}</TableCell>
                            <TableCell className="tabular text-muted-foreground">{s.code}</TableCell>
                            <TableCell>
                              {summary || <span className="font-medium text-late">還沒有主管</span>}
                            </TableCell>
                            <TableCell className="tabular text-muted-foreground">
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
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
