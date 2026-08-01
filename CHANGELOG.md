# Changelog

All notable changes to the `rollcall-system` (Frontend-2) project will be documented in this file.

## [0.0.0+1] - 2026-08-02

### Added
- TEAM_001: 建立 `src/services/api.js` 後端 REST API (`/api/history`, `/api/telemetry`) 與 WebSocket 連線服務。
- TEAM_001: 建立 `src/components/CameraSimulatorModal.jsx` 實體 Webcam 相機打卡測試彈窗。
- TEAM_001: 建立 `src/components/ImageModal.jsx` 點名照片大圖燈箱 Modal。

### Changed
- TEAM_001: 重構 `src/pages/Dashboard.jsx`，完全移除 Mock 資料，改為顯示 Supabase `store_data` 即時數據。
- TEAM_001: 參考 `Frontend-web` 重構 `src/pages/History.jsx` 為照片卡片網格，支援即時關鍵字搜尋與大圖點擊。
- TEAM_001: 全站 UI 元件統一使用 `lucide-react` 圖示。

### Removed
- TEAM_001: 完全移除 `src/mock/data.js` 舊 Mock 資料檔案與點名模擬器。
