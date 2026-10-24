import * as React from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
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

export function HomePage() {
  const { profile } = useAuthStore();

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
              <Link to="/dashboard">
                <Button variant="default" size="lg" className="w-full sm:w-auto">
                  進入教學控制台
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="default" size="lg" className="w-full sm:w-auto">
                    教職員登入
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link to="/register">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    <School className="w-4 h-4 mr-2 text-emerald-600" />
                    開通學校單位
                  </Button>
                </Link>
              </>
            )}
            <Link to="/parent-query">
              <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                <Search className="w-4 h-4 mr-2 text-blue-600" />
                家長查勤專區
              </Button>
            </Link>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs font-semibold text-slate-500">
            <div className="flex items-center space-x-1.5">
              <Cpu className="w-4 h-4 text-blue-600" />
              <span>瀏覽器原生 WebGL / ONNX</span>
            </div>
            <span>•</span>
            <div className="flex items-center space-x-1.5">
              <Database className="w-4 h-4 text-emerald-600" />
              <span>Supabase Cloud BaaS</span>
            </div>
            <span>•</span>
            <div className="flex items-center space-x-1.5">
              <Shield className="w-4 h-4 text-amber-600" />
              <span>多校多租戶 RLS 安全隔離</span>
            </div>
          </div>
        </div>
      </section>

      {/* 核心架構特色 */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-2">創新技術矩陣</Badge>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            為專題比賽量身打造的三大核心模組
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-slate-300">
            <div className="w-10 h-10 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-4">
              <Camera className="w-5 h-5" />
            </div>
            <CardTitle className="text-lg">邊緣視覺 AI 就座辨識</CardTitle>
            <CardDescription className="mt-2 text-slate-600 leading-relaxed">
              即時接入視訊鏡頭（WebCam / IP Cam），按下一鍵截圖並在瀏覽器本機端執行人員檢測，零後端推論延遲與伺服器費用。
            </CardDescription>
          </Card>

          <Card className="border-slate-300">
            <div className="w-10 h-10 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-4">
              <Grid3X3 className="w-5 h-5" />
            </div>
            <CardTitle className="text-lg">視覺化座位劃位系統</CardTitle>
            <CardDescription className="mt-2 text-slate-600 leading-relaxed">
              教師可基於鏡頭畫面自定義拉框標記學生座位，座位座標以相對比例保存，適配各類螢幕解析度並供同班級教師即時共享。
            </CardDescription>
          </Card>

          <Card className="border-slate-300">
            <div className="w-10 h-10 rounded-md bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4">
              <Search className="w-5 h-5" />
            </div>
            <CardTitle className="text-lg">家長免登入隱私查勤</CardTitle>
            <CardDescription className="mt-2 text-slate-600 leading-relaxed">
              家長憑學生學號及電話末四碼進行雙因素校驗，即時調閱歷史出勤、點名照片存證與缺席紀錄，兼顧便利性與隱私權。
            </CardDescription>
          </Card>
        </div>
      </section>

      {/* 多角色權限說明 */}
      <section className="bg-slate-100 border-t border-b border-slate-200 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-black text-slate-900">完整四層校園角色矩陣</h2>
            <p className="mt-2 text-sm text-slate-600">從平台頂層治理至家長服務的全流程身分授權與資料隔離</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-2">
              <Badge variant="default" className="bg-slate-900 text-white">平台系統總管</Badge>
              <h3 className="font-bold text-slate-900 text-sm">全域機構管理</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                建立與開通學校租戶，監督跨校數據概況，指派並維護學校主管帳號團隊。
              </p>
            </div>

            <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-2">
              <Badge variant="success">學校管理主管</Badge>
              <h3 className="font-bold text-slate-900 text-sm">校務與師生配置</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                管理所屬學校之班級、任課教師帳號派發、學生名冊維護及學期設定。
              </p>
            </div>

            <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-2">
              <Badge variant="info">任課教師</Badge>
              <h3 className="font-bold text-slate-900 text-sm">課堂點名與劃位</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                自訂班級座位表、啟動鏡頭視覺點名、手動覆核四態出勤並儲存照片存證。
              </p>
            </div>

            <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-2">
              <Badge variant="outline">學生與家長</Badge>
              <h3 className="font-bold text-slate-900 text-sm">免登入安全查閱</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                學生無需繁瑣註冊，家長透過學號與電話驗證快速掌握當日課堂到課與請假詳情。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 頁尾 Footer */}
      <footer className="mt-auto bg-white border-t border-slate-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
          <div>
            © {new Date().getFullYear()} 班級自動化點名系統 · 全國專題競賽作品
          </div>
          <div className="mt-4 sm:mt-0 flex space-x-6">
            <Link to="/parent-query" className="hover:text-slate-900">家長查勤入口</Link>
            <Link to="/login" className="hover:text-slate-900">教職員登入</Link>
            <Link to="/register" className="hover:text-slate-900">學校開通</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
