import * as React from 'react';
import { Link } from 'react-router-dom';
import { queryStudentAttendance } from '@/lib/parent-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import type { ParentQueryResult, AttendanceStatus } from '@/types/database';
import { Camera, Search, ArrowLeft, ShieldCheck, AlertCircle, Calendar, Clock, CheckCircle } from 'lucide-react';

export function ParentQueryPage() {
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
      const res = await queryStudentAttendance(studentNumber, phoneLast4);
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
        return <Badge variant="destructive">未到缺席</Badge>;
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
          <Link to="/" className="flex items-center space-x-2 text-slate-800 hover:text-blue-600 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-bold">返回首頁</span>
          </Link>
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center text-white">
              <Camera className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-sm text-slate-900">家長即時查勤專區</span>
          </div>
          <Link to="/login" className="text-xs font-semibold text-slate-500 hover:text-slate-800">
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
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="query-student-number">學生學號</Label>
                <Input
                  id="query-student-number"
                  required
                  placeholder="例如：113001"
                  value={studentNumber}
                  onChange={(e) => setStudentNumber(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="query-phone-last4">家長電話末四碼</Label>
                <Input
                  id="query-phone-last4"
                  required
                  maxLength={4}
                  placeholder="例如：5678"
                  value={phoneLast4}
                  onChange={(e) => setPhoneLast4(e.target.value)}
                />
              </div>
              <div className="sm:col-span-1 flex items-end">
                <Button type="submit" variant="default" className="w-full" disabled={loading}>
                  {loading ? '查詢中...' : (
                    <>
                      <Search className="w-4 h-4 mr-1" />
                      查詢
                    </>
                  )}
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

        {/* 查詢結果區塊 */}
        {result?.student && (
          <div className="space-y-6 animate-in fade-in-50 duration-200">
            {/* 學生個人概況資訊卡 */}
            <div className="bg-white border border-slate-300 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-xl font-black text-slate-900">{result.student.name}</span>
                  <Badge variant="outline">{result.student.school_name}</Badge>
                  <Badge variant="info">{result.student.class_name}</Badge>
                </div>
                <p className="text-xs text-slate-500">
                  學號：<span className="font-mono font-bold text-slate-700">{result.student.student_number}</span> · 
                  座號：<span className="font-mono font-bold text-slate-700">{result.student.seat_number} 號</span>
                </p>
              </div>
              <div className="text-xs bg-slate-50 border border-slate-200 px-3 py-2 rounded text-slate-600">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 inline mr-1" />
                驗證通過 · 僅顯示近 30 筆課堂記錄
              </div>
            </div>

            {/* 出勤歷史明細表 (Flat Design Table) */}
            <Card className="border-slate-300">
              <CardHeader className="border-b border-slate-200 pb-3">
                <CardTitle className="text-base flex items-center">
                  <Calendar className="w-4 h-4 mr-2 text-slate-600" />
                  出勤紀錄歷史明細
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!result.records || result.records.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-sm">
                    此學生目前尚無課堂出勤紀錄
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>點名日期</TableHead>
                        <TableHead>節次 / 課堂</TableHead>
                        <TableHead>出勤狀態</TableHead>
                        <TableHead>AI 辨識原由</TableHead>
                        <TableHead>備註說明</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.records.map((rec) => (
                        <TableRow key={rec.record_id}>
                          <TableCell className="font-mono text-slate-900 font-medium">
                            {rec.date}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            <span className="inline-flex items-center">
                              <Clock className="w-3 h-3 mr-1 text-slate-400" />
                              {rec.period || '全日課堂'}
                            </span>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(rec.status)}
                          </TableCell>
                          <TableCell className="text-slate-500">
                            {rec.is_overridden ? (
                              <span className="text-amber-600 font-semibold">教師手動更正</span>
                            ) : rec.ai_detected_status === 'present' ? (
                              <span className="text-emerald-600 font-medium">視覺 AI 辨識就座</span>
                            ) : rec.ai_detected_status === 'absent' ? (
                              <span className="text-rose-600 font-medium">視覺 AI 判定未就座</span>
                            ) : (
                              '標準登記'
                            )}
                          </TableCell>
                          <TableCell className="text-slate-500 max-w-xs truncate">
                            {rec.note || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
