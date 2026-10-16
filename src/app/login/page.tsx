'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Camera, ArrowLeft, Shield, School, User, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isRegister, setIsRegister] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [name, setName] = React.useState('');
  const [role, setRole] = React.useState<'sys_admin' | 'school_admin' | 'teacher'>('teacher');
  const [errorMsg, setErrorMsg] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (isRegister) {
        // 註冊帳號並將角色及姓名寫入 metadata（由 Supabase Trigger 自動同步建立 Profile）
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
              role,
            },
          },
        });

        if (error) {
          setErrorMsg(error.message);
          setLoading(false);
          return;
        }

        // 登入成功後跳轉控制台
        router.push('/dashboard');
        router.refresh();
      } else {
        // 登入
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setErrorMsg(error.message);
          setLoading(false);
          return;
        }

        router.push('/dashboard');
        router.refresh();
      }
    } catch {
      setErrorMsg('認證過程發生未預期錯誤，請檢查網路連線或稍後再試。');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex items-center justify-center space-x-2.5 mb-4 group">
          <div className="w-10 h-10 rounded-md bg-blue-600 flex items-center justify-center text-white">
            <Camera className="w-6 h-6" />
          </div>
          <span className="font-extrabold text-xl tracking-tight text-slate-900">
            視覺化智慧點名系統
          </span>
        </Link>
        <p className="text-center text-sm font-medium text-slate-500">
          全國專題競賽作品 · 創新與應用整合架構
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <Card className="border-slate-300 shadow-none">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">
              {isRegister ? '建立管理帳號' : '使用者登入'}
            </CardTitle>
            <CardDescription>
              {isRegister
                ? '選擇您的職務角色並填寫帳戶資訊'
                : '請輸入您的公務 Email 與密碼進入後台'}
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
              {isRegister && (
                <>
                  <Input
                    label="姓名 / 稱謂"
                    type="text"
                    required
                    placeholder="例如：張老師、林主任"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />

                  <div className="space-y-1.5 text-left">
                    <label className="block text-sm font-semibold text-slate-700">
                      身分職務
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setRole('teacher')}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-md border text-xs font-semibold cursor-pointer transition-colors ${
                          role === 'teacher'
                            ? 'bg-blue-50 border-blue-600 text-blue-700'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <User className="w-4 h-4 mb-1" />
                        任課教師
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('school_admin')}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-md border text-xs font-semibold cursor-pointer transition-colors ${
                          role === 'school_admin'
                            ? 'bg-blue-50 border-blue-600 text-blue-700'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <School className="w-4 h-4 mb-1" />
                        學校主管
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('sys_admin')}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-md border text-xs font-semibold cursor-pointer transition-colors ${
                          role === 'sys_admin'
                            ? 'bg-blue-50 border-blue-600 text-blue-700'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Shield className="w-4 h-4 mb-1" />
                        系統總管
                      </button>
                    </div>
                  </div>
                </>
              )}

              <Input
                label="電子信箱 (Email)"
                type="email"
                required
                placeholder="teacher@school.edu.tw"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <Input
                label="密碼"
                type="password"
                required
                placeholder="請輸入密碼"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <Button type="submit" variant="primary" className="w-full mt-2" disabled={loading}>
                {loading ? '處理中...' : isRegister ? '建立帳號並登入' : '登入系統'}
              </Button>
            </form>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsRegister(!isRegister);
                  setErrorMsg('');
                }}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline underline-offset-2 cursor-pointer"
              >
                {isRegister ? '已有帳號？切換至直接登入' : '尚未註冊？點此建立新管理帳號'}
              </button>
            </div>
          </CardContent>

          <CardFooter className="flex justify-between text-xs text-slate-500">
            <Link href="/" className="inline-flex items-center hover:text-slate-800">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> 回首頁
            </Link>
            <Link href="/parent-query" className="hover:text-blue-600 font-medium">
              家長查勤入口 →
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
