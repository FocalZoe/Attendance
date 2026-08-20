// TEAM_008: 座位配置管理與空間重疊比對服務 (seatOccupancyService.js)
// 提供多座位 ROI 定義、LocalStorage 持久化與前端 IoU 重疊比對

const STORAGE_KEY = 'classvision_seat_map_config_v1';

// 預設 4 座位標準佈局 (以 640x360 基準比例設定)
export const DEFAULT_SEATS_CONFIG = {
  room_name: '第 3 研討教室',
  camera_id: 'CAM-01',
  base_width: 640,
  base_height: 360,
  seats: [
    { seat_id: 'A-01', name: '第1排左座', roi: { x: 40, y: 50, width: 250, height: 130 } },
    { seat_id: 'A-02', name: '第1排右座', roi: { x: 350, y: 50, width: 250, height: 130 } },
    { seat_id: 'B-01', name: '第2排左座', roi: { x: 40, y: 200, width: 250, height: 130 } },
    { seat_id: 'B-02', name: '第2排右座', roi: { x: 350, y: 200, width: 250, height: 130 } },
  ],
};

/**
 * 取得儲存的座位配置
 */
export const getSavedSeatsConfig = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.seats) && parsed.seats.length > 0) {
        return parsed;
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
 * 自動產生 M 行 x N 列 網格座位
 */
export const generateGridSeats = (rows = 2, cols = 2, width = 640, height = 360) => {
  const paddingX = 30;
  const paddingY = 35;
  const gapX = 20;
  const gapY = 20;

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
        roi: { x, y, width: seatW, height: seatH },
      });
    }
  }

  return {
    room_name: '自訂網格教室',
    camera_id: 'CAM-01',
    base_width: width,
    base_height: height,
    seats,
  };
};

/**
 * 計算兩矩形重疊比例 (Intersection over Min Area)
 */
export const calculateOverlap = (rectA, rectB) => {
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
      confidence: isOccupied ? (bestPerson?.confidence || bestPerson?.categories?.[0]?.score || 0.95) : 0,
      overlap_ratio: bestOverlap,
      matched_person: isOccupied ? bestPerson : null,
      roi: seat.roi,
    };
  });
};
