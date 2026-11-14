import * as React from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { deleteAccount } from '@/lib/hard-delete';
import { toastError } from '@/lib/errors';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DangerConfirmDialog } from '@/components/ui/danger-confirm-dialog';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { UserRole } from '@/types/database';

const PAGE_SIZE = 20;

interface AccountRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  school_id: string | null;
  school: { name: string } | null;
}

const ROLE_LABEL: Record<UserRole, string> = {
  sys_admin: '系統總管',
  school_admin: '學校主管',
  teacher: '任課教師',
};

/** Escape characters that have special meaning inside a PostgREST `or()` filter / ilike pattern */
function sanitizeSearch(input: string): string {
  return input.replace(/[,()%*\\]/g, ' ').trim();
}

export function AccountsPanel() {
  const { profile } = useAuthStore();
  const [rows, setRows] = React.useState<AccountRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(0);
  const [search, setSearch] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [role, setRole] = React.useState<'all' | UserRole>('all');
  const [loading, setLoading] = React.useState(true);
  const [target, setTarget] = React.useState<AccountRow | null>(null);

  // Debounce typing so every keystroke does not hit the database
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(sanitizeSearch(search));
      setPage(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = React.useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('profiles')
      .select('id, name, email, role, is_active, school_id, school:schools(name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (role !== 'all') q = q.eq('role', role);
    if (query) q = q.or(`name.ilike.%${query}%,email.ilike.%${query}%`);

    const { data, error, count } = await q;
    if (error) {
      toastError(error, '讀取帳號失敗。請重新整理頁面。');
    } else {
      setRows((data ?? []) as unknown as AccountRow[]);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }, [page, query, role]);

  React.useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleDelete = async () => {
    if (!target) return;
    try {
      await deleteAccount(target.id);
      toast.success(`已永久刪除 ${target.email}`);
      setRows((list) => list.filter((r) => r.id !== target.id));
      setTotal((n) => Math.max(0, n - 1));
    } catch (err) {
      toastError(err, '刪除帳號失敗。請稍後再試。');
      throw err;
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-bold text-foreground">所有帳號（{total}）</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          永久刪除會移除這個人的登入帳號。他之前點過的名會保留，只是不再顯示是誰點的。
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
        <Select
          value={role}
          onValueChange={(v) => {
            setRole(v as 'all' | UserRole);
            setPage(0);
          }}
        >
          <SelectTrigger aria-label="篩選身分" className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有身分</SelectItem>
            <SelectItem value="school_admin">學校主管</SelectItem>
            <SelectItem value="teacher">任課教師</SelectItem>
            <SelectItem value="sys_admin">系統總管</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <ListSkeleton rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState title="找不到帳號" description="換個關鍵字或身分再試試。" />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.map((r) => {
            const canDelete = r.role !== 'sys_admin' && r.id !== profile?.id;
            return (
              <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                    <span className="truncate">{r.name}</span>
                    <Badge variant={r.role === 'sys_admin' ? 'default' : 'outline'}>{ROLE_LABEL[r.role]}</Badge>
                    {!r.is_active && <Badge variant="destructive">已停用</Badge>}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {r.email}
                    {r.school?.name ? `　${r.school.name}` : ''}
                  </p>
                </div>
                {canDelete && (
                  <IconButton label={`永久刪除 ${r.name}`} onClick={() => setTarget(r)} className="text-absent hover:text-absent">
                    <Trash2 aria-hidden="true" />
                  </IconButton>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <Button type="button" variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)}>
            上一頁
          </Button>
          <span className="tabular">
            {page + 1} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1 || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            下一頁
          </Button>
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
