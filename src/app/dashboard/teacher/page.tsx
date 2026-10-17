import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Navbar } from '@/components/ui/navbar';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Camera, Grid3X3, Users, Clock, CheckCircle2, ChevronRight, School } from 'lucide-react';
import type { SchoolClass, AttendanceSession } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function TeacherDashboard() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect('/login');
  }

  const supabase = await createClient();

  // 取得該校或指派給該教師的班級
  const schoolId = profile.school_id;
  const { data: classesData } = schoolId
    ? await supabase
        .from('classes')
        .select('*')
        .eq('school_id', schoolId)
        .order('name', { ascending: true })
    : { data: [] };

  const classes: SchoolClass[] = classesData || [];

  // 取得該教師近期的點名場次
  const { data: sessionsData } = await supabase
    .from('attendance_sessions')
    .select('*, class:classes(name)')
    .eq('teacher_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(5);

  const sessions: (AttendanceSession & { class?: { name: string } })[] = sessionsData || [];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar profile={profile} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* 歡迎與快捷操作標題 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {profile.name} 老師的教學控制台
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              所屬學校：{profile.school?.name || '公立學校租戶'} · 即時點名與出缺勤管理
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex items-center space-x-3">
            <Button variant="primary">
              <Camera className="w-4 h-4 mr-2" />
              啟動視訊鏡頭點名
            </Button>
          </div>
        </div>

        {/* 快捷功能卡片列 (Flat Design) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Card className="border-slate-300 hover:border-blue-500 transition-colors">
            <div className="flex flex-col h-full justify-between">
              <div>
                <div className="w-10 h-10 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-4">
                  <Camera className="w-5 h-5" />
                </div>
                <CardTitle className="text-base">AI 視訊即時點名</CardTitle>
                <CardDescription className="mt-1">
                  連接教室視訊鏡頭或使用內建攝影機，一鍵擷取畫格由瀏覽器端 AI 自動辨識座位上是否有人。
                </CardDescription>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-600 flex items-center">
                  準備點名 <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </span>
                <Badge variant="info">即時點名</Badge>
              </div>
            </div>
          </Card>

          <Card className="border-slate-300 hover:border-emerald-500 transition-colors">
            <div className="flex flex-col h-full justify-between">
              <div>
                <div className="w-10 h-10 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-4">
                  <Grid3X3 className="w-5 h-5" />
                </div>
                <CardTitle className="text-base">教室座位劃位系統</CardTitle>
                <CardDescription className="mt-1">
                  以鏡頭畫面或 16:9 畫布為底圖，自定義拉框標記學生座位，支援跨教師即時共用。
                </CardDescription>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-600 flex items-center">
                  編輯劃位表 <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </span>
                <Badge variant="success">劃位配置</Badge>
              </div>
            </div>
          </Card>

          <Card className="border-slate-300 hover:border-amber-500 transition-colors">
            <div className="flex flex-col h-full justify-between">
              <div>
                <div className="w-10 h-10 rounded-md bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4">
                  <Users className="w-5 h-5" />
                </div>
                <CardTitle className="text-base">班級與名冊管理</CardTitle>
                <CardDescription className="mt-1">
                  匯入教育部標準格式 CSV 或 Excel 名冊，維護學生學號、座號與家長聯絡資訊。
                </CardDescription>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-600 flex items-center">
                  檢視名冊 <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </span>
                <Badge variant="warning">學生名冊</Badge>
              </div>
            </div>
          </Card>
        </div>

        {/* 下半部：任教班級總覽與近期點名軌跡 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 左側：任教班級列表 */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="border-slate-300">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center">
                    <School className="w-4 h-4 mr-2 text-slate-700" />
                    校內授課班級
                  </CardTitle>
                  <Badge variant="outline">{classes.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {classes.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-200 rounded">
                    目前尚未建立班級，可聯繫學校管理員配置
                  </p>
                ) : (
                  classes.map((cls) => (
                    <div
                      key={cls.id}
                      className="p-3 bg-white border border-slate-200 rounded-md flex items-center justify-between hover:border-slate-400 transition-colors"
                    >
                      <div>
                        <p className="font-bold text-sm text-slate-900">{cls.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {cls.grade} · {cls.academic_year}學年度
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        進入班級
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* 右側：近期點名存證軌跡 */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="border-slate-300">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center">
                      <Clock className="w-4 h-4 mr-2 text-blue-600" />
                      最近點名紀錄存證
                    </CardTitle>
                    <CardDescription>
                      每次點名皆留存畫格截圖與 AI 判定 JSON，供稽核與複查
                    </CardDescription>
                  </div>
                  <Badge variant="default" className="bg-slate-900 text-white">
                    不可篡改存證
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {sessions.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
                    <CheckCircle2 className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700">尚無點名場次紀錄</p>
                    <p className="text-xs text-slate-400 mt-1">
                      當您開啟鏡頭並完成點名後，紀錄將即時保存至 Supabase 資料庫
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sessions.map((sess) => (
                      <div
                        key={sess.id}
                        className="p-3.5 bg-slate-50 border border-slate-200 rounded-md flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-sm text-slate-900">
                              {sess.class?.name || '授課班級'}
                            </span>
                            <span className="text-xs text-slate-500">
                              {sess.period || '一般時段'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            日期：{sess.session_date} · 建立時間：
                            {new Date(sess.created_at).toLocaleTimeString('zh-TW')}
                          </p>
                        </div>
                        <Badge variant="success">已存證</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
