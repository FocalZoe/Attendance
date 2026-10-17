'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { registerSchoolAction } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Camera, School, ArrowLeft, ShieldCheck, AlertCircle } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await registerSchoolAction(null, formData);

    if (!result.success) {
      setErrorMsg(result.error || '開通學校單位失敗，請檢查資料後重試。');
      setLoading(false);
      return;
    }

    // 開通與登入成功後，導向控制台
    router.push('/dashboard');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <Link href="/" className="flex items-center justify-center space-x-2.5 mb-4 group">
          <div className="w-10 h-10 rounded-md bg-blue-600 flex items-center justify-center text-white">
            <Camera className="w-6 h-6" />
          </div>
          <span className="font-extrabold text-xl tracking-tight text-slate-900">
            班級自動化點名系統
          </span>
        </Link>
        <p className="text-center text-sm font-medium text-slate-500">
          現代化校園智慧出勤平台 · 開通學校機構單位
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-xl px-4">
        <Card className="border-slate-300 shadow-none">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-2">
              <School className="w-5 h-5" />
            </div>
            <CardTitle className="text-xl">開通學校機構與管理主管帳號</CardTitle>
            <CardDescription>
              填寫您的學校單位資訊與第一位學校管理員憑證，完成即刻建立獨立專屬校務租戶
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
              {/* 學校單位基本資訊 */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <School className="w-4 h-4 text-emerald-600" />
                  <span>第一步：學校單位資訊</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="學校全銜"
                    name="school_name"
                    required
                    placeholder="例如：國立示範高級中學"
                  />
                  <Input
                    label="學校代碼 (英文縮寫)"
                    name="school_code"
                    required
                    placeholder="例如：DEMO-HS"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  * 提示：輸入由系統總管預建之「既有學校代碼」將直接加入該校主管團隊；若輸入新代碼將自動建立新機構。
                </p>
              </div>

              {/* 學校管理員帳號資訊 */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>第二步：主管帳號資訊</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="主管姓名"
                    name="admin_name"
                    required
                    placeholder="例如：林學務長"
                  />
                  <Input
                    label="公務聯絡電話"
                    name="phone"
                    placeholder="例如：02-23456789"
                  />
                </div>
                <Input
                  label="公務信箱 (登入帳號)"
                  name="email"
                  type="email"
                  required
                  placeholder="admin@school.edu.tw"
                />
                <Input
                  label="設定登入密碼"
                  name="password"
                  type="password"
                  required
                  placeholder="請輸入至少 6 位數之安全密碼"
                />
              </div>

              <Button type="submit" variant="primary" className="w-full mt-2" disabled={loading}>
                {loading ? '建立中，請稍候...' : '確認開通學校單位並登入'}
              </Button>
            </form>

            <div className="pt-2 text-center text-xs text-slate-500">
              已有學校主管或教師帳號？{' '}
              <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-800 underline">
                直接由此登入
              </Link>
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
