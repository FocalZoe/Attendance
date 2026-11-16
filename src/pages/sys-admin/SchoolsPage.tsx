import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SchoolAdminModal } from '@/components/sys-admin/school-admin-modal';
import { Stagger, StaggerItem } from '@/components/motion/stagger';
import { adminSummary, useSysAdmin } from '@/pages/sys-admin/context';

export function SchoolsPage() {
  const { schools, allAdmins, loading, reload: loadData, setSchoolDialogOpen, setDeleteTarget } = useSysAdmin();

  return (
<div>
  {/* 學校列表 */}
  <section className="space-y-4">
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-display text-lg font-bold text-foreground">所有學校（{schools.length}）</h2>
      <Button type="button" size="sm" onClick={() => setSchoolDialogOpen(true)}>
        <Plus aria-hidden="true" />
        新增學校
      </Button>
    </div>

    {loading ? (
      <ListSkeleton rows={4} />
    ) : schools.length === 0 ? (
      <EmptyState title="還沒有學校" description="按右上角的「新增學校」建立第一所學校。" />
    ) : (
      <>
        {/* 手機：列表 */}
        <Stagger as="ul" gap={0.05} className="divide-y divide-border border-y border-border md:hidden">
          {schools.map((s) => {
            const schoolAdmins = allAdmins.filter((a) => a.school_id === s.id);
            const summary = adminSummary(schoolAdmins);
            return (
              <StaggerItem as="li" key={s.id} className="space-y-2 py-4">
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
              </StaggerItem>
            );
          })}
        </Stagger>

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
  );
}
