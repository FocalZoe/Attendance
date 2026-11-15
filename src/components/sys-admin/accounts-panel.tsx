import * as React from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { deleteAccount } from '@/lib/hard-delete';
import { toastError } from '@/lib/errors';
import { Badge } from '@/components/ui/badge';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DangerConfirmDialog } from '@/components/ui/danger-confirm-dialog';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { School, UserRole } from '@/types/database';

// shortcut: loads up to this many accounts at once and groups them in the browser; add paging if a platform grows past it
const MAX_ACCOUNTS = 1000;

interface AccountRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  school_id: string | null;
  school: { name: string } | null;
}

/** Escape characters that have special meaning inside a PostgREST `or()` filter / ilike pattern */
function sanitizeSearch(input: string): string {
  return input.replace(/[,()%*\\]/g, ' ').trim();
}

const NO_SCHOOL = 'none';

export function AccountsPanel({ schools }: { schools: School[] }) {
  const { profile } = useAuthStore();
  const [rows, setRows] = React.useState<AccountRow[]>([]);
  const [search, setSearch] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [schoolFilter, setSchoolFilter] = React.useState('all');
  const [loading, setLoading] = React.useState(true);
  const [target, setTarget] = React.useState<AccountRow | null>(null);

  // Debounce typing so every keystroke does not hit the database
  React.useEffect(() => {
    const timer = window.setTimeout(() => setQuery(sanitizeSearch(search)), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = React.useCallback(async () => {
    setLoading(true);
    // The platform admin account itself is never listed
    let q = supabase
      .from('profiles')
      .select('id, name, email, role, is_active, school_id, school:schools(name)')
      .neq('role', 'sys_admin')
      .order('name', { ascending: true })
      .limit(MAX_ACCOUNTS);

    if (schoolFilter === NO_SCHOOL) q = q.is('school_id', null);
    else if (schoolFilter !== 'all') q = q.eq('school_id', schoolFilter);
    if (query) q = q.or(`name.ilike.%${query}%,email.ilike.%${query}%`);

    const { data, error } = await q;
    if (error) toastError(error, '讀取帳號失敗。請重新整理頁面。');
    else setRows((data ?? []) as unknown as AccountRow[]);
    setLoading(false);
  }, [query, schoolFilter]);

  React.useEffect(() => {
    load();
  }, [load]);

  // Group by school; school admins first inside each group
  const groups = React.useMemo(() => {
    const map = new Map<string, { name: string; items: AccountRow[] }>();
    for (const r of rows) {
      const key = r.school_id ?? NO_SCHOOL;
      const group = map.get(key) ?? { name: r.school?.name ?? '尚未加入學校', items: [] };
      group.items.push(r);
      map.set(key, group);
    }
    for (const g of map.values()) {
      g.items.sort((a, b) => Number(b.role === 'school_admin') - Number(a.role === 'school_admin'));
    }
    return [...map.entries()].sort(([ka, a], [kb, b]) =>
      ka === NO_SCHOOL ? 1 : kb === NO_SCHOOL ? -1 : a.name.localeCompare(b.name, 'zh-Hant')
    );
  }, [rows]);

  const handleDelete = async () => {
    if (!target) return;
    try {
      await deleteAccount(target.id);
      toast.success(`已永久刪除 ${target.email}`);
      setRows((list) => list.filter((r) => r.id !== target.id));
    } catch (err) {
      toastError(err, '刪除帳號失敗。請稍後再試。');
      throw err;
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-bold text-foreground">各校帳號（{rows.length}）</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          依學校分類。永久刪除會移除這個人的登入帳號，他之前點過的名會保留，只是不再顯示是誰點的。
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          aria-label="搜尋姓名或信箱"
          placeholder="搜尋姓名或信箱"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={schoolFilter} onValueChange={setSchoolFilter}>
          <SelectTrigger aria-label="篩選學校" className="sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有學校</SelectItem>
            {schools.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
            <SelectItem value={NO_SCHOOL}>尚未加入學校</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <ListSkeleton rows={5} />
      ) : groups.length === 0 ? (
        <EmptyState title="找不到帳號" description="換個關鍵字或學校再試試。" />
      ) : (
        <div className="space-y-6">
          {groups.map(([key, group]) => (
            <div key={key} className="space-y-2">
              <h3 className="text-base font-bold text-foreground">
                {group.name}
                <span className="ml-2 text-sm font-normal text-muted-foreground">{group.items.length} 個帳號</span>
              </h3>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {group.items.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                        <span className="truncate">{r.name}</span>
                        {r.role === 'school_admin' && <Badge variant="outline">學校主管</Badge>}
                        {!r.is_active && <Badge variant="destructive">已停用</Badge>}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">{r.email}</p>
                    </div>
                    {r.id !== profile?.id && (
                      <IconButton
                        label={`永久刪除 ${r.name}`}
                        onClick={() => setTarget(r)}
                        className="text-absent hover:text-absent"
                      >
                        <Trash2 aria-hidden="true" />
                      </IconButton>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <DangerConfirmDialog
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title={`永久刪除帳號「${target?.name ?? ''}」？`}
        confirmText={target?.email ?? ''}
        consequences={[
          `${target?.email ?? ''} 無法再登入，也無法用「忘記密碼」找回`,
          '個人資料與班級指派會一起刪除',
          '他以前點過的名會保留，但不再顯示是誰點的',
        ]}
        onConfirm={handleDelete}
      />
    </section>
  );
}
