import * as React from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { toastError } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const EMPTY_FORM = { student_number: '', name: '', seat_number: 1, gender: '未填', parent_phone: '' };

interface StudentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string | null | undefined;
  classId: string;
  title: string;
  /** Seat number pre-filled each time the dialog opens */
  nextSeat: number;
  onCreated: () => void;
}

/** Add-one-student dialog shared by the teacher page and the school admin page */
export function StudentFormDialog({ open, onOpenChange, schoolId, classId, title, nextSeat, onCreated }: StudentFormDialogProps) {
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) setForm({ ...EMPTY_FORM, seat_number: nextSeat });
    // Only reset when the dialog opens, not when the roster size changes while it is open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId || !schoolId) return;

    // The parent lookup compares the last 4 digits, so the number needs at least 4 digits
    if (form.parent_phone.replace(/\D/g, '').length < 4) {
      toast.error('家長電話至少要有 4 個數字。');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('students').insert({
        school_id: schoolId,
        class_id: classId,
        student_number: form.student_number.trim(),
        name: form.name.trim(),
        seat_number: Number(form.seat_number),
        gender: form.gender,
        parent_phone: form.parent_phone.trim(),
      });
      if (error) throw error;

      toast.success('已新增學生');
      onOpenChange(false);
      onCreated();
    } catch (err: unknown) {
      toastError(err, '新增學生失敗。請確認學號沒有重複後再試一次。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sf-seat">座號</Label>
              <Input
                id="sf-seat"
                autoFocus
                type="number"
                required
                min={1}
                value={form.seat_number}
                onChange={(e) => setForm((prev) => ({ ...prev, seat_number: parseInt(e.target.value) || 1 }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sf-number">學號</Label>
              <Input
                id="sf-number"
                required
                placeholder="S113001"
                value={form.student_number}
                onChange={(e) => setForm((prev) => ({ ...prev, student_number: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sf-name">姓名</Label>
              <Input
                id="sf-name"
                required
                placeholder="林小明"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sf-gender">性別</Label>
              <Select value={form.gender} onValueChange={(val) => setForm((prev) => ({ ...prev, gender: val }))}>
                <SelectTrigger id="sf-gender">
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

          <div className="space-y-2">
            <Label htmlFor="sf-phone">家長聯絡電話</Label>
            <Input
              id="sf-phone"
              required
              type="tel"
              pattern="[0-9+\- ()]*"
              title="只能填數字、空格與「-」"
              placeholder="0912345678"
              value={form.parent_phone}
              onChange={(e) => setForm((prev) => ({ ...prev, parent_phone: e.target.value }))}
            />
            <p className="text-sm text-muted-foreground">電話末四碼會用於家長查勤驗證。</p>
          </div>

          <DialogFooter className="gap-2 sm:space-x-0">
            <Button type="submit" disabled={saving}>
              新增學生
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
