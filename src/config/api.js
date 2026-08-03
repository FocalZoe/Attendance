// TEAM_007: API 網址自動切換模組 (api.js)
// 自動讀取 VITE_API_BASE_URL 環境變數，若未設定則在本地端預設相應端點，避免硬編碼導致 Vercel 部署發生網路異常。

/**
 * 取得 HTTP API 基礎網址
 */
export const getApiBaseUrl = () => {
  const envUrl = import.meta.env ? import.meta.env.VITE_API_BASE_URL : '';
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }
  // 在瀏覽器環境中若為本機 localhost，回傳預設本機 API 埠位 (http://localhost:3000)
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:3000';
  }
  return '';
};

/**
 * 取得完整的 API 請求 URL
 * @param {string} path API 相對路徑，例如 '/api/telemetry'
 */
export const getApiUrl = (path) => {
  const baseUrl = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
};
