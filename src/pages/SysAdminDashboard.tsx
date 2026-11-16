import * as React from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { Outlet, useLocation } from 'react-router-dom';
import { AppShell, type NavItem } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PageTransition } from '@/components/motion/page-transition';
import { CountUp } from '@/components/motion/count-up';
import { Building2, GraduationCap, Users } from 'lucide-react';
import { type AdminRow, type SysAdminContext } from '@/pages/sys-admin/context';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InlineAlert } from '@/components/ui/inline-alert';
import type { School as SchoolType } from '@/types/database';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DangerConfirmDialog } from '@/components/ui/danger-confirm-dialog';
import { deleteSchoolEverything, PHOTO_LEFTOVER_WARNING } from '@/lib/hard-delete';
import { toastError } from '@/lib/errors';
import { friendlyError } from '@/lib/errors';

const SYS_ADMIN_NAV: NavItem[] = [
  { to: '/dashboard/sys-admin', label: '學校組織', icon: Building2, end: true },
  { to: '/dashboard/sys-admin/accounts', label: '帳號', icon: Users },
  { to: '/dashboard/sys-admin/data', label: '班級與學生', icon: GraduationCap },
];

// Longest suffix first so "/accounts" is not matched by the index page
const PAGE_INFO = [
  { suffix: '/accounts', title: '帳號', description: '依學校查看帳號，需要時可以永久刪除。' },
  { suffix: '/data', title: '班級與學生', description: '先選學校，再處理班級、學生與點名紀錄。' },
  { suffix: '/sys-admin', title: '學校組織', description: '開通學校、指派學校主管，查看平台整體狀況。' },
];

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
  const [schoolDialogOpen, setSchoolDialogOpen] = React.useState(false);
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
        setSchoolDialogOpen(false);
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
      if (result.photosFailed) {
        toast.warning(PHOTO_LEFTOVER_WARNING);
      }
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

  const location = useLocation();
  const pageInfo =
    PAGE_INFO.find((p) => location.pathname.endsWith(p.suffix)) ?? PAGE_INFO[0];
  const outletContext: SysAdminContext = {
    schools,
    allAdmins,
    loading,
    reload: loadData,
    setSchoolDialogOpen,
    setDeleteTarget,
  };

  return (
    <AppShell profile={profile} navItems={SYS_ADMIN_NAV}>
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <title>{`${pageInfo.title}｜班級自動化點名系統`}</title>
        <PageHeader
          className="gap-6 border-b border-border pb-6"
          title={pageInfo.title}
          description={pageInfo.description}
          actions={
            <dl className="grid grid-cols-3 divide-x divide-border">
              {stats.map((item) => (
                <div key={item.label} className="px-4 first:pl-0 sm:px-6">
                  <dd className="tabular font-display text-3xl font-bold text-foreground"><CountUp value={item.value} /></dd>
                  <dt className="text-sm text-muted-foreground">{item.label}</dt>
                </div>
              ))}
            </dl>
          }
        />

        <PageTransition key={location.pathname}>
          <Outlet context={outletContext} />
        </PageTransition>

        <DangerConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(o) => !o && setDeleteTarget(null)}
          title={`永久刪除學校「${deleteTarget?.name ?? ''}」？`}
          confirmText={deleteTarget?.name ?? ''}
          consequences={[
            impact ? `${impact.classes} 個班級、${impact.students} 位學生` : '正在計算要刪除的內容…',
            '所有座位表、點名紀錄和點名時間',
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
        <Dialog open={schoolDialogOpen} onOpenChange={setSchoolDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>新增學校</DialogTitle>
            </DialogHeader>
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
                    </DialogContent>
        </Dialog>

      </main>
    </AppShell>
  );
}
