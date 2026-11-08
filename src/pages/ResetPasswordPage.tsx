import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { validatePassword } from '@/lib/password';
import { PublicShell } from '@/components/layout/public-shell';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { InlineAlert } from '@/components/ui/inline-alert';
import { Skeleton } from '@/components/ui/skeleton';
import { friendlyError } from '@/lib/errors';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = React.useState(false);
  const [checked, setChecked] = React.useState(false);
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [errorMsg, setErrorMsg] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  // 重設連結帶回的恢復階段 (recovery session) 由 supabase-js 自動解析 URL 取得
  React.useEffect(() => {
    let active = true;

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        if (active) {
          setReady(true);
          setChecked(true);
        }
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) setReady(true);
      setChecked(true);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg('');

    const invalid = validatePassword(password);
    if (invalid) {
      setErrorMsg(invalid);
      return;
    }
    if (password !== confirm) {
      setErrorMsg('兩次輸入的密碼不一樣。請重新輸入。');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorMsg(friendlyError(error, '更新密碼失敗。請稍後再試。').message);
        return;
      }
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      setErrorMsg(friendlyError(err, '更新密碼失敗。請稍後再試。').message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicShell>
      <h1 className="text-3xl font-bold text-foreground">重設密碼</h1>

      {!checked ? (
        <div className="mt-6 space-y-3" role="status">
          <span className="sr-only">確認重設連結中</span>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : !ready ? (
        <div className="mt-6 space-y-4">
          <InlineAlert>這個重設連結無效或已過期。請回到登入頁，再按一次「忘記密碼」取得新連結。</InlineAlert>
          <Button asChild variant="outline">
            <Link to="/login">回登入頁</Link>
          </Button>
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">輸入新的登入密碼，更新後會直接登入。</p>
          {errorMsg && <InlineAlert className="mt-6">{errorMsg}</InlineAlert>}
          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="reset-password">新密碼</Label>
              <PasswordInput
                id="reset-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-password-confirm">再輸入一次新密碼</Label>
              <PasswordInput
                id="reset-password-confirm"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading && <Spinner />}
              更新密碼
            </Button>
          </form>
        </>
      )}
    </PublicShell>
  );
}
