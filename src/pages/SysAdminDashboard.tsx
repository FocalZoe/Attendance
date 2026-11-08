import * as React from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { Navbar } from '@/components/ui/navbar';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
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
import { Trash2 } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DangerConfirmDialog } from '@/components/ui/danger-confirm-dialog';
import { AccountsPanel } from '@/components/sys-admin/accounts-panel';
import { DataPanel } from '@/components/sys-admin/data-panel';
import { deleteSchoolEverything } from '@/lib/hard-delete';
import { toastError } from '@/lib/errors';
import { friendlyError } from '@/lib/errors';

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
  const [deleteTarget, setDeleteTarget] = React.useState<SchoolType | null>(null);
  const [deleteAccounts, setDeleteAccounts] = React.useState(true);
  const [impact, setImpact] = React.useState<{ classes: number; students: number; accounts: number } | null>(null);

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
          error.code === '23505' ? '這個學校代碼已經被使用。請換一個代碼。' : friendlyError(error, '建立學校失敗。請稍後再試。').message
        );
      } else {
        setSchoolName('');
        setSchoolCode('');
        toast.success('已建立學校');
        await loadData();
      }
    } catch (err: unknown) {
      const msg = friendlyError(err, '建立學校失敗。請稍後再試。').message;
      setErrorMsg(msg);
    } finally {
      setCreatingSchool(false);
    }
  };

  // Count what a school delete would remove so the dialog can say it plainly
  React.useEffect(() => {
    if (!deleteTarget) {
      setImpact(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const [c, st, a] = await Promise.all([
        supabase.from('classes').select('*', { count: 'exact', head: true }).eq('school_id', deleteTarget.id),
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', deleteTarget.id),
        supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', deleteTarget.id)
          .neq('role', 'sys_admin'),
      ]);
      if (!cancelled) setImpact({ classes: c.count ?? 0, students: st.count ?? 0, accounts: a.count ?? 0 });
    })();
    return () => {
      cancelled = true;
    };
  }, [deleteTarget]);

  const handleDeleteSchool = async () => {
    if (!deleteTarget) return;
    try {
      const result = await deleteSchoolEverything(deleteTarget.id, { deleteAccounts });
      toast.success(
        `已永久刪除「${deleteTarget.name}」：${result.classes} 個班級、${result.students} 位學生、${result.snapshots} 張照片`
      );
      await loadData();
    } catch (err) {
      toastError(err, '刪除學校失敗。請稍後再試。');
      throw err;
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

        <Tabs defaultValue="schools">
          <TabsList>
            <TabsTrigger value="schools">學校組織</TabsTrigger>
            <TabsTrigger value="accounts">帳號</TabsTrigger>
            <TabsTrigger value="data">班級與學生</TabsTrigger>
          </TabsList>

          <TabsContent value="schools" className="mt-6">
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
                {creatingSchool && <Spinner />}
                建立學校
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
                          <div className="flex shrink-0 items-center gap-1">
                            <SchoolAdminModal
                              school={{ id: s.id, name: s.name, code: s.code }}
                              admins={schoolAdmins}
                              onRefresh={loadData}
                            />
                            <IconButton label={`永久刪除 ${s.name}`} onClick={() => setDeleteTarget(s)} className="text-absent hover:text-absent">
                              <Trash2 aria-hidden="true" />
                            </IconButton>
                          </div>
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
                              <div className="flex items-center justify-end gap-1">
                                <SchoolAdminModal
                                  school={{ id: s.id, name: s.name, code: s.code }}
                                  admins={schoolAdmins}
                                  onRefresh={loadData}
                                />
                                <IconButton label={`永久刪除 ${s.name}`} onClick={() => setDeleteTarget(s)} className="text-absent hover:text-absent">
                                  <Trash2 aria-hidden="true" />
                                </IconButton>
                              </div>
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
          </TabsContent>

          <TabsContent value="accounts" className="mt-6">
            <AccountsPanel />
          </TabsContent>

          <TabsContent value="data" className="mt-6">
            <DataPanel schools={schools} onChanged={loadData} />
          </TabsContent>
        </Tabs>

        <DangerConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(o) => !o && setDeleteTarget(null)}
          title={`永久刪除學校「${deleteTarget?.name ?? ''}」？`}
          confirmText={deleteTarget?.name ?? ''}
          consequences={[
            impact ? `${impact.classes} 個班級、${impact.students} 位學生` : '正在計算要刪除的內容…',
            '所有座位表、點名紀錄和課表',
            '所有點名時拍的照片',
            ...(deleteAccounts ? [impact ? `這間學校的 ${impact.accounts} 個教師與主管帳號` : '這間學校的教師與主管帳號'] : []),
          ]}
          onConfirm={handleDeleteSchool}
        >
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={deleteAccounts}
              onChange={(e) => setDeleteAccounts(e.target.checked)}
              className="mt-1 h-4 w-4 accent-[var(--primary)]"
            />
            <span>同時刪除這間學校的所有教師與主管帳號（不勾選的話，帳號會保留但不屬於任何學校）</span>
          </label>
        </DangerConfirmDialog>
      </main>
    </div>
  );
}
