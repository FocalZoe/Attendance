import * as React from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { Navbar } from '@/components/ui/navbar';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Camera, Grid3X3, Users, Clock, CheckCircle2, ChevronRight, School } from 'lucide-react';
import type { SchoolClass, AttendanceSession } from '@/types/database';

export function TeacherDashboard() {
  const { profile } = useAuthStore();
  const schoolId = profile?.school_id;

  const [classes, setClasses] = React.useState<SchoolClass[]>([]);
  const [sessions, setSessions] = React.useState<(AttendanceSession & { class?: { name: string } })[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadData() {
      if (!profile) return;
      try {
        const [classesRes, sessionsRes] = await Promise.all([
          schoolId
            ? supabase.from('classes').select('*').eq('school_id', schoolId).order('name', { ascending: true })
            : Promise.resolve({ data: [] }),
          supabase
            .from('attendance_sessions')
            .select('*, class:classes(name)')
            .eq('teacher_id', profile.id)
            .order('created_at', { ascending: false })
            .limit(5),
        ]);

        if (classesRes.data) {
          setClasses(classesRes.data);
        }
        if (sessionsRes.data) {
          setSessions(sessionsRes.data as (AttendanceSession & { class?: { name: string } })[]);
        }
      } catch (err) {
        console.error('載入教師數據失敗:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [profile, schoolId]);

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
                {profile?.name || '專任'} 老師的教學控制台
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              所屬學校：{profile?.school?.name || '公立學校租戶'} · 即時點名與出缺勤管理
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex items-center space-x-3">
            <Button variant="default">
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
                  管理座位表 <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </span>
                <Badge variant="success">劃位配置</Badge>
              </div>
            </div>
          </Card>

          <Card className="border-slate-300 hover:border-purple-500 transition-colors">
            <div className="flex flex-col h-full justify-between">
              <div>
                <div className="w-10 h-10 rounded-md bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 mb-4">
                  <Users className="w-5 h-5" />
                </div>
                <CardTitle className="text-base">班級學生出勤名冊</CardTitle>
                <CardDescription className="mt-1">
                  調閱所授課班級之點名歷史紀錄、覆核補正狀態與缺席照片留存存證。
                </CardDescription>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-purple-600 flex items-center">
                  查閱名冊 <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </span>
                <Badge variant="outline">名冊統計</Badge>
              </div>
            </div>
          </Card>
        </div>

        {/* 授課班級與近期點名場次 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="border-slate-300">
            <CardHeader className="pb-3 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">校內授課班級 ({classes.length})</CardTitle>
                <Badge variant="outline">點名快捷鍵</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 text-center text-slate-500 text-xs">載入中...</div>
              ) : classes.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs">
                  目前尚未配置任何班級，請聯繫學校主管建立班級。
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {classes.map((c) => (
                    <div key={c.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div>
                        <span className="font-bold text-sm text-slate-900">{c.name}</span>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {c.academic_year} 學年 · {c.grade}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm" className="text-xs">
                          <Grid3X3 className="w-3.5 h-3.5 mr-1" /> 劃位
                        </Button>
                        <Button variant="default" size="sm" className="text-xs">
                          <Camera className="w-3.5 h-3.5 mr-1" /> 點名
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-300">
            <CardHeader className="pb-3 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">近期課堂點名場次</CardTitle>
                <Clock className="w-4 h-4 text-slate-400" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 text-center text-slate-500 text-xs">載入中...</div>
              ) : sessions.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs">
                  目前尚無點名記錄。點擊上方「啟動視訊鏡頭點名」開始第一堂點名。
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {sessions.map((s) => (
                    <div key={s.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-slate-900">
                            {s.class?.name || '未知班級'}
                          </span>
                          <span className="text-xs font-mono text-slate-500">{s.session_date}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          節次：{s.period || '標準課堂'}
                        </div>
                      </div>
                      <Badge variant="success">已完成</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
