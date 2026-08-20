// TEAM_007: API 網址統一配置模組 (api.js)
// 確保所有前端請求 (發送通報、查詢歷史、WebSocket) 100% 指向同一個真實伺服器與資料庫！

const DEFAULT_REMOTE_BACKEND = 'https://attendance-backend-p1pj.onrender.com';

/**
 * 取得 HTTP API 基礎網址
 */
export const getApiBaseUrl = () => {
  const envUrl = import.meta.env ? import.meta.env.VITE_API_BASE_URL : '';
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }
  return DEFAULT_REMOTE_BACKEND;
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
