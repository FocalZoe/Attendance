'use client';

import * as React from 'react';
import Link from 'next/link';
import { queryStudentAttendanceAction } from '@/app/actions/parent-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ParentQueryResult, AttendanceStatus } from '@/types/database';
import { Camera, Search, ArrowLeft, ShieldCheck, AlertCircle, Calendar, Clock, CheckCircle } from 'lucide-react';

export default function ParentQueryPage() {
  const [studentNumber, setStudentNumber] = React.useState('');
  const [phoneLast4, setPhoneLast4] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState('');
  const [result, setResult] = React.useState<ParentQueryResult | null>(null);

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await queryStudentAttendanceAction(studentNumber, phoneLast4);
      if (!res.success) {
        setErrorMsg(res.message || '查無此學生紀錄或校驗未通過');
        setResult(null);
      } else {
        setResult(res);
      }
    } catch {
      setErrorMsg('查詢過程發生錯誤，請稍候重試。');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case 'present':
        return <Badge variant="success">準時出席</Badge>;
      case 'absent':
        return <Badge variant="danger">未到缺席</Badge>;
      case 'late':
        return <Badge variant="warning">遲到到課</Badge>;
      case 'leave':
        return <Badge variant="info">核准請假</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* 簡約頂部列 */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2 text-slate-800 hover:text-blue-600 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-bold">返回首頁</span>
          </Link>
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center text-white">
              <Camera className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-sm text-slate-900">家長即時查勤專區</span>
          </div>
          <Link href="/login" className="text-xs font-semibold text-slate-500 hover:text-slate-800">
            教職員登入
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-6">
        {/* 查詢表單卡片 (Flat Design) */}
        <Card className="border-slate-300">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-2">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <CardTitle className="text-xl">學生出勤紀錄雙重驗證查詢</CardTitle>
            <CardDescription>
              為確保學生隱私，請輸入學生學號與留存之「家長聯絡電話末四碼」進行查核
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            <form onSubmit={handleQuery} className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div className="sm:col-span-2">
                <Input
                  label="學生學號"
                  required
                  placeholder="例如：113001"
                  value={studentNumber}
                  onChange={(e) => setStudentNumber(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Input
                  label="家長電話末四碼"
                  required
                  maxLength={4}
                  placeholder="例如：5678"
                  value={phoneLast4}
                  onChange={(e) => setPhoneLast4(e.target.value)}
                />
              </div>
              <div className="sm:col-span-1 flex items-end">
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full h-10"
                  disabled={loading}
                >
                  <Search className="w-4 h-4 mr-1.5" />
                  {loading ? '查詢中' : '查詢'}
                </Button>
              </div>
            </form>

            {errorMsg && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-md flex items-center space-x-2 text-rose-700 text-sm font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 查詢結果卡片 */}
        {result?.student && (
          <div className="space-y-6">
            {/* 學生身分資訊卡片 */}
            <Card className="border-slate-300 bg-white">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100">
                <div>
                  <span className="text-xs font-bold text-blue-600">
                    {result.student.school_name} · {result.student.class_name}
                  </span>
                  <h2 className="text-2xl font-black text-slate-900 mt-1">
                    {result.student.name}
                  </h2>
                </div>
                <div className="mt-2 sm:mt-0 flex items-center space-x-2 text-xs font-semibold text-slate-600">
                  <span className="bg-slate-100 border border-slate-300 px-2.5 py-1 rounded">
                    學號：{result.student.student_number}
                  </span>
                  <span className="bg-slate-100 border border-slate-300 px-2.5 py-1 rounded">
                    座號：{result.student.seat_number} 號
                  </span>
                </div>
              </div>

              {/* 出勤總覽統計 */}
              <div className="grid grid-cols-4 gap-2 pt-4 text-center">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md">
                  <span className="text-xs font-bold text-emerald-800">出席次數</span>
                  <p className="text-xl font-black text-emerald-900 mt-0.5">
                    {result.records?.filter((r) => r.status === 'present').length || 0}
                  </p>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-md">
                  <span className="text-xs font-bold text-rose-800">缺席次數</span>
                  <p className="text-xl font-black text-rose-900 mt-0.5">
                    {result.records?.filter((r) => r.status === 'absent').length || 0}
                  </p>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <span className="text-xs font-bold text-amber-800">遲到次數</span>
                  <p className="text-xl font-black text-amber-900 mt-0.5">
                    {result.records?.filter((r) => r.status === 'late').length || 0}
                  </p>
                </div>
                <div className="p-3 bg-sky-50 border border-sky-200 rounded-md">
                  <span className="text-xs font-bold text-sky-800">請假次數</span>
                  <p className="text-xl font-black text-sky-900 mt-0.5">
                    {result.records?.filter((r) => r.status === 'leave').length || 0}
                  </p>
                </div>
              </div>
            </Card>

            {/* 詳細出勤明細列表 */}
            <Card className="border-slate-300">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">近期出缺勤歷史紀錄</CardTitle>
                  <CardDescription>顯示由授課教師點名與 AI 判定存證之歷程</CardDescription>
                </div>
                <Badge variant="outline">共 {result.records?.length || 0} 筆</Badge>
              </CardHeader>
              <CardContent className="pt-4">
                {!result.records || result.records.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <CheckCircle className="w-8 h-8 mx-auto mb-1 text-slate-300" />
                    <p className="text-xs font-semibold">此學生目前尚無點名出缺勤資料</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {result.records.map((rec) => (
                      <div
                        key={rec.record_id}
                        className="p-3.5 bg-slate-50 border border-slate-200 rounded-md flex items-center justify-between hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="text-slate-600">
                            <Calendar className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-sm text-slate-900">{rec.date}</span>
                              <span className="text-xs text-slate-500 font-medium">
                                {rec.period || '課堂點名'}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                              <Clock className="w-3 h-3 mr-0.5" />
                              <span>{new Date(rec.created_at).toLocaleTimeString('zh-TW')}</span>
                              {rec.is_overridden && (
                                <span className="text-amber-600 font-medium">(教師手動複核修正)</span>
                              )}
                              {rec.note && <span className="text-slate-500">備註：{rec.note}</span>}
                            </div>
                          </div>
                        </div>
                        <div>{getStatusBadge(rec.status)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
