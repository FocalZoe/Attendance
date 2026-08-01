# TEAM_001: 移除 Mock 資料與串接真實 Supabase / API

- **Team ID**: TEAM_001
- **任務目標**: 完全移除 Frontend-2 專案中所有的 Mock 假資料，整合 CameraSimulatorModal 拍照測試彈窗，並參考 Frontend-web 重構 History 歷史紀錄卡片，串接 Supabase `store_data` 後端 API 與 WebSocket。
- **負責範圍**: `Frontend-2/`

## 工作紀錄

- [x] 完成需求與 API / Supabase `store_data` 規格確認
- [x] 建立 TEAM_001 團隊紀錄與計畫
- [ ] 建立 `src/services/api.js` API / WebSocket 連線封裝
- [ ] 建立 `src/components/CameraSimulatorModal.jsx` 實體視訊打卡視窗
- [ ] 建立 `src/components/ImageModal.jsx` 大圖燈箱 Modal
- [ ] 重構 `src/pages/Dashboard.jsx` 移除 Mock 並導入即時 store_data 數據
- [ ] 重構 `src/pages/History.jsx` 採用 Frontend-web 照片卡片與即時搜尋
- [ ] 更新 `src/components/Sidebar.jsx` 及 `src/App.jsx`
- [ ] 刪除 `src/mock/data.js` 舊 Mock 檔案
- [ ] 執行 `oxlint` 與 `vite build` 建置驗證
