import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { supabase } from '@/lib/supabase';
import { PublicShell } from '@/components/layout/public-shell';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { InlineAlert } from '@/components/ui/inline-alert';

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAuthStore();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [errorMsg, setErrorMsg] = React.useState('');
  const [infoMsg, setInfoMsg] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [resetSending, setResetSending] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);

    try {
      const result = await signIn(email, password);

      if (!result.success) {
        setErrorMsg(result.error || '信箱或密碼不正確。請確認後再試一次，或使用「忘記密碼」重設。');
        setLoading(false);
        return;
      }

      navigate(result.redirectTo || '/dashboard');
    } catch {
      setErrorMsg('無法連線到伺服器。請檢查網路後再試一次。');
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setErrorMsg('');
    setInfoMsg('');
    const target = email.trim();
    if (!target) {
      setErrorMsg('請先在上方輸入電子信箱，再按「忘記密碼」。');
      return;
    }

    setResetSending(true);
    try {
      await supabase.auth.resetPasswordForEmail(target, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    } catch (err) {
      console.error('寄送重設密碼信失敗:', err);
    } finally {
      setResetSending(false);
      // 不論信箱是否存在皆顯示相同訊息，避免洩漏帳號是否註冊
      setInfoMsg('如果這個信箱已註冊，重設密碼的連結會寄到該信箱。請到信箱點選連結。');
    }
  };

  return (
    <PublicShell>
      <h1 className="text-3xl font-bold text-foreground">帳號登入</h1>
      <p className="mt-2 text-sm text-muted-foreground">使用學校提供的信箱與密碼登入。</p>

      <div className="mt-6 space-y-4">
        {errorMsg && <InlineAlert tone="error">{errorMsg}</InlineAlert>}
        {infoMsg && <InlineAlert tone="success">{infoMsg}</InlineAlert>}
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="login-email">電子信箱</Label>
          <Input
            id="login-email"
            name="email"
            type="email"
            autoComplete="username"
            required
            placeholder="teacher@school.edu.tw"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password">密碼</Label>
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={resetSending}
              className="inline-flex h-8 items-center text-sm text-primary underline underline-offset-4 hover:no-underline disabled:opacity-50"
            >
              {resetSending && <Spinner className="mr-1" />}
              忘記密碼
            </button>
          </div>
          <PasswordInput
            id="login-password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading && <Spinner />}
          登入
        </Button>
      </form>

      <div className="mt-8 space-y-2 border-t border-border pt-6 text-sm text-muted-foreground">
        <p>
          學校還沒有帳號？{' '}
          <Link to="/register" className="font-medium text-primary underline underline-offset-4">
            開通學校
          </Link>
        </p>
        <p>
          你是家長？{' '}
          <Link to="/parent-query" className="font-medium text-primary underline underline-offset-4">
            查詢孩子的出勤
          </Link>
        </p>
      </div>
    </PublicShell>
  );
}
