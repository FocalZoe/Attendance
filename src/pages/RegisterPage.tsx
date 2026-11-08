import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { PublicShell } from '@/components/layout/public-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { InlineAlert } from '@/components/ui/inline-alert';
import { validatePassword } from '@/lib/password';
import { Label } from '@/components/ui/label';

export function RegisterPage() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuthStore();
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const schoolName = (formData.get('school_name') as string)?.trim();
    const schoolCode = (formData.get('school_code') as string)?.trim().toUpperCase();
    const adminName = (formData.get('admin_name') as string)?.trim();
    const email = (formData.get('email') as string)?.trim().toLowerCase();
    const password = formData.get('password') as string;
    const phone = (formData.get('phone') as string)?.trim() || null;

    if (!schoolName || !schoolCode || !adminName || !email || !password) {
      setErrorMsg('還有欄位沒填。請填寫學校資訊與管理者帳號的必填欄位。');
      setLoading(false);
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setErrorMsg(passwordError);
      setLoading(false);
      return;
    }

    try {
      // 1. 建立或確認 Auth 使用者身分
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: adminName,
            phone,
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.toLowerCase().includes('already registered')) {
          // 信箱已存在，嘗試以現有密碼登入
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (signInError) {
            setErrorMsg('這個信箱已經註冊過，但密碼不符。請輸入原本的密碼，或到登入頁使用「忘記密碼」。');
            setLoading(false);
            return;
          }
        } else {
          setErrorMsg(signUpError.message || '建立帳號失敗。請稍後再試。');
          setLoading(false);
          return;
        }
      } else {
        if (!signUpData.session) {
          // 若無自動返回 Session，執行一次登入
          await supabase.auth.signInWithPassword({ email, password });
        }
      }

      // 2. 呼叫資料庫安全 RPC 進行原子化學校檢查/建立與主管綁定
      const { error: rpcError } = await supabase.rpc('register_school_admin', {
        p_school_name: schoolName,
        p_school_code: schoolCode,
        p_admin_name: adminName,
        p_phone: phone,
      });

      // 角色與學校綁定僅能由伺服器端 RPC 授予，不提供前端寫入的備援路徑
      if (rpcError) {
        setErrorMsg(rpcError.message || '開通學校失敗。請稍後再試。');
        setLoading(false);
        return;
      }

      // 3. 立即重整全域 Profile 狀態並直接導向控制台
      await refreshProfile();
      navigate('/dashboard/school-admin');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '開通學校時發生未預期的錯誤。請稍後再試。';
      setErrorMsg(msg);
      setLoading(false);
    }
  };

  return (
    <PublicShell width="wide">
      <h1 className="text-3xl font-bold text-foreground">開通學校</h1>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        建立學校與第一位學校主管。完成後可立即新增班級、教師與學生名冊。
      </p>

      {errorMsg && <InlineAlert className="mt-6">{errorMsg}</InlineAlert>}

      <form onSubmit={handleSubmit} className="mt-8 space-y-10">
        <fieldset className="space-y-4">
          <legend className="border-b border-border pb-2 font-display text-lg font-bold text-foreground w-full">
            學校資訊
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="reg-school-name">學校全名</Label>
              <Input id="reg-school-name" name="school_name" required placeholder="例如：示範高級中學" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-school-code">學校代碼</Label>
              <Input id="reg-school-code" name="school_code" required placeholder="例如：DEMO-HS" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            學校代碼由英文與數字組成，之後用來辨識學校。如果代碼已被使用，請聯繫系統總管，由總管指派你為主管。
          </p>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="border-b border-border pb-2 font-display text-lg font-bold text-foreground w-full">
            學校主管帳號
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="reg-admin-name">姓名</Label>
              <Input id="reg-admin-name" name="admin_name" required placeholder="例如：張主任" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-admin-phone">聯絡電話（選填）</Label>
              <Input id="reg-admin-phone" name="phone" type="tel" placeholder="例如：02-12345678" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-admin-email">登入信箱</Label>
              <Input
                id="reg-admin-email"
                name="email"
                type="email"
                autoComplete="username"
                required
                placeholder="admin@school.edu.tw"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-admin-password">密碼</Label>
              <PasswordInput
                id="reg-admin-password"
                name="password"
                autoComplete="new-password"
                required
                placeholder="至少 6 個字元"
              />
            </div>
          </div>
        </fieldset>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="submit" size="lg" disabled={loading}>
            {loading ? '開通中' : '開通學校'}
          </Button>
          <p className="text-sm text-muted-foreground">
            已經有帳號？{' '}
            <Link to="/login" className="font-medium text-primary underline underline-offset-4">
              直接登入
            </Link>
          </p>
        </div>
      </form>
    </PublicShell>
  );
}
