import React from 'react'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react'
import type { AttendanceStatus } from '@/domain/attendance/types'

export interface StudentAttendanceRow {
  studentId: string
  seatNumber: number
  studentNo: string
  name: string
  records: Record<string, AttendanceStatus> // key is periodKey (e.g., '10/04-P1')
  attendanceRate: number
}

interface HistoryTableViewProps {
  periods: Array<{ key: string; label: string }>
  data: StudentAttendanceRow[]
  highlightStudentNo?: string
}

const STATUS_BADGE_MAP: Record<
  AttendanceStatus,
  { label: string; className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  PRESENT: {
    label: '出席',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: CheckCircle2,
  },
  ABSENT: {
    label: '缺席',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
    icon: XCircle,
  },
  LATE: {
    label: '遲到',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: Clock,
  },
  EXCUSED: {
    label: '請假',
    className: 'bg-sky-50 text-sky-700 border-sky-200',
    icon: AlertCircle,
  },
}

export const HistoryTableView: React.FC<HistoryTableViewProps> = ({
  periods,
  data,
  highlightStudentNo,
}) => {
  return (
    <div className="rounded-md border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-16 text-center font-bold">座號</TableHead>
              <TableHead className="w-24 font-bold">學號</TableHead>
              <TableHead className="w-28 font-bold">學生姓名</TableHead>
              {periods.map((p) => (
                <TableHead key={p.key} className="text-center min-w-[90px] font-bold">
                  {p.label}
                </TableHead>
              ))}
              <TableHead className="w-24 text-right font-bold">總出席率</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => {
              const isHighlighted = highlightStudentNo && row.studentNo === highlightStudentNo
              return (
                <TableRow
                  key={row.studentId}
                  className={isHighlighted ? 'bg-primary/5 font-medium' : undefined}
                >
                  <TableCell className="text-center font-semibold">{row.seatNumber}</TableCell>
                  <TableCell className="font-mono text-xs">{row.studentNo}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span>{row.name}</span>
                      {isHighlighted && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 border-primary text-primary">
                          關注
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  {periods.map((p) => {
                    const status = row.records[p.key] || 'PRESENT'
                    const config = STATUS_BADGE_MAP[status]
                    const Icon = config.icon
                    return (
                      <TableCell key={p.key} className="text-center p-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border font-medium ${config.className}`}
                        >
                          <Icon className="h-3 w-3" />
                          {config.label}
                        </span>
                      </TableCell>
                    )
                  })}
                  <TableCell className="text-right font-mono font-semibold">
                    <span
                      className={
                        row.attendanceRate >= 90
                          ? 'text-emerald-600'
                          : row.attendanceRate >= 70
                          ? 'text-amber-600'
                          : 'text-destructive'
                      }
                    >
                      {row.attendanceRate.toFixed(1)}%
                    </span>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
