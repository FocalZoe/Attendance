// TEAM_008: 座位配置與高精度在座佔用判定服務模組 (seatOccupancyService.js)
// 核心升級：
// 1. 人員中心點 (Centroid & Head Core) 錨定：人員頭部/上半身核心必須實質落在座位區域內。
// 2. 一人一座物理唯一性匹配 (Greedy Fit)：排除一人多佔相鄰座位的假陽性。
// 3. 排除邊緣擦碰：嚴格過濾邊角路過或擦過的誤判。

const LOCAL_STORAGE_KEY = 'attendance_seat_config_v2';

export const getSavedSeatsConfig = () => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.seats) && parsed.seats.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[SeatOccupancyService] 讀取座位配置失敗:', e);
  }

  // 預設 3x3 網格
  return {
    base_width: 640,
    base_height: 480,
    current_period: '第 1 節',
    seats: generateGridSeats(3, 3, 640, 480),
  };
};

export const saveSeatsConfig = (config) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('[SeatOccupancyService] 儲存座位配置失敗:', e);
  }
};

export const formatFullPeriodMessage = (periodName) => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const cleanPeriod = (periodName || '第 1 節').trim();
  return `${month}月${day}日 ${cleanPeriod}`;
};

export const generateGridSeats = (rows, cols, width = 640, height = 480) => {
  const paddingX = Math.round(width * 0.06);
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
 * 高精度在座判定演算法 (Precision Seat Occupancy Engine)
 * @param {Array} seats 座位清單 (含 roi: {x, y, width, height})
 * @param {Array} detectedPersons 偵測到的人員清單
 * @returns {Array} 包含在座 (OCCUPIED) 與缺席 (VACANT) 狀態的座位陣列
 */
export const matchPersonsToSeats = (seats, detectedPersons) => {
  if (!Array.isArray(seats) || seats.length === 0) return [];
  const persons = Array.isArray(detectedPersons) ? [...detectedPersons] : [];

  // 初始化所有座位為預設 VACANT
  const seatResults = seats.map((seat) => ({
    seat_id: seat.seat_id,
    name: seat.name || seat.seat_id,
    status: 'VACANT',
    confidence: 0,
    overlap_ratio: 0,
    matched_person: null,
    roi: seat.roi,
  }));

  if (persons.length === 0) {
    return seatResults;
  }

  // 1. 規範化人員座標與核心錨點 (頭部中心、上半身軀幹中心)
  const normalizedPersons = persons
    .map((p, idx) => {
      const x = typeof p.x === 'number' ? p.x : (p.originX || 0);
      const y = typeof p.y === 'number' ? p.y : (p.originY || 0);
      const width = typeof p.width === 'number' ? p.width : (p.w || 0);
      const height = typeof p.height === 'number' ? p.height : (p.h || 0);

      if (width <= 0 || height <= 0) return null;

      const centerX = x + width * 0.5;
      const headY = y + height * 0.32; // 頭部/肩頸核心中心
      const centerY = y + height * 0.5; // 身體中心點

      return {
        id: idx,
        raw: p,
        x, y, width, height,
        centerX, headY, centerY,
        area: width * height,
        confidence: p.confidence || p.categories?.[0]?.score || 0.95,
      };
    })
    .filter(Boolean);

  if (normalizedPersons.length === 0) {
    return seatResults;
  }

  // 2. 計算每個人與每個座位的在座契合度得分 (Fit Score)
  const candidatePairs = [];

  normalizedPersons.forEach((person) => {
    seats.forEach((seat, seatIdx) => {
      const sRoi = seat.roi;
      const sX = sRoi.x;
      const sY = sRoi.y;
      const sW = sRoi.width;
      const sH = sRoi.height;
      const sCenterX = sX + sW * 0.5;
      const sCenterY = sY + sH * 0.5;
      const sArea = sW * sH;

      if (sArea <= 0) return;

      // 寬容範圍 (5%)
      const padX = sW * 0.05;
      const padY = sH * 0.05;

      // 檢查頭部核心或中心點是否實質落在座位邊界內
      const isHeadInside =
        person.centerX >= (sX - padX) &&
        person.centerX <= (sX + sW + padX) &&
        person.headY >= (sY - padY) &&
        person.headY <= (sY + sH + padY);

      const isCenterInside =
        person.centerX >= (sX - padX) &&
        person.centerX <= (sX + sW + padX) &&
        person.centerY >= (sY - padY) &&
        person.centerY <= (sY + sH + padY);

      // 計算交集面積
      const interX1 = Math.max(sX, person.x);
      const interY1 = Math.max(sY, person.y);
      const interX2 = Math.min(sX + sW, person.x + person.width);
      const interY2 = Math.min(sY + sH, person.y + person.height);

      let overlapArea = 0;
      if (interX2 > interX1 && interY2 > interY1) {
        overlapArea = (interX2 - interX1) * (interY2 - interY1);
      }

      const overlapOverSeat = overlapArea / sArea;
      const overlapOverPerson = person.area > 0 ? (overlapArea / person.area) : 0;

      // 嚴格在座條件：
      // (1) 人員頭部或中心在座位內部，且重疊率達標
      // (2) 或者是座位被佔用面積大於 35%
      const isQualify =
        ((isHeadInside || isCenterInside) && (overlapOverSeat >= 0.15 || overlapOverPerson >= 0.2)) ||
        (overlapOverSeat >= 0.35);

      if (isQualify) {
        // 計算距離中心點之偏離量
        const dist = Math.hypot(person.centerX - sCenterX, person.headY - sCenterY);
        const maxDim = Math.max(sW, sH) || 1;
        const normalizedDist = Math.min(1.5, dist / maxDim);

        // 得分越重代表越實質坐在該位
        const score = (overlapOverSeat * 0.6) + (Math.max(0, 1 - normalizedDist * 0.6) * 0.4);

        candidatePairs.push({
          personIdx: person.id,
          seatIdx: seatIdx,
          score,
          overlapRatio: parseFloat(overlapOverSeat.toFixed(3)),
          person,
        });
      }
    });
  });

  // 3. 貪婪最佳唯一匹配 (一人一座，一座一人)
  candidatePairs.sort((a, b) => b.score - a.score);

  const matchedSeatIndices = new Set();
  const matchedPersonIndices = new Set();

  candidatePairs.forEach((pair) => {
    if (!matchedSeatIndices.has(pair.seatIdx) && !matchedPersonIndices.has(pair.personIdx)) {
      matchedSeatIndices.add(pair.seatIdx);
      matchedPersonIndices.add(pair.personIdx);

      seatResults[pair.seatIdx].status = 'OCCUPIED';
      seatResults[pair.seatIdx].confidence = pair.person.confidence;
      seatResults[pair.seatIdx].overlap_ratio = pair.overlapRatio;
      seatResults[pair.seatIdx].matched_person = pair.person.raw;
    }
  });

  return seatResults;
};
