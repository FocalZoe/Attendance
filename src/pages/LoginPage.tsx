import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Camera, ArrowLeft, AlertCircle, LogIn } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAuthStore();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [errorMsg, setErrorMsg] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const result = await signIn(email, password);

      if (!result.success) {
        setErrorMsg(result.error || '帳號或密碼錯誤，請重新確認');
        setLoading(false);
        return;
      }

      // 登入成功，導向指定控制台路由
      navigate(result.redirectTo || '/dashboard');
    } catch {
      setErrorMsg('認證過程發生未預期錯誤，請檢查網路連線或稍後再試。');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="flex items-center justify-center space-x-2.5 mb-4 group">
          <div className="w-10 h-10 rounded-md bg-blue-600 flex items-center justify-center text-white transition-transform group-hover:scale-105">
            <Camera className="w-6 h-6" />
          </div>
          <span className="font-extrabold text-xl tracking-tight text-slate-900">
            班級自動化點名系統
          </span>
        </Link>
        <p className="text-center text-sm font-medium text-slate-500">
          現代化校園智慧出勤平台 · 教職員後台登入
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <Card className="border-slate-300 shadow-none">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-2">
              <LogIn className="w-5 h-5" />
            </div>
            <CardTitle className="text-xl">教職員登入</CardTitle>
            <CardDescription>
              請輸入公務 Email 或系統總管帳號以進入管理控制台
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-4">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-md flex items-start space-x-2 text-rose-700 text-sm font-medium">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="電子信箱 (Email)"
                name="email"
                type="email"
                required
                placeholder="teacher@school.edu.tw 或 sysadmin@..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <Input
                label="密碼"
                name="password"
                type="password"
                required
                placeholder="請輸入密碼"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <Button type="submit" variant="primary" className="w-full mt-2" disabled={loading}>
                {loading ? '驗證登入中...' : '登入系統'}
              </Button>
            </form>

            <div className="pt-2 text-center text-xs text-slate-500">
              新設學校機構尚未開通？{' '}
              <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-800 underline">
                前往開通學校單位
              </Link>
            </div>
          </CardContent>

          <CardFooter className="flex justify-between text-xs text-slate-500">
            <Link to="/" className="inline-flex items-center hover:text-slate-800">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> 回首頁
            </Link>
            <Link to="/parent-query" className="hover:text-blue-600 font-medium">
              家長查勤入口 →
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
