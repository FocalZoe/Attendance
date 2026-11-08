# 班級自動化點名系統

老師在教室鏡頭畫面上標好座位，瀏覽器內的人物辨識判斷每個座位有沒有人；老師確認後存檔，出勤紀錄與當下照片都會保留，家長可用學號與電話末四碼自行查詢。

技術：Vite、React 19、TypeScript、Tailwind CSS 4、shadcn/ui、Supabase（Auth、Postgres、Storage）、MediaPipe。

## 開始使用

```bash
npm install
cp .env.example .env.local   # 填入 Supabase 專案資訊
npm run dev                  # http://localhost:3000
```

### 環境變數（`.env.local`）

| 變數 | 用途 |
|---|---|
| `VITE_SUPABASE_URL` | Supabase 專案網址（前端） |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key（前端） |
| `SUPABASE_SERVICE_ROLE_KEY` | 只給 `bootstrap:admin` 腳本使用，**不可**放進前端程式碼 |
| `INITIAL_ADMIN_EMAIL`、`INITIAL_ADMIN_PASSWORD`、`INITIAL_ADMIN_NAME` | 初始系統總管帳號 |

## 資料庫

1. 到 Supabase 的 SQL Editor 執行 [`supabase/schema.sql`](supabase/schema.sql)。這個檔案可重複執行。
2. 建立初始系統總管：

   ```bash
   npm run bootstrap:admin
   ```

3. 在 Supabase 的 Authentication 設定中，把 `<網站網址>/reset-password` 加入 Redirect URLs，忘記密碼信件才會導回本站。

## 指令

| 指令 | 說明 |
|---|---|
| `npm run dev` | 開發伺服器 |
| `npm run build` | 型別檢查並建置到 `dist/` |
| `npm run preview` | 預覽建置結果 |
| `npm run lint` | ESLint |
| `npm test` | Vitest |

## 部署

這是單頁應用程式，所有路徑都要回到 `index.html`。`vercel.json` 已包含這條規則；使用其他主機時請自行設定相同的 rewrite。
