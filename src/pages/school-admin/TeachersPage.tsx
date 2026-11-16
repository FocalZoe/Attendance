import { Plus, UserCheck, UserX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Stagger, StaggerItem } from '@/components/motion/stagger';
import { useSchoolAdmin } from '@/pages/school-admin/context';

const sectionHeading = 'font-display text-lg font-bold text-foreground';

export function TeachersPage() {
  const {
    loading,
    teachers,
    classTeachers,
    setTeacherDialogOpen,
    openAssignDialog,
    setTeacherActive,
    handleDeactivateTeacher,
  } = useSchoolAdmin();

  return (
    <div>
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className={sectionHeading}>教師帳號（{teachers.length}）</h2>
          <Button type="button" size="sm" onClick={() => setTeacherDialogOpen(true)}>
            <Plus aria-hidden="true" />
            新增教師帳號
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          教師離職時可停用帳號。歷史點名紀錄會保留，之後也能重新啟用。
        </p>
        {loading ? (
          <ListSkeleton rows={3} />
        ) : teachers.length === 0 ? (
          <EmptyState title="還沒有教師帳號" description="按右上角的「新增教師帳號」建立第一位教師。" />
        ) : (
          <Stagger as="ul" gap={0.04} className="divide-y divide-border rounded-md border border-border">
          {teachers.map((t) => {
              const mine = classTeachers.filter((ct) => ct.teacher_id === t.id);
              return (
                <StaggerItem as="li" key={t.id} className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1.5">
                    <p className="flex items-center gap-2 font-medium text-foreground">
                      <span className="truncate">{t.name}</span>
                      {t.is_active === false && <Badge variant="destructive">已停用</Badge>}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">{t.email}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {mine.length === 0 ? (
                        <span className="text-sm text-muted-foreground">還沒有負責的班級</span>
                      ) : (
                        mine.map((ct) => (
                          <Badge key={ct.id} variant={ct.role === 'homeroom' ? 'default' : 'outline'}>
                            {ct.class?.name || '未知班級'}　{ct.role === 'homeroom' ? '導師' : '科任'}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {t.is_active === false ? (
                      <Button type="button" variant="outline" size="sm" onClick={() => setTeacherActive(t.id, true)}>
                        <UserCheck aria-hidden="true" />
                        啟用
                      </Button>
                    ) : (
                      <>
                        <Button type="button" variant="outline" size="sm" onClick={() => openAssignDialog('', t.id)}>
                          <Plus aria-hidden="true" />
                          指派班級
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeactivateTeacher(t.id, t.name)}
                        >
                          <UserX aria-hidden="true" />
                          停用
                        </Button>
                      </>
                    )}
                                  </div>
              </StaggerItem>
            );
          })}
        </Stagger>
        )}
      </section>
    </div>
  );
}
