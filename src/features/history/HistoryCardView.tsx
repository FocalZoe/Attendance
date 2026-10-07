import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Eye, Calendar, UserX, UserCheck } from 'lucide-react'

export interface HistoryCardItem {
  id: string
  periodTitle: string
  timestamp: string
  photoUrl: string
  totalSeats: number
  occupiedCount: number
  vacantCount: number
  attendanceRate: string
  vacantSeats: number[]
}

interface HistoryCardViewProps {
  records: HistoryCardItem[]
}

export const HistoryCardView: React.FC<HistoryCardViewProps> = ({ records }) => {
  const [selectedPhoto, setSelectedPhoto] = useState<HistoryCardItem | null>(null)

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {records.map((rec) => (
          <Card key={rec.id} className="group overflow-hidden transition-all hover:border-primary/50">
            {/* 相片預覽與大圖觸發 */}
            <div
              className="relative aspect-video w-full cursor-pointer overflow-hidden bg-neutral-900"
              onClick={() => setSelectedPhoto(rec)}
            >
              <img
                src={rec.photoUrl}
                alt={rec.periodTitle}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <span className="flex items-center gap-1.5 rounded-md bg-black/70 px-3 py-1.5 text-xs font-medium text-white">
                  <Eye className="h-4 w-4" /> 點擊放大相片
                </span>
              </div>

              {/* 席位在座率徽章 */}
              <div className="absolute top-2.5 right-2.5">
                <Badge
                  variant={rec.vacantCount > 0 ? 'destructive' : 'default'}
                  className="font-mono text-xs shadow-none"
                >
                  在座率 {rec.attendanceRate}
                </Badge>
              </div>
            </div>

            {/* 卡片資訊 */}
            <CardContent className="space-y-2.5 p-4">
              <div className="space-y-1">
                <h3 className="font-semibold text-sm leading-tight text-foreground">
                  {rec.periodTitle}
                </h3>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{rec.timestamp}</span>
                </div>
              </div>

              {/* 統計數量 */}
              <div className="flex items-center justify-between text-xs border-t border-border pt-2">
                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                  <UserCheck className="h-3.5 w-3.5" /> 在座 {rec.occupiedCount} / {rec.totalSeats}
                </span>
                <span className="flex items-center gap-1 text-destructive font-medium">
                  <UserX className="h-3.5 w-3.5" /> 缺席 {rec.vacantCount}
                </span>
              </div>

              {/* 未到座號醒目標籤 */}
              {rec.vacantSeats.length > 0 ? (
                <div className="rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">
                  缺席座號：<strong>{rec.vacantSeats.map((s) => `${s} 號`).join(', ')}</strong>
                </div>
              ) : (
                <div className="rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                  全員到齊無缺席
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 相片放大燈箱彈窗 */}
      <Dialog open={!!selectedPhoto} onOpenChange={(open) => !open && setSelectedPhoto(null)}>
        <DialogContent className="max-w-3xl p-4">
          <DialogHeader>
            <DialogTitle>{selectedPhoto?.periodTitle} · 點名現場大圖</DialogTitle>
          </DialogHeader>
          {selectedPhoto && (
            <div className="mt-2 overflow-hidden rounded-lg border border-border">
              <img
                src={selectedPhoto.photoUrl}
                alt={selectedPhoto.periodTitle}
                className="w-full object-contain max-h-[70vh]"
              />
              <div className="p-3 bg-muted/40 text-xs text-muted-foreground flex justify-between items-center">
                <span>時間：{selectedPhoto.timestamp}</span>
                <span>出席率：{selectedPhoto.attendanceRate}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
