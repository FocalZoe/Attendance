// TEAM_001: 後端 REST API 與 WebSocket 連線模組 (api.js)

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://attendance-backend-p1pj.onrender.com';
const WS_URL = import.meta.env.VITE_WS_URL || 'wss://attendance-backend-p1pj.onrender.com';

/**
 * 取得 HTTP API 完整 URL
 * @param {string} path 
 * @returns {string}
 */
export const getApiUrl = (path) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL.replace(/\/+$/, '')}${cleanPath}`;
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
    const url = new URL(getApiUrl('/api/history'));
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
 * 發送相機打卡 Telemetry 資料 (Base64 JPEG)
 * @param {Object} payload 
 * @param {string} payload.message
 * @param {string} payload.file Base64
 * @param {string} [payload.timestamp]
 */
export const sendTelemetry = async ({ message, file, timestamp }) => {
  const response = await fetch(getApiUrl('/api/telemetry'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      file,
      timestamp: timestamp || new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.error || errorJson.details || `Upload failed with status ${response.status}`);
  }

  return await response.json();
};

/**
 * 連接 WebSocket 即時對講機廣播
 * @param {Function} onMessage (eventData) => void
 * @returns {Function} disconnect function
 */
export const connectWebSocket = (onMessage) => {
  let ws = null;
  let isClosedIntentionally = false;
  let reconnectTimer = null;

  const connect = () => {
    try {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log('[TEAM_001 WS] Connected to backend WebSocket');
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
        console.warn('[TEAM_001 WS] Connection error:', err);
      };

      ws.onclose = () => {
        if (!isClosedIntentionally) {
          console.log('[TEAM_001 WS] Closed. Reconnecting in 3s...');
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
    } catch (err) {
      console.error('[TEAM_001 WS] Setup error:', err);
    }
  };

  connect();

  return () => {
    isClosedIntentionally = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (ws) {
      ws.close();
    }
  };
};
