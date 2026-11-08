import * as React from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { Navbar } from '@/components/ui/navbar';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, Grid3X3, Users, History, PlusCircle, Trash2, Clock, Bell } from 'lucide-react';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { ClassScheduleDialog } from '@/components/attendance/ClassScheduleDialog';
import { useRollcallReminders } from '@/hooks/useRollcallReminders';
import type { SchoolClass, Student, ClassTeacher } from '@/types/database';
import { SeatMapEditorModal } from '@/components/attendance/SeatMapEditorModal';
import { LiveAttendanceRollcall } from '@/components/attendance/LiveAttendanceRollcall';
import { AttendanceHistoryView } from '@/components/attendance/AttendanceHistoryView';
import { toast } from 'sonner';

interface AssignedClassItem {
  class: SchoolClass;
  role: 'homeroom' | 'subject';
}

export function TeacherDashboard() {
  const { profile } = useAuthStore();
  const schoolId = profile?.school_id;

  const [assignedClasses, setAssignedClasses] = React.useState<AssignedClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = React.useState<string>('');
  const [classStudents, setClassStudents] = React.useState<Student[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [attendanceRefreshKey, setAttendanceRefreshKey] = React.useState<number>(0);

  // 模態視窗狀態
  const [seatingEditorOpen, setSeatingEditorOpen] = React.useState<boolean>(false);
  const [liveRollcallOpen, setLiveRollcallOpen] = React.useState<boolean>(false);
  const [activeModalClass, setActiveModalClass] = React.useState<{ id: string; name: string } | null>(null);
  const [scheduleOpen, setScheduleOpen] = React.useState<boolean>(false);
  const [rollcallPeriod, setRollcallPeriod] = React.useState<string | undefined>(undefined);
  const { request: requestConfirm, dialog: confirmDialog } = useConfirm();

  // 班級學生管理 Modal (導師專用)
  const [studentModalOpen, setStudentModalOpen] = React.useState<boolean>(false);
  const [studentForm, setStudentForm] = React.useState({
    student_number: '',
    name: '',
    seat_number: 1,
    gender: '未填',
    parent_phone: '',
  });

  // 1. 載入當前教師所被指派之所有班級 (包含導師與科任)
  const loadAssignedClasses = React.useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('class_teachers')
        .select('role, class:classes(*)')
        .eq('teacher_id', profile.id);

      if (error) throw error;

      if (data && data.length > 0) {
        const mapped: AssignedClassItem[] = data
          .filter((item) => item.class !== null)
          .map((item) => ({
            class: item.class as unknown as SchoolClass,
            role: item.role as 'homeroom' | 'subject',
          }));

        setAssignedClasses(mapped);
        if (!selectedClassId && mapped.length > 0) {
          setSelectedClassId(mapped[0].class.id);
        }
      } else {
        // 若尚未設定 class_teachers，嘗試向後相容載入全校 classes (以科任角色預設)
        if (schoolId) {
          const { data: schoolClasses } = await supabase
            .from('classes')
            .select('*')
            .eq('school_id', schoolId);

          if (schoolClasses && schoolClasses.length > 0) {
            const mapped: AssignedClassItem[] = schoolClasses.map((c) => ({
              class: c,
              role: 'subject',
            }));
            setAssignedClasses(mapped);
            if (!selectedClassId) setSelectedClassId(mapped[0].class.id);
          }
        }
      }
    } catch (err: unknown) {
      console.error('載入教師班級失敗:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, schoolId, selectedClassId]);

  React.useEffect(() => {
    loadAssignedClasses();
  }, [loadAssignedClasses]);

  // 2. 載入選定班級之學生清單
  const loadStudents = React.useCallback(async (cId: string) => {
    if (!cId) return;
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', cId)
        .order('seat_number', { ascending: true });

      if (error) throw error;
      setClassStudents(data || []);
    } catch (err: unknown) {
      console.error('載入學生失敗:', err);
    }
  }, []);

  React.useEffect(() => {
    if (selectedClassId) {
      loadStudents(selectedClassId);
    }
  }, [selectedClassId, loadStudents]);

  const currentAssigned = assignedClasses.find((item) => item.class.id === selectedClassId);
  const isCurrentHomeroom = currentAssigned?.role === 'homeroom';

  // 快速啟動劃位
  const handleOpenSeating = (cls: SchoolClass) => {
    setSelectedClassId(cls.id);
    setActiveModalClass({ id: cls.id, name: cls.name });
    setSeatingEditorOpen(true);
  };

  // 快速啟動點名
  const handleOpenRollcall = (cls: SchoolClass) => {
    setSelectedClassId(cls.id);
    setActiveModalClass({ id: cls.id, name: cls.name });
    setRollcallPeriod(undefined);
    setLiveRollcallOpen(true);
  };

  const handleOpenSchedule = (cls: SchoolClass) => {
    setSelectedClassId(cls.id);
    setActiveModalClass({ id: cls.id, name: cls.name });
    setScheduleOpen(true);
  };

  // 導師新增在籍學生
  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId || !schoolId) return;

    try {
      const { error } = await supabase.from('students').insert({
        school_id: schoolId,
        class_id: selectedClassId,
        student_number: studentForm.student_number.trim(),
        name: studentForm.name.trim(),
        seat_number: Number(studentForm.seat_number),
        gender: studentForm.gender,
        parent_phone: studentForm.parent_phone.trim(),
      });

      if (error) throw error;

      toast.success('已成功新增在籍學生');
      setStudentModalOpen(false);
      setStudentForm({
        student_number: '',
        name: '',
        seat_number: classStudents.length + 2,
        gender: '未填',
        parent_phone: '',
      });
      loadStudents(selectedClassId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '新增學生失敗';
      toast.error(msg);
    }
  };

  // 導師刪除在籍學生
  const deleteStudent = async (studentId: string) => {
    try {
      const { error } = await supabase.from('students').delete().eq('id', studentId);
      if (error) throw error;
      toast.success('學生資料已移除');
      loadStudents(selectedClassId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '移除失敗';
      toast.error(msg);
    }
  };

  const handleDeleteStudent = (studentId: string, studentName: string) => {
    requestConfirm({
      title: `移除學生「${studentName}」？`,
      description: '將自班級名冊移除，該學生的出缺勤紀錄也會一併刪除，無法復原。',
      confirmLabel: '確認移除',
      destructive: true,
      action: () => deleteStudent(studentId),
    });
  };

  // 課表提醒觸發：切換到該班並開啟點名（節次預選，不自動開鏡頭）
  const handleReminderStart = React.useCallback(
    (classId: string, period: string) => {
      const target = assignedClasses.find((item) => item.class.id === classId);
      if (!target) return;
      setSelectedClassId(classId);
      setActiveModalClass({ id: classId, name: target.class.name });
      setRollcallPeriod(period);
      setLiveRollcallOpen(true);
    },
    [assignedClasses]
  );

  const { reload: reloadSchedules, permission, requestPermission } = useRollcallReminders({
    teacherId: profile?.id,
    onStart: handleReminderStart,
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar profile={profile} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* 歡迎與快捷操作標題 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {profile?.name || '專任'} 老師的教學控制台
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              所屬學校：{profile?.school?.name || '學校租戶'} · 即時點名、教室劃位與出缺勤管理
            </p>
          </div>
          {currentAssigned && (
            <div className="mt-4 sm:mt-0 flex items-center space-x-3">
              <Button
                variant="default"
                onClick={() => handleOpenRollcall(currentAssigned.class)}
              >
                <Camera className="w-4 h-4 mr-2" />
                啟動 [{currentAssigned.class.name}] 鏡頭點名
              </Button>
            </div>
          )}
        </div>

        {/* 授課班級快速卡片 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              您任教之班級 ({assignedClasses.length})
            </h2>
            <div className="flex items-center gap-3">
              {permission === 'default' && (
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={requestPermission}>
                  <Bell className="w-3 h-3 mr-1" />
                  開啟桌面提醒
                </Button>
              )}
              <span className="text-xs text-slate-500">
                點擊可切換當前主工作班級
              </span>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500 bg-white border border-slate-300 rounded">
              載入授課班級中...
            </div>
          ) : assignedClasses.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 bg-white border border-slate-300 rounded">
              目前尚未配置任何授課班級，請聯繫學校主管為您指派班級。
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {assignedClasses.map((item) => {
                const isSelected = item.class.id === selectedClassId;
                const isHomeroom = item.role === 'homeroom';

                return (
                  <Card
                    key={item.class.id}
                    onClick={() => setSelectedClassId(item.class.id)}
                    className={`cursor-pointer transition-all border ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/20 ring-1 ring-emerald-500'
                        : 'border-slate-300 hover:border-slate-400 bg-white'
                    }`}
                  >
                    <div className="p-4 flex flex-col justify-between h-full space-y-4">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-base text-slate-900">
                            {item.class.name}
                          </span>
                          <Badge
                            variant={isHomeroom ? 'default' : 'secondary'}
                            className="text-[10px]"
                          >
                            {isHomeroom ? '班級導師' : '科任老師'}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {item.class.academic_year} 學年 · {item.class.grade}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenSeating(item.class);
                          }}
                          className="text-xs flex-1 h-7"
                        >
                          <Grid3X3 className="w-3 h-3 mr-1" />
                          劃位
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenSchedule(item.class);
                          }}
                          className="text-xs flex-1 h-7"
                        >
                          <Clock className="w-3 h-3 mr-1" />
                          課表
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenRollcall(item.class);
                          }}
                          className="text-xs flex-1 h-7"
                        >
                          <Camera className="w-3 h-3 mr-1" />
                          點名
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* 選定班級之細節分頁 (名冊管理與考勤紀錄) */}
        {currentAssigned && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800 text-sm">
                  當前班級：{currentAssigned.class.name}
                </span>
                <Badge variant={isCurrentHomeroom ? 'default' : 'outline'} className="text-[10px]">
                  {isCurrentHomeroom ? '具備學生名冊編修權限 (導師)' : '僅具點名與考勤查閱權限 (科任)'}
                </Badge>
              </div>
            </div>

            <Tabs defaultValue="attendance_records" className="space-y-4">
              <TabsList className="bg-slate-200 p-1">
                <TabsTrigger value="attendance_records" className="text-xs font-bold">
                  班級歷史考勤紀錄
                </TabsTrigger>
                <TabsTrigger value="roster" className="text-xs font-bold">
                  班級學生名冊 {isCurrentHomeroom ? '(管理)' : '(唯讀)'}
                </TabsTrigger>
              </TabsList>

              {/* 考勤歷史分頁 */}
              <TabsContent value="attendance_records">
                <Card className="border-slate-300">
                  <CardHeader className="pb-3 border-b border-slate-200">
                    <CardTitle className="text-base flex items-center">
                      <History className="w-4 h-4 mr-2 text-slate-700" />
                      {currentAssigned.class.name} 歷史點名紀錄
                    </CardTitle>
                    <CardDescription>
                      檢視本班課堂點名批次、覆核缺勤狀況並提供人工覆寫
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <AttendanceHistoryView
                      key={attendanceRefreshKey}
                      classId={currentAssigned.class.id}
                      isEditable={true}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* 學生名冊分頁 */}
              <TabsContent value="roster">
                <Card className="border-slate-300">
                  <CardHeader className="pb-3 border-b border-slate-200 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center">
                        <Users className="w-4 h-4 mr-2 text-purple-600" />
                        學生在籍名冊 ({classStudents.length} 人)
                      </CardTitle>
                      <CardDescription>
                        {isCurrentHomeroom
                          ? '身為班級導師，您可新增或移除在籍學生資料'
                          : '身為科任老師，您僅能查閱在籍學生名冊，無法更動學籍'}
                      </CardDescription>
                    </div>
                    {isCurrentHomeroom && (
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => {
                          setStudentForm({
                            student_number: '',
                            name: '',
                            seat_number: classStudents.length + 1,
                            gender: '未填',
                            parent_phone: '',
                          });
                          setStudentModalOpen(true);
                        }}
                        className="h-8 text-xs"
                      >
                        <PlusCircle className="w-3.5 h-3.5 mr-1" />
                        新增學生
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 border-b border-slate-200">
                          <TableHead className="w-16 text-xs font-bold text-slate-700">座號</TableHead>
                          <TableHead className="w-32 text-xs font-bold text-slate-700">學號</TableHead>
                          <TableHead className="w-32 text-xs font-bold text-slate-700">姓名</TableHead>
                          <TableHead className="w-24 text-xs font-bold text-slate-700">性別</TableHead>
                          <TableHead className="text-xs font-bold text-slate-700">家長聯絡電話</TableHead>
                          {isCurrentHomeroom && (
                            <TableHead className="w-20 text-xs font-bold text-slate-700 text-right">操作</TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {classStudents.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={isCurrentHomeroom ? 6 : 5} className="text-center py-8 text-xs text-slate-500">
                              目前尚無學生資料
                            </TableCell>
                          </TableRow>
                        ) : (
                          classStudents.map((st) => (
                            <TableRow key={st.id} className="border-b border-slate-200 hover:bg-slate-50">
                              <TableCell className="text-xs font-mono font-bold">{st.seat_number}</TableCell>
                              <TableCell className="text-xs font-mono">{st.student_number}</TableCell>
                              <TableCell className="text-xs font-medium text-slate-900">{st.name}</TableCell>
                              <TableCell className="text-xs text-slate-600">{st.gender || '-'}</TableCell>
                              <TableCell className="text-xs font-mono text-slate-600">{st.parent_phone}</TableCell>
                              {isCurrentHomeroom && (
                                <TableCell className="text-xs text-right">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteStudent(st.id, st.name)}
                                    className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* 教室劃位彈窗 */}
        {activeModalClass && (
          <SeatMapEditorModal
            open={seatingEditorOpen}
            onOpenChange={setSeatingEditorOpen}
            classId={activeModalClass.id}
            className={activeModalClass.name}
            students={classStudents}
            onSaved={() => {
              setAttendanceRefreshKey((k) => k + 1);
            }}
          />
        )}

        {/* AI 鏡頭點名彈窗 */}
        {activeModalClass && profile && (
          <LiveAttendanceRollcall
            open={liveRollcallOpen}
            onOpenChange={setLiveRollcallOpen}
            classId={activeModalClass.id}
            className={activeModalClass.name}
            teacherId={profile.id}
            students={classStudents}
            initialPeriod={rollcallPeriod}
            onAttendanceCompleted={() => {
              setAttendanceRefreshKey((k) => k + 1);
            }}
          />
        )}

        {/* 課表與點名提醒設定 */}
        {activeModalClass && profile && (
          <ClassScheduleDialog
            open={scheduleOpen}
            onOpenChange={setScheduleOpen}
            classId={activeModalClass.id}
            className={activeModalClass.name}
            teacherId={profile.id}
            onChanged={reloadSchedules}
          />
        )}

        {confirmDialog}

        {/* 導師新增學生 Modal */}
        <Dialog open={studentModalOpen} onOpenChange={setStudentModalOpen}>
          <DialogContent className="max-w-md p-6 bg-white border border-slate-300">
            <DialogHeader className="border-b border-slate-200 pb-3">
              <DialogTitle className="text-base font-bold text-slate-800">
                新增在籍學生 · {currentAssigned?.class.name}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateStudent} className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">座號</Label>
                  <Input
                    type="number"
                    required
                    min={1}
                    value={studentForm.seat_number}
                    onChange={(e) =>
                      setStudentForm((prev) => ({ ...prev, seat_number: parseInt(e.target.value) || 1 }))
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">學號</Label>
                  <Input
                    required
                    placeholder="S113001"
                    value={studentForm.student_number}
                    onChange={(e) =>
                      setStudentForm((prev) => ({ ...prev, student_number: e.target.value }))
                    }
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">學生姓名</Label>
                  <Input
                    required
                    placeholder="林小明"
                    value={studentForm.name}
                    onChange={(e) =>
                      setStudentForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">性別</Label>
                  <Select
                    value={studentForm.gender}
                    onValueChange={(val) => setStudentForm((prev) => ({ ...prev, gender: val }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="男">男</SelectItem>
                      <SelectItem value="女">女</SelectItem>
                      <SelectItem value="未填">未填</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">家長聯絡手機 (末4碼供查榜驗證)</Label>
                <Input
                  required
                  placeholder="0912345678"
                  value={studentForm.parent_phone}
                  onChange={(e) =>
                    setStudentForm((prev) => ({ ...prev, parent_phone: e.target.value }))
                  }
                  className="h-8 text-xs font-mono"
                />
              </div>

              <DialogFooter className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStudentModalOpen(false)}
                  className="text-xs"
                >
                  取消
                </Button>
                <Button type="submit" variant="default" size="sm" className="text-xs">
                  確認建立
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
