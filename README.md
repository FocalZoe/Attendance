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
| `SUPABASE_SERVICE_ROLE_KEY` | 只給 `bootstrap:admin` 腳本使用，**不可**放進前端程式碼，也不可加 `VITE_` 前綴 |
| `INITIAL_ADMIN_EMAIL`、`INITIAL_ADMIN_PASSWORD`、`INITIAL_ADMIN_NAME` | 平台系統總管帳號（見下方） |

## 資料庫

1. 到 Supabase 的 SQL Editor 執行 [`supabase/schema.sql`](supabase/schema.sql)。這個檔案可重複執行。
2. 建立初始系統總管：

   ```bash
   npm run bootstrap:admin
   ```

3. 在 Supabase 的 Authentication 設定中，把 `<網站網址>/reset-password` 加入 Redirect URLs，忘記密碼信件才會導回本站。

## 平台系統總管

`INITIAL_ADMIN_*` 建立的帳號就是平台系統總管（`sys_admin`）。除了開通學校、指派主管，它還能**永久刪除**：

- 帳號（連同登入身分；對方以前點過的名會保留，只是不再顯示是誰點的）
- 整間學校（班級、學生、座位表、點名紀錄、課表，可選擇連帶刪除該校帳號）
- 單一班級或學生
- 點名照片（Storage）

刪除無法復原。每次永久刪除都要輸入名稱確認，並寫入 `deletion_log` 資料表（只有系統總管讀得到）。

### 在 Vercel 自動建立

到 Vercel 專案的 Environment Variables 設定下列變數，建議只勾選 **Production**：

`VITE_SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`INITIAL_ADMIN_EMAIL`、`INITIAL_ADMIN_PASSWORD`、`INITIAL_ADMIN_NAME`

`vercel.json` 的 `buildCommand` 會在每次建置前執行 `scripts/bootstrap-admin.mjs --build`：

- 帳號已存在就略過，**不會重設密碼**；若它被停用或不是系統總管，會恢復成啟用中的系統總管。
- 缺少變數、Preview 部署或連線失敗時只印警告，不會讓部署失敗。
- `SUPABASE_SERVICE_ROLE_KEY` 與 `INITIAL_ADMIN_*` 不能加 `VITE_` 前綴，否則會被打包進前端。
- 密碼請用強密碼，登入後建議立刻改掉。

## 指令

| 指令 | 說明 |
|---|---|
| `npm run dev` | 開發伺服器 |
| `npm run build` | 型別檢查並建置到 `dist/` |
| `npm run preview` | 預覽建置結果 |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `npm run bootstrap:admin` | 讀取 `.env.local`，建立或確認平台系統總管 |

## 部署

這是單頁應用程式，所有路徑都要回到 `index.html`。`vercel.json` 已包含這條規則；使用其他主機時請自行設定相同的 rewrite。
