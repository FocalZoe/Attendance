import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Camera, School, ArrowLeft, ShieldCheck, AlertCircle } from 'lucide-react';

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
    const password = (formData.get('password') as string)?.trim();
    const phone = (formData.get('phone') as string)?.trim() || null;

    if (!schoolName || !schoolCode || !adminName || !email || !password) {
      setErrorMsg('請完整填寫學校資訊與管理員帳號資料');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setErrorMsg('密碼長度至少需 6 個字元');
      setLoading(false);
      return;
    }

    try {
      // 1. 建立或確認 Auth 使用者身分
      let authUser = null;
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: adminName,
            role: 'school_admin',
            phone,
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.toLowerCase().includes('already registered')) {
          // 信箱已存在，嘗試以現有密碼登入
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (signInError) {
            setErrorMsg('此信箱已註冊，且密碼校驗不符，請確認密碼或使用登入頁面。');
            setLoading(false);
            return;
          }
          authUser = signInData.user;
        } else {
          setErrorMsg(signUpError.message || '註冊認證帳號失敗');
          setLoading(false);
          return;
        }
      } else {
        authUser = signUpData.user;
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

      if (rpcError) {
        // Fallback: 若資料庫尚未載入 RPC，執行前端多步容錯
        const { data: existingSchool } = await supabase
          .from('schools')
          .select('id')
          .eq('code', schoolCode)
          .maybeSingle();

        let targetSchoolId = '';
        if (existingSchool) {
          targetSchoolId = existingSchool.id;
        } else {
          const { data: newSchool, error: schoolCreateErr } = await supabase
            .from('schools')
            .insert({ name: schoolName, code: schoolCode })
            .select('id')
            .single();

          if (schoolCreateErr || !newSchool) {
            setErrorMsg(schoolCreateErr?.message || rpcError.message);
            setLoading(false);
            return;
          }
          targetSchoolId = newSchool.id;
        }

        if (authUser) {
          await supabase.from('profiles').upsert({
            id: authUser.id,
            school_id: targetSchoolId,
            role: 'school_admin',
            name: adminName,
            email,
            phone,
          });
        }
      }

      // 3. 立即重整全域 Profile 狀態並直接導向控制台
      await refreshProfile();
      navigate('/dashboard/school-admin');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '開通學校時發生未預期錯誤';
      setErrorMsg(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <Link to="/" className="flex items-center justify-center space-x-2.5 mb-4 group">
          <div className="w-10 h-10 rounded-md bg-blue-600 flex items-center justify-center text-white transition-transform group-hover:scale-105">
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
              填寫您的學校單位資訊與管理員憑證，完成即刻建立獨立專屬校務租戶
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
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-school-name">學校全銜</Label>
                    <Input
                      id="reg-school-name"
                      name="school_name"
                      required
                      placeholder="例如：國立示範高級中學"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-school-code">學校代碼 (英文縮寫)</Label>
                    <Input
                      id="reg-school-code"
                      name="school_code"
                      required
                      placeholder="例如：DEMO-HS"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  * 提示：輸入由系統總管預建之「既有學校代碼」將直接加入該校主管團隊；若輸入新代碼將自動建立新機構。
                </p>
              </div>

              {/* 學校管理員帳號資訊 */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>第二步：學校主管個人資訊</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-admin-name">管理主管姓名</Label>
                    <Input
                      id="reg-admin-name"
                      name="admin_name"
                      required
                      placeholder="例如：張教務主任"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-admin-phone">公務聯絡電話 (選填)</Label>
                    <Input
                      id="reg-admin-phone"
                      name="phone"
                      placeholder="例如：02-12345678#101"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-admin-email">登入電子信箱 (Email)</Label>
                    <Input
                      id="reg-admin-email"
                      name="email"
                      type="email"
                      required
                      placeholder="admin@school.edu.tw"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-admin-password">設定密碼</Label>
                    <Input
                      id="reg-admin-password"
                      name="password"
                      type="password"
                      required
                      placeholder="至少 6 個字元"
                    />
                  </div>
                </div>
              </div>

              <Button type="submit" variant="default" className="w-full mt-2" disabled={loading}>
                {loading ? '機構開通處理中...' : '確認開通並登入控制台'}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex justify-between text-xs text-slate-500">
            <Link to="/" className="inline-flex items-center hover:text-slate-800">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> 回首頁
            </Link>
            <Link to="/login" className="hover:text-blue-600 font-medium">
              已有開通帳號？前往登入 →
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
