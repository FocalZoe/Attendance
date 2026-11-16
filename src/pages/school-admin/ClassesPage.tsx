import { AnimatePresence, m } from 'motion/react';
import { Grid3X3, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AttendanceHistoryView } from '@/components/attendance/AttendanceHistoryView';
import { PresenceItem } from '@/components/motion/presence-item';
import { Stagger, StaggerItem } from '@/components/motion/stagger';
import { fadeUp } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { useSchoolAdmin } from '@/pages/school-admin/context';

const sectionHeading = 'font-display text-lg font-bold text-foreground';

export function ClassesPage() {
  const {
    loading,
    classes,
    classTeachers,
    selectedClassId,
    setSelectedClassId,
    selectedClass,
    selectedClassTeachers,
    classStudents,
    setClassDialogOpen,
    openAssignDialog,
    handleRemoveClassTeacher,
    setStudentModalOpen,
    handleDeleteStudent,
    setActiveModalClass,
    setSeatingEditorOpen,
  } = useSchoolAdmin();

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className={sectionHeading}>班級（{classes.length}）</h2>
          <Button type="button" size="sm" onClick={() => setClassDialogOpen(true)}>
            <Plus aria-hidden="true" />
            新增班級
          </Button>
        </div>
        {loading ? (
          <ListSkeleton rows={3} />
        ) : classes.length === 0 ? (
          <EmptyState
            title="還沒有班級"
            description="先按右上角的「新增班級」建立班級，才能指派老師、建立名冊與座位。"
          />
        ) : (
          <Stagger as="ul" gap={0.05} className="divide-y divide-border border-y border-border">
          {classes.map((c) => {
              const isSelected = c.id === selectedClassId;
              const homeroom = classTeachers.find((ct) => ct.class_id === c.id && ct.role === 'homeroom');
              return (
                // The whole row selects the class; the inner button keeps keyboard access
                <StaggerItem
                as="li"
                key={c.id}
                onClick={() => setSelectedClassId(c.id)}
                className={cn(
                  'relative flex cursor-pointer items-center justify-between gap-3 py-3 pl-4 pr-2 transition-colors hover:bg-secondary/30',
                  isSelected && 'bg-secondary/50'
                )}
              >
                {isSelected && (
                  <m.span
                    layoutId="school-class-bar"
                    className="absolute inset-y-0 left-0 w-0.5 bg-primary"
                    aria-hidden="true"
                  />
                )}
                  <button
                    type="button"
                    onClick={() => setSelectedClassId(c.id)}
                    aria-pressed={isSelected}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block font-display text-lg font-bold text-foreground">{c.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {c.academic_year} 學年　{c.grade}
                      {homeroom?.teacher?.name ? `　導師 ${homeroom.teacher.name}` : '　還沒有導師'}
                    </span>
                                </button>
            </StaggerItem>
          );
        })}
      </Stagger>
        )}
      </section>

      {selectedClass && (
        <m.section
          key={selectedClass.id}
          className="space-y-4"
          data-tour="sa-class-detail"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
        >
          <h2 className={sectionHeading}>
            {selectedClass.name}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {selectedClass.academic_year} 學年　{selectedClass.grade}
            </span>
          </h2>

          <Tabs defaultValue="people">
            <TabsList>
              <TabsTrigger value="people">導師與科任</TabsTrigger>
              <TabsTrigger value="roster">學生名冊（{classStudents.length}）</TabsTrigger>
              <TabsTrigger value="seats">座位表</TabsTrigger>
              <TabsTrigger value="history">出勤紀錄</TabsTrigger>
            </TabsList>

            <TabsContent value="people" className="mt-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">這個班級的導師與科任老師。</p>
                <Button type="button" size="sm" onClick={() => openAssignDialog(selectedClass.id, '')}>
                  <Plus aria-hidden="true" />
                  指派老師
                </Button>
              </div>
              {selectedClassTeachers.length === 0 ? (
                <EmptyState
                  title="這個班還沒有指派老師"
                  description="按右上角的「指派老師」，老師才能對這個班點名、排座位。"
                />
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                <AnimatePresence initial={false}>
                {selectedClassTeachers.map((ct) => (
                  <PresenceItem key={ct.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <p className="flex min-w-0 items-center gap-2 text-sm text-foreground">
                        <span className="truncate font-medium">{ct.teacher?.name || '未知教師'}</span>
                        <Badge variant={ct.role === 'homeroom' ? 'default' : 'outline'}>
                          {ct.role === 'homeroom' ? '導師' : '科任'}
                        </Badge>
                      </p>
                      <IconButton label="解除指派" onClick={() => handleRemoveClassTeacher(ct)}>
                        <Trash2 aria-hidden="true" />
                      </IconButton>
                                      </PresenceItem>
                ))}
                </AnimatePresence>
              </ul>
              )}
            </TabsContent>

            <TabsContent value="roster" className="mt-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">電話末四碼會用於家長查勤驗證。</p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setStudentModalOpen(true)}
                >
                  <Plus aria-hidden="true" />
                  新增學生
                </Button>
              </div>

              {classStudents.length === 0 ? (
                <EmptyState title="這個班級還沒有學生" description="按右上角的「新增學生」建立名冊。" />
              ) : (
                <>
                  <ul className="divide-y divide-border border-y border-border md:hidden">
                    {classStudents.map((st) => (
                      <li key={st.id} className="flex items-center gap-3 py-3">
                        <span className="tabular w-8 shrink-0 text-right font-bold text-muted-foreground">
                          {st.seat_number}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground">{st.name}</p>
                          <p className="tabular text-sm text-muted-foreground">{st.student_number}</p>
                        </div>
                        <IconButton label={`移除 ${st.name}`} onClick={() => handleDeleteStudent(st.id, st.name)}>
                          <Trash2 aria-hidden="true" />
                        </IconButton>
                      </li>
                    ))}
                  </ul>

                  <div className="hidden overflow-hidden rounded-lg border border-border md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">座號</TableHead>
                          <TableHead className="w-36">學號</TableHead>
                          <TableHead className="w-36">姓名</TableHead>
                          <TableHead className="w-24">性別</TableHead>
                          <TableHead>家長聯絡電話</TableHead>
                          <TableHead className="w-20 text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {classStudents.map((st) => (
                          <TableRow key={st.id}>
                            <TableCell className="tabular font-bold">{st.seat_number}</TableCell>
                            <TableCell className="tabular">{st.student_number}</TableCell>
                            <TableCell className="font-medium text-foreground">{st.name}</TableCell>
                            <TableCell className="text-muted-foreground">{st.gender || '-'}</TableCell>
                            <TableCell className="tabular text-muted-foreground">{st.parent_phone}</TableCell>
                            <TableCell className="text-right">
                              <IconButton label={`移除 ${st.name}`} onClick={() => handleDeleteStudent(st.id, st.name)}>
                                <Trash2 aria-hidden="true" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="seats" className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                排好教室的座位並指定每個座位坐誰，點名時鏡頭就知道誰該坐在哪裡。也可以把排好的位置存成佈局，讓其他班級直接套用。
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setActiveModalClass({ id: selectedClass.id, name: selectedClass.name });
                  setSeatingEditorOpen(true);
                }}
              >
                <Grid3X3 aria-hidden="true" />
                開啟座位表
              </Button>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <AttendanceHistoryView key={selectedClass.id} classId={selectedClass.id} isEditable={true} />
            </TabsContent>
          </Tabs>
        </m.section>
      )}
    </div>
  );
}
