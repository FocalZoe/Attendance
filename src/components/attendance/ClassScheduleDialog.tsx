import * as React from 'react';
import { supabase } from '@/lib/supabase';
import { PERIOD_OPTIONS, periodLabel } from '@/lib/periods';
import { WEEKDAY_LABELS, formatTime } from '@/lib/schedule';
import { toastError } from '@/lib/errors';
import type { ClassSchedule } from '@/types/database';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export interface ScheduleTeacher {
  id: string;
  name: string;
}

interface ClassScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  className: string;
  /** Teachers already assigned to this class (homeroom and subject) */
  teachers: ScheduleTeacher[];
  onChanged?: () => void;
}

export function ClassScheduleDialog({
  open,
  onOpenChange,
  classId,
  className,
  teachers,
  onChanged,
}: ClassScheduleDialogProps) {
  const [items, setItems] = React.useState<ClassSchedule[]>([]);
  const [teacherId, setTeacherId] = React.useState('');
  const [weekday, setWeekday] = React.useState('1');
  const [period, setPeriod] = React.useState('1');
  const [startTime, setStartTime] = React.useState('08:00');
  const [remindBefore, setRemindBefore] = React.useState(5);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    const { data, error } = await supabase
      .from('class_schedules')
      .select('*')
      .eq('class_id', classId)
      .order('weekday', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      toastError(error, '讀取課表失敗。請重新開啟這個視窗。');
      return;
    }
    setItems((data || []) as ClassSchedule[]);
  }, [classId]);

  React.useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Default to the first assigned teacher; reset if the chosen one is no longer assigned
  React.useEffect(() => {
    if (!teachers.some((t) => t.id === teacherId)) setTeacherId(teachers[0]?.id ?? '');
  }, [teachers, teacherId]);

  const teacherName = React.useCallback(
    (id: string) => teachers.find((t) => t.id === id)?.name ?? '已移除的教師',
    [teachers]
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startTime || !teacherId) return;

    setSaving(true);
    try {
      const { error } = await supabase.from('class_schedules').insert({
        class_id: classId,
        teacher_id: teacherId,
        weekday: Number(weekday),
        period,
        start_time: startTime,
        remind_before_min: Math.min(60, Math.max(0, Math.floor(remindBefore) || 0)),
      });

      if (error) {
        if (error.code === '23505') {
          toast.error('這位教師這一天的這一節已經設定過了。');
        } else if (error.code === '42501') {
          toast.error('這位教師還沒有被指派到這個班，或你沒有權限設定課表。請先在「指派導師與科任老師」加入教師。');
        } else {
          toastError(error, '新增失敗。請稍後再試。');
        }
        return;
      }
      toast.success('已加入課表');
      await load();
      onChanged?.();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('class_schedules').delete().eq('id', id);
    if (error) {
      toastError(error, '刪除失敗。請稍後再試。');
      return;
    }
    await load();
    onChanged?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{className}　每週點名時間</DialogTitle>
          <DialogDescription>
            設定每位老師每週哪一天、哪一節要點名。時間快到時，老師的網頁會提醒他，並讓他一鍵開始點名（提醒只在網頁開著時出現）。
          </DialogDescription>
        </DialogHeader>

        {teachers.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            這個班還沒有指派任何教師。請先到「指派導師與科任老師」把教師加入這個班級，再回來設定時間。
          </p>
        ) : (
        <form onSubmit={handleAdd} className="space-y-4 border-t border-border pt-4">
          <div className="space-y-2">
            <Label htmlFor="sch-teacher">哪位老師</Label>
            <Select value={teacherId} onValueChange={setTeacherId}>
              <SelectTrigger id="sch-teacher">
                <SelectValue placeholder="選擇教師" />
              </SelectTrigger>
              <SelectContent>
                {teachers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="sch-weekday">星期</Label>
              <Select value={weekday} onValueChange={setWeekday}>
                <SelectTrigger id="sch-weekday">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(WEEKDAY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sch-period">節次</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger id="sch-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sch-start">上課時間</Label>
              <Input
                id="sch-start"
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sch-remind">提前幾分鐘提醒</Label>
              <Input
                id="sch-remind"
                type="number"
                min={0}
                max={60}
                value={remindBefore}
                onChange={(e) => setRemindBefore(parseInt(e.target.value, 10) || 0)}
              />
            </div>
          </div>
          <Button type="submit" disabled={saving} className="w-full sm:w-auto">
            {saving && <Spinner />}
            加入課表
          </Button>
        </form>
        )}

        {items.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            這個班還沒有設定任何點名時間。
          </p>
        ) : (
          <ScrollArea className="rounded-md border border-border" viewportClassName="max-h-56">
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 text-foreground">
                    <span className="font-bold">{WEEKDAY_LABELS[item.weekday]}</span>
                    <span className="mx-2 text-muted-foreground">{periodLabel(item.period)}</span>
                    <span className="tabular">{formatTime(item.start_time)}</span>
                    <span className="ml-2 font-medium">{teacherName(item.teacher_id)}</span>
                    <span className="ml-2 text-muted-foreground">提前 {item.remind_before_min} 分鐘提醒</span>
                  </span>
                  <IconButton label="刪除這個時間" onClick={() => handleDelete(item.id)}>
                    <Trash2 aria-hidden="true" />
                  </IconButton>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
