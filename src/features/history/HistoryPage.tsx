import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  History as HistoryIcon,
  Download,
  RefreshCw,
  Search,
  LayoutGrid,
  Table as TableIcon,
  GraduationCap,
  Loader2,
} from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { useParentStore } from '@/store/useParentStore'
import { supabase, getStoragePublicUrl } from '@/lib/supabase'
import { HistoryCardView, type HistoryCardItem } from './HistoryCardView'
import { HistoryTableView, type StudentAttendanceRow } from './HistoryTableView'
import type { AttendanceStatus } from '@/domain/attendance/types'
import type { ClassItem, StudentItem, AttendanceRecordRow } from '@/lib/database.types'

export const HistoryPage: React.FC = () => {
  const { user } = useAuthStore()
  const { student: parentStudent, isAuthenticated: isParentAuth } = useParentStore()

  const [activeTab, setActiveTab] = useState<'cards' | 'table'>('cards')
  const [searchTerm, setSearchTerm] = useState('')
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL')
  const [students, setStudents] = useState<StudentItem[]>([])
  const [records, setRecords] = useState<AttendanceRecordRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const isParent = isParentAuth && !!parentStudent
  const isAdmin = user?.role === 'school_admin'

  // 1. 載入班級清單 (教職員適用)
  useEffect(() => {
    if (isParent) return
    const fetchClasses = async () => {
      try {
        const { data } = await supabase.from('classes').select('*').order('name', { ascending: true })
        if (data) {
          const list = data as ClassItem[]
          setClasses(list)
          if (list.length > 0 && !isAdmin) {
            setSelectedClassId(list[0].id)
          }
        }
      } catch (err) {
        console.warn('[HistoryPage] fetchClasses error:', err)
      }
    }
    fetchClasses()
  }, [isParent, isAdmin])

  // 2. 載入學生與考勤紀錄
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      if (isParent && parentStudent) {
        // 家長模式：單一學生
        const { data: recData } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('student_id', parentStudent.id)
          .order('created_at', { ascending: false })

        setRecords((recData || []) as AttendanceRecordRow[])
        setStudents([
          {
            id: parentStudent.id,
            class_id: '',
            student_no: parentStudent.studentNo,
            seat_number: parentStudent.seatNumber,
            name: parentStudent.name,
            created_at: '',
            updated_at: '',
          },
        ])
      } else {
        // 教職員模式
        let studentsQuery = supabase.from('students').select('*').order('seat_number', { ascending: true })
        let recordsQuery = supabase.from('attendance_records').select('*').order('created_at', { ascending: false })

        if (selectedClassId !== 'ALL') {
          studentsQuery = studentsQuery.eq('class_id', selectedClassId)
          recordsQuery = recordsQuery.eq('class_id', selectedClassId)
        }

        const [studentsRes, recordsRes] = await Promise.all([studentsQuery, recordsQuery])
        setStudents((studentsRes.data || []) as StudentItem[])
        setRecords((recordsRes.data || []) as AttendanceRecordRow[])
      }
    } catch (err) {
      console.warn('[HistoryPage] loadData error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [isParent, parentStudent, selectedClassId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 動態推導 periods 節次
  const periods = useMemo(() => {
    const periodMap = new Map<string, string>()
    records.forEach((r) => {
      if (!periodMap.has(r.period_key)) {
        periodMap.set(r.period_key, r.period_title || r.period_key)
      }
    })
    return Array.from(periodMap.entries()).map(([key, label]) => ({ key, label }))
  }, [records])

  // 整理成學生矩陣資料 (Table View)
  const tableData: StudentAttendanceRow[] = useMemo(() => {
    const periodKeys = periods.map((p) => p.key)
    return students.map((stu) => {
      const studentRecs = records.filter((r) => r.student_id === stu.id)
      const recMap: Record<string, AttendanceStatus> = {}
      let presentCount = 0

      periodKeys.forEach((pkey) => {
        const found = studentRecs.find((r) => r.period_key === pkey)
        const status = (found?.status as AttendanceStatus) || 'PRESENT'
        recMap[pkey] = status
        if (status === 'PRESENT') presentCount += 1
      })

      const attendanceRate = periodKeys.length > 0 ? (presentCount / periodKeys.length) * 100 : 100.0

      return {
        studentId: stu.id,
        seatNumber: stu.seat_number,
        studentNo: stu.student_no,
        name: stu.name,
        records: recMap,
        attendanceRate,
      }
    })
  }, [students, records, periods])

  // 整理成點名日誌卡片 (Card View)
  const cardData: HistoryCardItem[] = useMemo(() => {
    // 依 period_key 分組
    const groups = new Map<string, AttendanceRecordRow[]>()
    records.forEach((r) => {
      const list = groups.get(r.period_key) || []
      list.push(r)
      groups.set(r.period_key, list)
    })

    const studentMap = new Map<string, StudentItem>()
    students.forEach((s) => studentMap.set(s.id, s))

    const cards: HistoryCardItem[] = []
    groups.forEach((groupRecords, periodKey) => {
      const first = groupRecords[0]
      const total = isParent ? 1 : (students.length > 0 ? students.length : groupRecords.length)
      const presentCount = groupRecords.filter((r) => r.status === 'PRESENT').length
      const vacant = Math.max(0, total - presentCount)
      const rate = total > 0 ? ((presentCount / total) * 100).toFixed(1) + '%' : '100%'

      const vacantSeats: number[] = []
      if (!isParent) {
        const presentIds = new Set(groupRecords.filter((r) => r.status === 'PRESENT').map((r) => r.student_id))
        students.forEach((s) => {
          if (!presentIds.has(s.id)) vacantSeats.push(s.seat_number)
        })
      }

      const photoUrl =
        getStoragePublicUrl('attendance-photos', first?.photo_path) ||
        'https://placehold.co/600x400/18181b/ffffff?text=Attendance+Photo'

      cards.push({
        id: periodKey,
        periodTitle: first?.period_title || periodKey,
        timestamp: new Date(first.created_at).toLocaleString('zh-TW', { hour12: false }),
        photoUrl,
        totalSeats: total,
        occupiedCount: presentCount,
        vacantCount: vacant,
        attendanceRate: rate,
        vacantSeats,
      })
    })

    return cards
  }, [records, students, isParent])

  // 篩選
  const filteredCardRecords = useMemo(() => {
    if (!searchTerm.trim()) return cardData
    const term = searchTerm.toLowerCase()
    return cardData.filter(
      (r) =>
        r.periodTitle.toLowerCase().includes(term) ||
        r.vacantSeats.some((s) => String(s).includes(term))
    )
  }, [searchTerm, cardData])

  const filteredTableRecords = useMemo(() => {
    if (!searchTerm.trim()) return tableData
    const term = searchTerm.toLowerCase()
    return tableData.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.studentNo.toLowerCase().includes(term) ||
        String(s.seatNumber).includes(term)
    )
  }, [searchTerm, tableData])

  const handleExportCsv = () => {
    const headers = ['座號', '學號', '姓名', ...periods.map((p) => p.label), '總出席率']
    const rows = filteredTableRecords.map((s) => [
      s.seatNumber,
      s.studentNo,
      s.name,
      ...periods.map((p) => s.records[p.key] || 'PRESENT'),
      `${s.attendanceRate.toFixed(1)}%`,
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `attendance_history_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      {/* 標題與動作列 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            課堂歷史紀錄簿
            <HistoryIcon className="h-6 w-6 text-primary" />
          </h1>
          <p className="text-sm text-muted-foreground">
            {isParent
              ? '家長專屬查詢：子女考勤歷程檢閱'
              : isAdmin
              ? '全校考勤調閱中心：支援跨班級查詢與匯出'
              : '指派班級歷次考勤調閱'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => loadData()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            重新載入
          </Button>
          <Button size="sm" onClick={handleExportCsv} className="flex items-center gap-1.5">
            <Download className="h-3.5 w-3.5" />
            匯出 CSV 報表
          </Button>
        </div>
      </div>

      {/* 家長視角專屬學生標頭 */}
      {isParent && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-emerald-900">
                {parentStudent?.name} 同學 · 家長專屬查閱視角
              </div>
              <div className="text-xs text-emerald-700">
                學號：<strong>{parentStudent?.studentNo}</strong> · 座號：<strong>{parentStudent?.seatNumber} 號</strong> · 班級：{parentStudent?.className}
              </div>
            </div>
          </div>
          <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">Zero-Leak 安全保護中</Badge>
        </div>
      )}

      {/* 教職員班級切換篩選列 */}
      {!isParent && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">班級篩選：</span>
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
        </div>
      )}

      {/* 視角 Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'cards' | 'table')}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="cards" className="flex items-center gap-1.5">
              <LayoutGrid className="h-4 w-4" />
              點名卡片日誌 ({filteredCardRecords.length})
            </TabsTrigger>
            <TabsTrigger value="table" className="flex items-center gap-1.5">
              <TableIcon className="h-4 w-4" />
              學生出缺席矩陣 ({filteredTableRecords.length})
            </TabsTrigger>
          </TabsList>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={activeTab === 'cards' ? '搜尋節次名稱、缺席座號...' : '搜尋學生姓名、學號或座號...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {/* Tab 1: 點名相片卡片 */}
        <TabsContent value="cards" className="pt-4">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              載入考勤歷史紀錄中...
            </div>
          ) : filteredCardRecords.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground text-sm">
                目前尚無可供調閱的歷史點名紀錄
              </CardContent>
            </Card>
          ) : (
            <HistoryCardView records={filteredCardRecords} />
          )}
        </TabsContent>

        {/* Tab 2: 出缺席矩陣表 */}
        <TabsContent value="table" className="pt-4">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              計算學生出席矩陣中...
            </div>
          ) : filteredTableRecords.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground text-sm">
                尚無學生考勤矩陣資料
              </CardContent>
            </Card>
          ) : (
            <HistoryTableView
              periods={periods}
              data={filteredTableRecords}
              highlightStudentNo={isParent ? parentStudent?.studentNo : undefined}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
