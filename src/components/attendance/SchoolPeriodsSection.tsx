import * as React from 'react';
import { supabase } from '@/lib/supabase';
import { PERIOD_OPTIONS, periodLabel } from '@/lib/periods';
import { formatTime } from '@/lib/schedule';
import { toastError } from '@/lib/errors';
import type { SchoolPeriod } from '@/types/database';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

/** School-wide rollcall times: set once, applied to every class and teacher (Mon-Fri) */
export function SchoolPeriodsSection({ schoolId }: { schoolId: string }) {
  const [items, setItems] = React.useState<SchoolPeriod[]>([]);
  const [period, setPeriod] = React.useState('1');
  const [startTime, setStartTime] = React.useState('08:00');
  const [remindBefore, setRemindBefore] = React.useState(5);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    const { data, error } = await supabase
      .from('school_periods')
      .select('*')
      .eq('school_id', schoolId)
      .order('start_time', { ascending: true });
    if (error) {
      toastError(error, '讀取點名時間失敗。請重新整理頁面。');
      return;
    }
    setItems((data || []) as SchoolPeriod[]);
  }, [schoolId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startTime) return;
    setSaving(true);
    const { error } = await supabase.from('school_periods').insert({
      school_id: schoolId,
      period,
      start_time: startTime,
      remind_before_min: Math.min(60, Math.max(0, Math.floor(remindBefore) || 0)),
    });
    setSaving(false);
    if (error) {
      if (error.code === '23505') toast.error('這一節已經設定過了。要改時間請先刪除再重新加入。');
      else toastError(error, '新增失敗。請稍後再試。');
      return;
    }
    toast.success('已加入點名時間');
    await load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('school_periods').delete().eq('id', id);
    if (error) {
      toastError(error, '刪除失敗。請稍後再試。');
      return;
    }
    await load();
  };

  return (
    <section className="space-y-4" data-tour="sa-schedule">
      <h2 className="font-display text-lg font-bold text-foreground">全校點名時間</h2>
      <p className="text-sm text-muted-foreground">
        設定一次，全校所有班級與老師每週一到週五都會套用。時間快到時，老師的網頁會提醒他點名。
      </p>

      <form onSubmit={handleAdd} className="space-y-4">
        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="sp-period">節次</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger id="sp-period">
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
            <Label htmlFor="sp-start">上課時間</Label>
            <Input id="sp-start" type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sp-remind">提前幾分鐘提醒</Label>
            <Input
              id="sp-remind"
              type="number"
              min={0}
              max={60}
              value={remindBefore}
              onChange={(e) => setRemindBefore(parseInt(e.target.value, 10) || 0)}
            />
          </div>
        </div>
        <Button type="submit" disabled={saving}>
          {saving && <Spinner />}
          加入點名時間
        </Button>
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">還沒有設定任何點名時間。</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="text-foreground">
                <span className="font-bold">{periodLabel(item.period)}</span>
                <span className="tabular ml-3">{formatTime(item.start_time)}</span>
                <span className="ml-3 text-muted-foreground">提前 {item.remind_before_min} 分鐘提醒</span>
              </span>
              <IconButton label="刪除這個時間" onClick={() => handleDelete(item.id)}>
                <Trash2 aria-hidden="true" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
