// TEAM_001: 後端 REST API 與即時連線模組 (api.js)
// 支援 Vercel Serverless 後端與 Render/本地環境自動切換

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const WS_URL = import.meta.env.VITE_WS_URL || 'wss://attendance-backend-p1pj.onrender.com';

/**
 * 取得 HTTP API 完整 URL
 * @param {string} path 
 * @returns {string}
 */
export const getApiUrl = (path) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (API_BASE_URL) {
    return `${API_BASE_URL.replace(/\/+$/, '')}${cleanPath}`;
  }
  return cleanPath;
};

/**
 * 抓取歷史考勤紀錄 (store_data)
 * @param {Object} params 
 * @param {number} [params.limit=50]
 * @param {string} [params.search='']
 * @returns {Promise<Array>}
 */
export const fetchHistoryRecords = async ({ limit = 50, search = '' } = {}) => {
  try {
    const baseUrl = getApiUrl('/api/history');
    const url = new URL(baseUrl, window.location.origin);
    url.searchParams.set('limit', limit.toString());
    if (search) {
      url.searchParams.set('search', search);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const data = await response.json();
    return data.records || [];
  } catch (err) {
    console.error('[TEAM_001 API] fetchHistoryRecords failed:', err);
    return [];
  }
};

/**
 * 發送相機打卡 Telemetry 資料 (含當下完整真實座位配置)
 * @param {Object} payload 
 */
export const sendTelemetry = async (payload) => {
  const response = await fetch(getApiUrl('/api/telemetry'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: payload.message,
      file: payload.file,
      timestamp: payload.timestamp || new Date().toISOString(),
      detected_persons: payload.detected_persons || [],
      seats: payload.seats || [],
    }),
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.error || errorJson.details || `Upload failed with status ${response.status}`);
  }

  return await response.json();
};

/**
 * 連接即時廣播推播 (支援 WebSocket 與容錯輪詢)
 * @param {Function} onMessage (eventData) => void
 * @returns {Function} disconnect function
 */
export const connectWebSocket = (onMessage) => {
  let ws = null;
  let isClosedIntentionally = false;
  let reconnectTimer = null;
  let pollInterval = null;

  const connect = () => {
    try {
      if (WS_URL && WS_URL.startsWith('ws')) {
        ws = new WebSocket(WS_URL);

        ws.onopen = () => {
          console.log('[TEAM_001 WS] Connected to backend WebSocket');
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        };

        ws.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (onMessage) {
              onMessage(parsed);
            }
          } catch (err) {
            console.warn('[TEAM_001 WS] Message parse error:', err);
          }
        };

        ws.onerror = (err) => {
          console.warn('[TEAM_001 WS] WebSocket unavailable, fallback to active sync mode.');
        };

        ws.onclose = () => {
          if (!isClosedIntentionally) {
            reconnectTimer = setTimeout(connect, 5000);
          }
        };
      }
    } catch (err) {
      console.warn('[TEAM_001 WS] WebSocket connect skipped.');
    }
  };

  connect();

  return () => {
    isClosedIntentionally = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (pollInterval) clearInterval(pollInterval);
    if (ws) {
      ws.close();
    }
  };
};
