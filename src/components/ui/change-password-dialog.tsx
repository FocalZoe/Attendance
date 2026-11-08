import * as React from 'react';
import { supabase } from '@/lib/supabase';
import { validatePassword } from '@/lib/password';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
}

export function ChangePasswordDialog({ open, onOpenChange, email }: ChangePasswordDialogProps) {
  const [current, setCurrent] = React.useState('');
  const [next, setNext] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [errorMsg, setErrorMsg] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setCurrent('');
      setNext('');
      setConfirm('');
      setErrorMsg('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg('');

    const invalid = validatePassword(next);
    if (invalid) {
      setErrorMsg(invalid);
      return;
    }
    if (next !== confirm) {
      setErrorMsg('兩次輸入的新密碼不一致');
      return;
    }
    if (next === current) {
      setErrorMsg('新密碼不可與目前密碼相同');
      return;
    }

    setLoading(true);
    try {
      // 先以目前密碼重新驗證身分，避免他人使用遺留的已登入畫面直接改密碼
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (verifyError) {
        setErrorMsg('目前密碼不正確');
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) {
        setErrorMsg(error.message || '修改密碼失敗');
        return;
      }

      toast.success('密碼已更新');
      onOpenChange(false);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : '修改密碼失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <DialogContent className="max-w-sm p-6 bg-white border border-slate-300">
        <DialogHeader className="border-b border-slate-200 pb-3">
          <DialogTitle className="text-base font-bold text-slate-800">修改密碼</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
          {errorMsg && (
            <div className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs font-medium">
              {errorMsg}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="cp-current" className="text-xs">目前密碼</Label>
            <PasswordInput
              id="cp-current"
              required
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-new" className="text-xs">新密碼</Label>
            <PasswordInput
              id="cp-new"
              required
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-confirm" className="text-xs">確認新密碼</Label>
            <PasswordInput
              id="cp-confirm"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className="h-9 text-sm"
            />
          </div>
          <DialogFooter className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={loading}>
              取消
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? '更新中...' : '更新密碼'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
