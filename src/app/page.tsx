import Link from 'next/link';
import { getCurrentProfile } from '@/lib/auth';
import { Navbar } from '@/components/ui/navbar';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
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
  School,
  Clock,
  Sparkles,
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
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>現代化智慧校務解決方案 · 班級出勤管理新標準</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight max-w-4xl mx-auto leading-tight">
            班級自動化點名系統
            <span className="block text-blue-600 mt-2">
              教室視角劃位 × 邊緣視覺 AI 就座辨識
            </span>
          </h1>

          <p className="mt-5 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            告別傳統繁瑣唱名。透過教室視訊鏡頭即時畫面標記座位，一鍵啟動前端 AI 視覺辨識就座狀態，結合四態出勤即時覆核與雲端存證，打造高效透明的校園出勤新生態。
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            {profile ? (
              <Link href="/dashboard">
                <Button variant="primary" size="lg" className="w-full sm:w-auto">
                  進入教學控制台
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="primary" size="lg" className="w-full sm:w-auto">
                    教職員登入
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    <School className="w-4 h-4 mr-2 text-emerald-600" />
                    開通學校單位
                  </Button>
                </Link>
              </>
            )}
            <Link href="/parent-query">
              <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                <Search className="w-4 h-4 mr-2 text-blue-600" />
                家長查勤專區
              </Button>
            </Link>
          </div>

          {/* 技術與平台架構標籤 */}
          <div className="mt-12 pt-8 border-t border-slate-100 flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-slate-500">
            <span className="flex items-center"><Layers className="w-4 h-4 mr-1 text-slate-700" /> Next.js 全端無伺服器架構</span>
            <span className="text-slate-300">·</span>
            <span className="flex items-center"><Database className="w-4 h-4 mr-1 text-emerald-600" /> Supabase 資料庫與 RLS 安全隔離</span>
            <span className="text-slate-300">·</span>
            <span className="flex items-center"><Cpu className="w-4 h-4 mr-1 text-blue-600" /> 瀏覽器端 Web AI 邊緣推論</span>
            <span className="text-slate-300">·</span>
            <span className="flex items-center"><ExternalLink className="w-4 h-4 mr-1 text-slate-800" /> Vercel 高可用性託管</span>
          </div>
        </div>
      </section>

      {/* 核心應用優勢區塊 (Flat Grid) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full space-y-12">
        <div className="text-center max-w-3xl mx-auto">
          <Badge variant="outline" className="mb-2">核心系統優勢</Badge>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            為校務行政、授課導師與家長提供全方位支援
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            兼顧操作直觀性、辨識精確度與資料隱私防護，實現無縫的課堂出勤數位化
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-slate-300">
            <div className="w-10 h-10 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-4">
              <Camera className="w-5 h-5" />
            </div>
            <CardTitle className="text-base">邊緣視覺即時推論</CardTitle>
            <CardDescription className="mt-2 text-xs leading-relaxed">
              直接利用本機 USB 或教室攝影機，於前端瀏覽器進行目標檢測，免除等待與雲端運算延遲。
            </CardDescription>
          </Card>

          <Card className="border-slate-300">
            <div className="w-10 h-10 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-4">
              <Grid3X3 className="w-5 h-5" />
            </div>
            <CardTitle className="text-base">透視視角動態劃位</CardTitle>
            <CardDescription className="mt-2 text-xs leading-relaxed">
              以實時鏡頭或 16:9 畫布為底圖，透過正規化比例標定座位座標，適配不同解析度與相機角度。
            </CardDescription>
          </Card>

          <Card className="border-slate-300">
            <div className="w-10 h-10 rounded-md bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-800 mb-4">
              <Clock className="w-5 h-5" />
            </div>
            <CardTitle className="text-base">四態出勤即時覆核</CardTitle>
            <CardDescription className="mt-2 text-xs leading-relaxed">
              AI 辨識後色彩高亮呈現，教師可即時點擊覆核切換出席、缺席、遲到與請假，支援事前請假聯動。
            </CardDescription>
          </Card>

          <Card className="border-slate-300">
            <div className="w-10 h-10 rounded-md bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 mb-4">
              <Search className="w-5 h-5" />
            </div>
            <CardTitle className="text-base">家長雙重校驗查勤</CardTitle>
            <CardDescription className="mt-2 text-xs leading-relaxed">
              家長免註冊登入，輸入「學號 + 家長電話後四碼」即可安全查核在籍學生即時與歷程出勤。
            </CardDescription>
          </Card>
        </div>

        {/* 角色權限分工與組織流程 */}
        <Card className="border-slate-300 bg-white">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-slate-800" />
              <h3 className="text-lg font-bold text-slate-900">分層授權與多校組織模型</h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              各角色權限邊界分明，透過 Supabase Row Level Security 保障各校資料嚴密隔離
            </p>
          </div>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-2">
                <Badge variant="default" className="bg-slate-900 text-white">平台級：系統總管理員</Badge>
                <h4 className="text-sm font-bold text-slate-900 mt-2">全域租戶與系統維護</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  管理平台開通之學校機構、監控全系統連線狀態，帳號由伺服器安全初始化預置。
                </p>
              </div>

              <div className="p-4 border border-emerald-200 rounded-lg bg-emerald-50/50 space-y-2">
                <Badge variant="success">學校級：學校主管</Badge>
                <h4 className="text-sm font-bold text-slate-900 mt-2">校務名冊與教師派發</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  開通學校單位、管理學期與班級、指派任課教師帳號並維護在籍學生清冊。
                </p>
              </div>

              <div className="p-4 border border-blue-200 rounded-lg bg-blue-50/50 space-y-2">
                <Badge variant="info">課堂級：任課教師</Badge>
                <h4 className="text-sm font-bold text-slate-900 mt-2">座位劃位與視訊點名</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  建立共用教室座位表、啟動相機自動判斷就座人數，並一鍵完成出勤存證記錄。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 導入效益指標 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          <div className="p-6 bg-white border border-slate-200 rounded-lg">
            <div className="text-3xl font-black text-blue-600">＜ 3 秒</div>
            <div className="text-sm font-bold text-slate-800 mt-1">全班點名完成</div>
            <p className="text-xs text-slate-500 mt-0.5">免逐一唱名，一鍵快門即刻結算</p>
          </div>
          <div className="p-6 bg-white border border-slate-200 rounded-lg">
            <div className="text-3xl font-black text-emerald-600">100%</div>
            <div className="text-sm font-bold text-slate-800 mt-1">出勤軌跡存證</div>
            <p className="text-xs text-slate-500 mt-0.5">點名畫面與 AI 判定明細雲端留存</p>
          </div>
          <div className="p-6 bg-white border border-slate-200 rounded-lg">
            <div className="text-3xl font-black text-slate-900">0 元</div>
            <div className="text-sm font-bold text-slate-800 mt-1">額外硬體購置</div>
            <p className="text-xs text-slate-500 mt-0.5">標準筆電與視訊相機即開即用</p>
          </div>
        </div>
      </section>

      {/* 底部 Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-500 space-y-2">
          <p className="font-bold text-slate-700">班級自動化點名系統 · 現代化校園智慧出勤解決方案</p>
          <p className="text-slate-400">
            基於 Next.js 全端架構 · Supabase Cloud · 瀏覽器端 Web AI 技術驅動
          </p>
          <div className="pt-2 flex justify-center space-x-4 text-xs font-medium text-slate-600">
            <Link href="/login" className="hover:text-blue-600">教職員登入</Link>
            <span>·</span>
            <Link href="/register" className="hover:text-blue-600">學校開通申請</Link>
            <span>·</span>
            <Link href="/parent-query" className="hover:text-blue-600">家長查勤入口</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
