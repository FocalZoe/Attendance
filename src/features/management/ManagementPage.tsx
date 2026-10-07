import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Plus, Search, ShieldAlert, UserCheck, School as SchoolIcon, Loader2, Edit3, Trash2, UserPlus, GraduationCap } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { supabase, createTransientClient, getStoragePublicUrl } from '@/lib/supabase'
import type { ClassItem, StudentItem } from '@/lib/database.types'

interface StudentWithClass extends StudentItem {
  className?: string
}

interface TeacherWithClasses {
  id: string
  name: string
  email?: string | null
  classes: {
    class_id: string
    className: string
    is_homeroom: boolean
  }[]
}

export const ManagementPage: React.FC = () => {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'school_admin'

  const [classes, setClasses] = useState<ClassItem[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL')
  const [students, setStudents] = useState<StudentWithClass[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [actionError, setActionError] = useState<string | null>(null)

  // 學生彈窗狀態
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Partial<StudentItem> | null>(null)
  const [isSavingStudent, setIsSavingStudent] = useState(false)

  // 班級彈窗狀態 (學校總管限定)
  const [isClassModalOpen, setIsClassModalOpen] = useState(false)
  const [newClassName, setNewClassName] = useState('')
  const [isSavingClass, setIsSavingClass] = useState(false)

  // 載入班級列表
  const fetchClasses = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .order('name', { ascending: true })

      if (error) {
        console.warn('[Management] fetchClasses error:', error.message)
        setActionError('讀取班級資料失敗：' + error.message)
        return
      }

      const list = (data || []) as ClassItem[]
      setClasses(list)
      if (list.length > 0 && selectedClassId === 'ALL' && !isAdmin) {
        setSelectedClassId(list[0].id)
      }
    } catch (err) {
      console.warn('[Management] fetchClasses exception:', err)
    }
  }, [isAdmin, selectedClassId])

  // 載入學生列表
  const fetchStudents = useCallback(async () => {
    setIsLoading(true)
    setActionError(null)
    try {
      let query = supabase
        .from('students')
        .select('*, classes(name)')
        .order('seat_number', { ascending: true })

      if (selectedClassId !== 'ALL') {
        query = query.eq('class_id', selectedClassId)
      }

      const { data, error } = await query

      if (error) {
        console.warn('[Management] fetchStudents error:', error.message)
        setActionError('讀取學生名冊失敗：' + error.message)
        setStudents([])
        return
      }

      const mapped: StudentWithClass[] = ((data || []) as Array<StudentItem & { classes?: { name: string } }>).map((row) => ({
        ...row,
        className: row.classes?.name || '未分班',
      }))

      setStudents(mapped)
    } catch (err) {
      console.warn('[Management] fetchStudents exception:', err)
      setActionError('載入學生清單發生連線錯誤')
    } finally {
      setIsLoading(false)
    }
  }, [selectedClassId])

  useEffect(() => {
    fetchClasses()
  }, [fetchClasses])

  useEffect(() => {
    fetchStudents()
  }, [fetchStudents])

  // 教師狀態 (學校總管限定)
  const [teachers, setTeachers] = useState<TeacherWithClasses[]>([])
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false)
  const [teacherName, setTeacherName] = useState('')
  const [teacherEmail, setTeacherEmail] = useState('')
  const [teacherPassword, setTeacherPassword] = useState('')
  const [teacherClassId, setTeacherClassId] = useState('')
  const [isTeacherHomeroom, setIsTeacherHomeroom] = useState(false)
  const [isSavingTeacher, setIsSavingTeacher] = useState(false)
  const [teacherSearchTerm, setTeacherSearchTerm] = useState('')
  const [isTeachersLoading, setIsTeachersLoading] = useState(false)

  const isHomeroomForClass = (classId: string) => user?.homeroomClassIds?.includes(classId) ?? false

  const fetchTeachers = useCallback(async () => {
    if (!isAdmin) return
    setIsTeachersLoading(true)
    try {
      const { data: profiles, error: pError } = await supabase
        .from('user_profiles')
        .select('id, name, email')
        .eq('role', 'teacher')

      if (pError) {
        console.warn('[Management] fetchTeachers error:', pError.message)
        return
      }

      const { data: tcData, error: tcError } = await supabase
        .from('teacher_classes')
        .select('teacher_id, class_id, is_homeroom, classes(name)')

      if (tcError) {
        console.warn('[Management] fetch teacher_classes error:', tcError.message)
      }

      const assignmentMap = new Map<string, { class_id: string; className: string; is_homeroom: boolean }[]>()
      ;(tcData || []).forEach((row: any) => {
        const list = assignmentMap.get(row.teacher_id) || []
        list.push({
          class_id: row.class_id,
          className: row.classes?.name || '未知班級',
          is_homeroom: !!row.is_homeroom,
        })
        assignmentMap.set(row.teacher_id, list)
      })

      const teacherList: TeacherWithClasses[] = (profiles || []).map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        classes: assignmentMap.get(p.id) || [],
      }))

      setTeachers(teacherList)
    } catch (err) {
      console.warn('[Management] fetchTeachers exception:', err)
    } finally {
      setIsTeachersLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    if (isAdmin) {
      fetchTeachers()
    }
  }, [isAdmin, fetchTeachers])

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!teacherName.trim() || !teacherEmail.trim() || !teacherPassword.trim()) {
      setActionError('請填寫完整姓名、信箱與密碼')
      return
    }

    setIsSavingTeacher(true)
    setActionError(null)

    try {
      if (!user?.schoolId) {
        setActionError('目前管理員帳號無關聯學校代號')
        return
      }

      // 1. 使用獨立暫態 Client 建立教師 Auth 帳號 (不影響管理員當前 Session)
      const transientClient = createTransientClient()
      const { data: authData, error: authError } = await transientClient.auth.signUp({
        email: teacherEmail.trim(),
        password: teacherPassword,
      })

      if (authError || !authData.user) {
        setActionError('建立教師認證帳號失敗：' + (authError?.message || '未知錯誤'))
        return
      }

      const newTeacherId = authData.user.id

      // 2. 寫入教師 User Profile (優先由 transientClient 寫入自身 profile，亦由管理員身分備援寫入)
      const profilePayload = {
        id: newTeacherId,
        school_id: user.schoolId,
        role: 'teacher' as const,
        name: teacherName.trim(),
        email: teacherEmail.trim(),
      }

      let profileResult = await transientClient.from('user_profiles').insert(profilePayload)
      if (profileResult.error) {
        profileResult = await supabase.from('user_profiles').insert(profilePayload)
      }

      if (profileResult.error) {
        setActionError('建立教師個人資料失敗：' + profileResult.error.message)
        return
      }

      // 3. 若有選擇指派班級，由管理員權限寫入 teacher_classes
      if (teacherClassId) {
        const { error: tcError } = await supabase.from('teacher_classes').insert({
          teacher_id: newTeacherId,
          class_id: teacherClassId,
          is_homeroom: isTeacherHomeroom,
        })

        if (tcError) {
          console.warn('[Management] 指派班級警告：', tcError.message)
        }
      }

      setTeacherName('')
      setTeacherEmail('')
      setTeacherPassword('')
      setTeacherClassId('')
      setIsTeacherHomeroom(false)
      setIsTeacherModalOpen(false)
      await fetchTeachers()
    } catch (err: any) {
      console.warn('[Management] handleCreateTeacher exception:', err)
      setActionError('建立教師帳號發生異常：' + (err.message || '請稍後重試'))
    } finally {
      setIsSavingTeacher(false)
    }
  }

  // 建立新班級 (學校總管)
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newClassName.trim()) return
    setIsSavingClass(true)
    setActionError(null)

    try {
      const { error } = await supabase.from('classes').insert({
        name: newClassName.trim(),
        school_id: user?.schoolId || undefined,
      })

      if (error) {
        setActionError('建立班級失敗：' + error.message)
        return
      }

      setNewClassName('')
      setIsClassModalOpen(false)
      await fetchClasses()
    } catch (err) {
      console.warn('[Management] handleCreateClass exception:', err)
      setActionError('建立班級失敗，請重試')
    } finally {
      setIsSavingClass(false)
    }
  }

  // 儲存學生 (新增或修改)
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingStudent || !editingStudent.name || !editingStudent.student_no || !editingStudent.class_id) {
      setActionError('請完整填寫學生姓名、學號與指定所屬班級')
      return
    }

    setIsSavingStudent(true)
    setActionError(null)

    try {
      const payload = {
        name: editingStudent.name.trim(),
        student_no: editingStudent.student_no.trim(),
        seat_number: Number(editingStudent.seat_number) || 1,
        class_id: editingStudent.class_id,
        verify_code: editingStudent.verify_code?.trim() || null,
      }

      if (editingStudent.id) {
        // 更新
        const { error } = await supabase
          .from('students')
          .update(payload)
          .eq('id', editingStudent.id)

        if (error) {
          setActionError('更新學生資料失敗：' + error.message)
          return
        }
      } else {
        // 新增
        const { error } = await supabase.from('students').insert(payload)
        if (error) {
          setActionError('新增學生失敗：' + error.message)
          return
        }
      }

      setIsStudentModalOpen(false)
      setEditingStudent(null)
      await fetchStudents()
    } catch (err) {
      console.warn('[Management] handleSaveStudent exception:', err)
      setActionError('儲存學生資料發生錯誤')
    } finally {
      setIsSavingStudent(false)
    }
  }

  // 刪除學生
  const handleDeleteStudent = async (studentId: string) => {
    if (!window.confirm('確定要自名冊移除此學生資料嗎？')) return
    setActionError(null)
    try {
      const { error } = await supabase.from('students').delete().eq('id', studentId)
      if (error) {
        setActionError('刪除學生失敗：' + error.message)
        return
      }
      await fetchStudents()
    } catch (err) {
      console.warn('[Management] handleDeleteStudent exception:', err)
      setActionError('刪除學生發生錯誤')
    }
  }

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.student_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(s.seat_number).includes(searchTerm) ||
      (s.className && s.className.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const filteredTeachers = teachers.filter(
    (t) =>
      t.name.toLowerCase().includes(teacherSearchTerm.toLowerCase()) ||
      (t.email && t.email.toLowerCase().includes(teacherSearchTerm.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      {/* 標題與動作列 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">學校教務與名冊管理</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? `學校總管：全校班級、學生與教師架構管理 (${user?.schoolName || '全校'})`
              : '授課教師模式：受限於指派班級授權維護名單'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <Button
                variant="outline"
                onClick={() => setIsTeacherModalOpen(true)}
                className="flex items-center gap-1.5"
              >
                <UserPlus className="h-4 w-4" />
                新增教師
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsClassModalOpen(true)}
                className="flex items-center gap-1.5"
              >
                <SchoolIcon className="h-4 w-4" />
                新增班級
              </Button>
            </>
          )}
          <Button
            onClick={() => {
              setEditingStudent({
                class_id: selectedClassId !== 'ALL' ? selectedClassId : classes[0]?.id || '',
                seat_number: (students.length || 0) + 1,
              })
              setIsStudentModalOpen(true)
            }}
            disabled={
              classes.length === 0 ||
              (!isAdmin && (selectedClassId === 'ALL' || !isHomeroomForClass(selectedClassId)))
            }
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            新增學生
          </Button>
        </div>
      </div>

      {!isAdmin && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-xs text-amber-800">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
          <span>權限說明：非導師任課教師僅具學生檢視權；僅所屬班級之班導師與總管具名冊異動權限。</span>
        </div>
      )}

      {actionError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {actionError}
        </div>
      )}

      <Tabs defaultValue="students" className="w-full space-y-6">
        {isAdmin && (
          <TabsList className="mb-2">
            <TabsTrigger value="students" className="flex items-center gap-1.5">
              <GraduationCap className="h-4 w-4" />
              學生與班級名冊
            </TabsTrigger>
            <TabsTrigger value="teachers" className="flex items-center gap-1.5">
              <UserPlus className="h-4 w-4" />
              教師帳號管理
            </TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="students" className="space-y-6">
          {/* 班級快速篩選列 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">選擇班級：</span>
            {isAdmin && (
              <Button
                variant={selectedClassId === 'ALL' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedClassId('ALL')}
                className="text-xs h-8"
              >
                全校所有班級
              </Button>
            )}
            {classes.map((cls) => (
              <Button
                key={cls.id}
                variant={selectedClassId === cls.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedClassId(cls.id)}
                className="text-xs h-8"
              >
                {cls.name}
              </Button>
            ))}
            {classes.length === 0 && (
              <span className="text-xs text-muted-foreground">暫無可用班級資料</span>
            )}
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>學生名冊清單</CardTitle>
                  <CardDescription>
                    共計 {filteredStudents.length} 名在校學生資料
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="搜尋姓名、學號或座號..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">頭像</TableHead>
                      <TableHead className="w-16">座號</TableHead>
                      <TableHead>學號</TableHead>
                      <TableHead>姓名</TableHead>
                      <TableHead>所屬班級</TableHead>
                      <TableHead>安全驗證碼 (家長)</TableHead>
                      <TableHead>學籍狀態</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            載入雲端學生名冊中...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                          尚無相符之學生資料
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStudents.map((student) => {
                        const avatarUrl = getStoragePublicUrl('avatars', student.avatar_path)
                        const canEdit = isAdmin || isHomeroomForClass(student.class_id)
                        return (
                          <TableRow key={student.id}>
                            <TableCell>
                              <div className="h-8 w-8 rounded-full overflow-hidden bg-muted border border-border flex items-center justify-center text-xs font-semibold text-muted-foreground">
                                {avatarUrl ? (
                                  <img src={avatarUrl} alt={student.name} className="h-full w-full object-cover" />
                                ) : (
                                  student.name.slice(0, 1)
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold">{student.seat_number}</TableCell>
                            <TableCell className="font-mono text-xs">{student.student_no}</TableCell>
                            <TableCell className="font-medium">{student.name}</TableCell>
                            <TableCell>{student.className}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {student.verify_code || `預設座號 (${String(student.seat_number).padStart(2, '0')})`}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="flex w-fit items-center gap-1 border-emerald-300 text-emerald-700 bg-emerald-50">
                                <UserCheck className="h-3 w-3" />
                                在學中
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {canEdit ? (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setEditingStudent(student)
                                        setIsStudentModalOpen(true)
                                      }}
                                    >
                                      <Edit3 className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive hover:text-destructive"
                                      onClick={() => handleDeleteStudent(student.id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </>
                                ) : (
                                  <span className="text-xs text-muted-foreground px-2">僅供檢視</span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="teachers" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>教師帳號清單</CardTitle>
                    <CardDescription>
                      共計 {filteredTeachers.length} 位在校教師帳號
                    </CardDescription>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="搜尋教師姓名或信箱..."
                      value={teacherSearchTerm}
                      onChange={(e) => setTeacherSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>教師姓名</TableHead>
                        <TableHead>登入公務信箱</TableHead>
                        <TableHead>負責與指派班級</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isTeachersLoading ? (
                        <TableRow>
                          <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
                            <div className="flex items-center justify-center gap-2">
                              <Loader2 className="h-5 w-5 animate-spin" />
                              載入教師資料中...
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : filteredTeachers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
                            尚未建立教師帳號，點擊右上角「新增教師」手動派發。
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredTeachers.map((tch) => (
                          <TableRow key={tch.id}>
                            <TableCell className="font-medium">{tch.name}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {tch.email || '未設定信箱'}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1.5">
                                {tch.classes.length > 0 ? (
                                  tch.classes.map((c) => (
                                    <Badge
                                      key={c.class_id}
                                      variant={c.is_homeroom ? 'default' : 'secondary'}
                                      className="text-xs"
                                    >
                                      {c.className} {c.is_homeroom ? '(導師)' : '(任課)'}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-xs text-muted-foreground">未分配班級</span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* 編輯/新增學生彈窗 */}
      <Dialog open={isStudentModalOpen} onOpenChange={setIsStudentModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStudent?.id ? '編輯學生資料' : '新增在校學生'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveStudent} className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">所屬班級</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={editingStudent?.class_id || ''}
                onChange={(e) =>
                  setEditingStudent((prev) => (prev ? { ...prev, class_id: e.target.value } : null))
                }
                required
              >
                <option value="" disabled>請選擇班級</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">座號</label>
                <Input
                  type="number"
                  min={1}
                  value={editingStudent?.seat_number || ''}
                  onChange={(e) =>
                    setEditingStudent((prev) =>
                      prev ? { ...prev, seat_number: parseInt(e.target.value) || 1 } : null
                    )
                  }
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">學號 (Student ID)</label>
                <Input
                  type="text"
                  value={editingStudent?.student_no || ''}
                  onChange={(e) =>
                    setEditingStudent((prev) => (prev ? { ...prev, student_no: e.target.value } : null))
                  }
                  placeholder="如: 112001"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">學生姓名</label>
              <Input
                type="text"
                value={editingStudent?.name || ''}
                onChange={(e) =>
                  setEditingStudent((prev) => (prev ? { ...prev, name: e.target.value } : null))
                }
                placeholder="輸入姓名"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">家長安全驗證碼 (選填，預設為生日4碼或座號)</label>
              <Input
                type="text"
                value={editingStudent?.verify_code || ''}
                onChange={(e) =>
                  setEditingStudent((prev) => (prev ? { ...prev, verify_code: e.target.value } : null))
                }
                placeholder="例如: 0521 (未填時家長可直接以補零座號登入)"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsStudentModalOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={isSavingStudent}>
                {isSavingStudent ? '儲存中...' : '確認儲存'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 建立班級彈窗 (學校總管限定) */}
      {isAdmin && (
        <Dialog open={isClassModalOpen} onOpenChange={setIsClassModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>開立新班級</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateClass} className="space-y-4 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-medium">班級名稱</label>
                <Input
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="例如: 一年一班、高三誠班"
                  required
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsClassModalOpen(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={isSavingClass}>
                  {isSavingClass ? '建立中...' : '開班確定'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* 建立教師彈窗 (學校總管限定) */}
      {isAdmin && (
        <Dialog open={isTeacherModalOpen} onOpenChange={setIsTeacherModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>手動建立教師帳號與指派</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateTeacher} className="space-y-4 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-medium">教師姓名</label>
                <Input
                  type="text"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  placeholder="例如: 王老師"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">教師公務信箱 (登入帳號)</label>
                <Input
                  type="email"
                  value={teacherEmail}
                  onChange={(e) => setTeacherEmail(e.target.value)}
                  placeholder="例如: teacher@school.edu.tw"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">初始密碼</label>
                <Input
                  type="password"
                  value={teacherPassword}
                  onChange={(e) => setTeacherPassword(e.target.value)}
                  placeholder="請設定至少 6 位數密碼"
                  required
                  minLength={6}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">指派班級 (選填)</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={teacherClassId}
                  onChange={(e) => setTeacherClassId(e.target.value)}
                >
                  <option value="">未指派 / 稍後指派</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>

              {teacherClassId && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="is_homeroom"
                    checked={isTeacherHomeroom}
                    onChange={(e) => setIsTeacherHomeroom(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <label htmlFor="is_homeroom" className="text-xs font-medium cursor-pointer">
                    設為此班級之班導師 (具名冊編輯權限)
                  </label>
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsTeacherModalOpen(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={isSavingTeacher}>
                  {isSavingTeacher ? '建立派發中...' : '確認建立帳號'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
