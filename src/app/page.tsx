import Link from 'next/link';
import { getCurrentProfile } from '@/lib/auth';
import { Navbar } from '@/components/ui/navbar';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Camera,
  Grid3X3,
  Shield,
  Search,
  Cpu,
  Layers,
  ArrowRight,
  Database,
  ExternalLink,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const profile = await getCurrentProfile();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar profile={profile} />

      {/* Hero Section (Flat Design) */}
      <section className="bg-white border-b border-slate-200 py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center space-x-2 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full text-xs font-bold text-blue-700 mb-6">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            <span>全國專題競賽參賽作品 · 創新與整合應用</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight max-w-4xl mx-auto leading-tight">
            視覺化智慧點名系統
            <span className="block text-blue-600 mt-2">
              教室劃位與即時視訊 AI 人員檢測
            </span>
          </h1>

          <p className="mt-5 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            透過相機畫面直接進行教室座位劃位綁定，結合前端 Web AI 零延遲推論、四態出勤即時覆核與雲端存證，打造高效透明的校園點名新生態。
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href={profile ? '/dashboard' : '/login'}>
              <Button variant="primary" size="lg" className="w-full sm:w-auto">
                {profile ? '進入管理控制台' : '教職員登入 / 註冊體驗'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/parent-query">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                <Search className="w-4 h-4 mr-2" />
                家長查勤入口（免登入）
              </Button>
            </Link>
          </div>

          {/* 技術棧徽章列 */}
          <div className="mt-12 pt-8 border-t border-slate-100 flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-slate-500">
            <span className="flex items-center"><Layers className="w-4 h-4 mr-1 text-slate-700" /> Next.js 15 (App Router)</span>
            <span className="text-slate-300">·</span>
            <span className="flex items-center"><Database className="w-4 h-4 mr-1 text-emerald-600" /> Supabase Cloud & RLS</span>
            <span className="text-slate-300">·</span>
            <span className="flex items-center"><Cpu className="w-4 h-4 mr-1 text-blue-600" /> ONNX Runtime Web AI</span>
            <span className="text-slate-300">·</span>
            <span className="flex items-center"><ExternalLink className="w-4 h-4 mr-1 text-slate-800" /> Vercel Serverless</span>
          </div>
        </div>
      </section>

      {/* 核心架構亮點區塊 (Flat Grid) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full space-y-12">
        <div className="text-center max-w-3xl mx-auto">
          <Badge variant="outline" className="mb-2">創新技術指標</Badge>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            著重創新性、實用性與全端整合度
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            針對競賽評審對資料可靠性、影像隱私及真實落地能力的嚴謹要求量身打造
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-slate-300">
            <div className="w-10 h-10 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-4">
              <Camera className="w-5 h-5" />
            </div>
            <CardTitle className="text-base">視訊即時推論</CardTitle>
            <CardDescription className="mt-2 text-xs leading-relaxed">
              瀏覽器原生呼叫 WebCam，透過 ONNX WebGL 進行人體偵測，免去高昂雲端 GPU 成本。
            </CardDescription>
          </Card>

          <Card className="border-slate-300">
            <div className="w-10 h-10 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-4">
              <Grid3X3 className="w-5 h-5" />
            </div>
            <CardTitle className="text-base">動態劃位對映</CardTitle>
            <CardDescription className="mt-2 text-xs leading-relaxed">
              基於攝影機底圖以 0.0 ~ 1.0 正規化比例標註座位邊界（ROI），不同鏡頭與解析度皆精準對映。
            </CardDescription>
          </Card>

          <Card className="border-slate-300">
            <div className="w-10 h-10 rounded-md bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-800 mb-4">
              <Shield className="w-5 h-5" />
            </div>
            <CardTitle className="text-base">多租戶 RBAC 體系</CardTitle>
            <CardDescription className="mt-2 text-xs leading-relaxed">
              系統總管、學校主管、任課教師三層獨立劃分，搭配 Supabase Row Level Security 資料庫嚴密隔離。
            </CardDescription>
          </Card>

          <Card className="border-slate-300">
            <div className="w-10 h-10 rounded-md bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 mb-4">
              <Search className="w-5 h-5" />
            </div>
            <CardTitle className="text-base">家長雙驗證查勤</CardTitle>
            <CardDescription className="mt-2 text-xs leading-relaxed">
              免登入透過「學號 + 家長電話後四碼」校驗，呈現即時出勤與存證，兼顧個資防護與便民性。
            </CardDescription>
          </Card>
        </div>

        {/* 角色權限體系展示卡片 */}
        <Card className="border-slate-300 bg-white">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-lg">多角色架構分工模型</CardTitle>
            <CardDescription>
              各角色分工明確，確保學校行政、課堂教師與家長資訊流轉無縫銜接
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-2">
                <Badge variant="default" className="bg-slate-900 text-white">平台級：系統總管理員</Badge>
                <h4 className="text-sm font-bold text-slate-900 mt-2">全域組織與學校授權</h4>
                <p className="text-xs text-slate-500">
                  建立學校實體、指派學校主要負責人、審視全平台開班與活躍數據。
                </p>
              </div>

              <div className="p-4 border border-emerald-200 rounded-lg bg-emerald-50/50 space-y-2">
                <Badge variant="success">學校級：學校主管</Badge>
                <h4 className="text-sm font-bold text-slate-900 mt-2">校務名冊與教師指派</h4>
                <p className="text-xs text-slate-500">
                  管理校內班級、指派任課教師帳號憑證、批次匯入在籍學生清冊。
                </p>
              </div>

              <div className="p-4 border border-blue-200 rounded-lg bg-blue-50/50 space-y-2">
                <Badge variant="info">班級級：任課教師</Badge>
                <h4 className="text-sm font-bold text-slate-900 mt-2">教室劃位與即時點名</h4>
                <p className="text-xs text-slate-500">
                  框劃座位並綁定學生、開啟鏡頭執行 AI 就座判定、即時手動覆核四態。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 底部 Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-500 space-y-2">
          <p className="font-semibold text-slate-700">視覺化智慧點名系統 · 全國專題競賽作品</p>
          <p>
            技術棧：Next.js 15 · TypeScript · Tailwind CSS (Flat Design) · Supabase Cloud · Vercel
          </p>
          <p className="text-slate-400">© 2026 保留所有專題競賽與學術研究權利</p>
        </div>
      </footer>
    </div>
  );
}
