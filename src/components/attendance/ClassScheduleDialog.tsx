import * as React from 'react';
import { supabase } from '@/lib/supabase';
import { PERIOD_OPTIONS, periodLabel } from '@/lib/periods';
import { WEEKDAY_LABELS, formatTime } from '@/lib/schedule';
import type { ClassSchedule } from '@/types/database';
import { Button } from '@/components/ui/button';
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
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface ClassScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  className: string;
  teacherId: string;
  onChanged?: () => void;
}

export function ClassScheduleDialog({
  open,
  onOpenChange,
  classId,
  className,
  teacherId,
  onChanged,
}: ClassScheduleDialogProps) {
  const [items, setItems] = React.useState<ClassSchedule[]>([]);
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
      .eq('teacher_id', teacherId)
      .order('weekday', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((data || []) as ClassSchedule[]);
  }, [classId, teacherId]);

  React.useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startTime) return;

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
        toast.error(error.code === '23505' ? '此星期與節次已設定過課表' : error.message);
        return;
      }
      toast.success('已新增課表時段');
      await load();
      onChanged?.();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('class_schedules').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await load();
    onChanged?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-6 bg-white border border-slate-300">
        <DialogHeader className="border-b border-slate-200 pb-3">
          <DialogTitle className="text-base font-bold text-slate-800">
            課表與點名提醒 · {className}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            開著本系統時，到點前會跳出提醒並可一鍵進入點名（不會自動開啟鏡頭）。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleAdd} className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end pt-2">
          <div className="space-y-1">
            <Label className="text-xs">星期</Label>
            <Select value={weekday} onValueChange={setWeekday}>
              <SelectTrigger className="h-8 text-xs">
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
          <div className="space-y-1">
            <Label className="text-xs">節次</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-8 text-xs">
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
          <div className="space-y-1">
            <Label className="text-xs">開始時間</Label>
            <Input
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">提前提醒 (分)</Label>
            <Input
              type="number"
              min={0}
              max={60}
              value={remindBefore}
              onChange={(e) => setRemindBefore(parseInt(e.target.value, 10) || 0)}
              className="h-8 text-xs"
            />
          </div>
          <Button type="submit" size="sm" className="col-span-2 sm:col-span-4 text-xs" disabled={saving}>
            {saving ? '新增中...' : '新增時段'}
          </Button>
        </form>

        <div className="border border-slate-200 rounded divide-y divide-slate-100 max-h-56 overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">尚未設定課表時段</div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50">
                <span className="text-slate-800">
                  <span className="font-bold">{WEEKDAY_LABELS[item.weekday]}</span>
                  <span className="mx-2 text-slate-400">·</span>
                  {periodLabel(item.period)}
                  <span className="mx-2 text-slate-400">·</span>
                  {formatTime(item.start_time)}
                  <span className="ml-2 text-slate-500">（提前 {item.remind_before_min} 分提醒）</span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(item.id)}
                  className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600"
                  aria-label="刪除此時段"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
