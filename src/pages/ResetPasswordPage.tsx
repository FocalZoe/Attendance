import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { validatePassword } from '@/lib/password';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { AlertCircle, KeyRound } from 'lucide-react';

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
      setErrorMsg('兩次輸入的密碼不一致');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorMsg(error.message || '重設密碼失敗');
        return;
      }
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : '重設密碼失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="border-slate-300 shadow-none">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-2">
              <KeyRound className="w-5 h-5" />
            </div>
            <CardTitle className="text-xl">重設密碼</CardTitle>
            <CardDescription>請輸入新的登入密碼</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {checked && !ready ? (
              <div className="space-y-3 text-center text-sm text-slate-600">
                <p>重設連結無效或已過期，請回到登入頁重新申請。</p>
                <Link to="/login" className="text-blue-600 underline">
                  回登入頁
                </Link>
              </div>
            ) : (
              <>
                {errorMsg && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-md flex items-start space-x-2 text-rose-700 text-sm font-medium">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="reset-password">新密碼</Label>
                    <PasswordInput
                      id="reset-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reset-password-confirm">確認新密碼</Label>
                    <PasswordInput
                      id="reset-password-confirm"
                      required
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading || !ready}>
                    {loading ? '更新中...' : '更新密碼'}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
