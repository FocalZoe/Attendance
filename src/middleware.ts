import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * 匹配所有請求路徑，排除以下靜態資源：
     * - _next/static (靜態檔案)
     * - _next/image (圖片最佳化)
     * - favicon.ico (圖示檔案)
     * - 各種靜態圖形副檔名 (.svg, .png, .jpg, .jpeg, .gif, .webp)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
