// TEAM_008: 座位配置管理、空間重疊比對與課堂節次服務 (seatOccupancyService.js)
// 嚴禁假資料原則：預設座位為空清單 ([])，完全依據使用者對現場相機畫面的實際劃位。

const STORAGE_KEY = 'classvision_seat_map_config_v1';

// 預設為乾淨的空配置 (0 席座位，預設節次為第 1 節)
export const DEFAULT_SEATS_CONFIG = {
  room_name: '創新研討教室',
  camera_id: 'CAM-01',
  current_period: '第 1 節',
  base_width: 640,
  base_height: 480,
  seats: [],
};

/**
 * 格式化為「幾月幾號第幾節」字串 (例如：8月21日 第 1 節)
 */
export const formatFullPeriodMessage = (periodStr = '第 1 節', date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const cleanPeriod = (periodStr || '第 1 節').trim();
  return `${month}月${day}日 ${cleanPeriod}`;
};

/**
 * 取得儲存的座位配置 (若無則預設為空清單)
 */
export const getSavedSeatsConfig = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.seats)) {
        return {
          ...DEFAULT_SEATS_CONFIG,
          ...parsed,
          current_period: parsed.current_period || '第 1 節',
        };
      }
    }
  } catch (err) {
    console.warn('[SeatOccupancyService] Read storage error:', err);
  }
  return DEFAULT_SEATS_CONFIG;
};

/**
 * 儲存座位配置
 */
export const saveSeatsConfig = (config) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch (err) {
    console.error('[SeatOccupancyService] Save storage error:', err);
    return false;
  }
};

/**
 * 清空所有座位配置
 */
export const clearSeatsConfig = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (err) {
    console.error('[SeatOccupancyService] Clear storage error:', err);
    return false;
  }
};

/**
 * 自動產生 M 行 x N 列 網格座位 (依據相機畫面尺寸計算)
 */
export const generateGridSeats = (rows = 2, cols = 2, width = 640, height = 480) => {
  const paddingX = Math.round(width * 0.05);
  const paddingY = Math.round(height * 0.08);
  const gapX = Math.round(width * 0.03);
  const gapY = Math.round(height * 0.04);

  const totalGapX = (cols - 1) * gapX;
  const totalGapY = (rows - 1) * gapY;
  const seatW = Math.floor((width - paddingX * 2 - totalGapX) / cols);
  const seatH = Math.floor((height - paddingY * 2 - totalGapY) / rows);

  const rowLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const seats = [];

  for (let r = 0; r < rows; r++) {
    const letter = rowLetters[r] || `R${r + 1}`;
    for (let c = 0; c < cols; c++) {
      const seatNum = String(c + 1).padStart(2, '0');
      const seatId = `${letter}-${seatNum}`;
      const x = paddingX + c * (seatW + gapX);
      const y = paddingY + r * (seatH + gapY);

      seats.push({
        seat_id: seatId,
        name: `第 ${r + 1} 排 ${c + 1} 號座`,
        roi: {
          x,
          y,
          width: seatW,
          height: seatH,
          x_pct: parseFloat(((x / width) * 100).toFixed(2)),
          y_pct: parseFloat(((y / height) * 100).toFixed(2)),
          width_pct: parseFloat(((seatW / width) * 100).toFixed(2)),
          height_pct: parseFloat(((seatH / height) * 100).toFixed(2)),
        },
      });
    }
  }

  return seats;
};

/**
 * 計算兩矩形重疊比例 (Intersection over Min Area)
 */
export const calculateOverlap = (rectA, rectB) => {
  if (!rectA || !rectB) return 0;
  const x1 = Math.max(rectA.x, rectB.x);
  const y1 = Math.max(rectA.y, rectB.y);
  const x2 = Math.min(rectA.x + rectA.width, rectB.x + rectB.width);
  const y2 = Math.min(rectA.y + rectA.height, rectB.y + rectB.height);

  if (x2 <= x1 || y2 <= y1) return 0;

  const intersection = (x2 - x1) * (y2 - y1);
  const minArea = Math.min(rectA.width * rectA.height, rectB.width * rectB.height);
  if (minArea <= 0) return 0;

  return intersection / minArea;
};

/**
 * 比對人員偵測邊框與座位區域，判定每個座號的在座狀態
 */
export const matchPersonsToSeats = (seats, detectedPersons, threshold = 0.2) => {
  if (!Array.isArray(seats) || seats.length === 0) return [];
  const persons = Array.isArray(detectedPersons) ? detectedPersons : [];

  return seats.map((seat) => {
    let bestOverlap = 0;
    let bestPerson = null;

    for (const p of persons) {
      const pBox = {
        x: p.x || p.originX || 0,
        y: p.y || p.originY || 0,
        width: p.width || p.w || 0,
        height: p.height || p.h || 0,
      };
      const overlap = calculateOverlap(seat.roi, pBox);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestPerson = p;
      }
    }

    const isOccupied = bestOverlap >= threshold;

    return {
      seat_id: seat.seat_id,
      name: seat.name || seat.seat_id,
      status: isOccupied ? 'OCCUPIED' : 'VACANT',
      confidence: isOccupied && bestPerson ? (bestPerson.confidence || bestPerson.categories?.[0]?.score || 0) : 0,
      overlap_ratio: bestOverlap,
      matched_person: isOccupied ? bestPerson : null,
      roi: seat.roi,
    };
  });
};
