export interface SeatRoi {
  x: number;
  y: number;
  width: number;
  height: number;
  x_pct?: number;
  y_pct?: number;
  width_pct?: number;
  height_pct?: number;
}

export interface DomainSeat {
  seat_id: string;
  name: string;
  roi: SeatRoi;
}

export interface MatchedSeatResult {
  seat_id: string;
  name: string;
  status: 'OCCUPIED' | 'VACANT';
  confidence: number;
  overlap_ratio: number;
  matched_person: any | null;
  roi: SeatRoi;
}

/**
 * 自動自適應產生網格座位矩陣
 */
export const generateGridSeats = (
  rows: number = 3,
  cols: number = 3,
  width: number = 640,
  height: number = 480
): DomainSeat[] => {
  const safeRows = Math.max(1, parseInt(String(rows), 10) || 1);
  const safeCols = Math.max(1, parseInt(String(cols), 10) || 1);

  const paddingRatioX = safeCols > 6 ? 0.03 : 0.06;
  const paddingRatioY = safeRows > 6 ? 0.04 : 0.08;
  const gapRatioX = safeCols > 6 ? 0.015 : 0.03;
  const gapRatioY = safeRows > 6 ? 0.02 : 0.04;

  const paddingX = Math.round(width * paddingRatioX);
  const paddingY = Math.round(height * paddingRatioY);
  const gapX = Math.round(width * gapRatioX);
  const gapY = Math.round(height * gapRatioY);

  const totalGapX = (safeCols - 1) * gapX;
  const totalGapY = (safeRows - 1) * gapY;
  const seatW = Math.max(10, Math.floor((width - paddingX * 2 - totalGapX) / safeCols));
  const seatH = Math.max(10, Math.floor((height - paddingY * 2 - totalGapY) / safeRows));

  const seats: DomainSeat[] = [];
  let count = 1;

  for (let r = 0; r < safeRows; r++) {
    for (let c = 0; c < safeCols; c++) {
      const seatId = String(count);
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
      count++;
    }
  }

  return seats;
};

/**
 * 空間幾何透視與在座判定核心演算法 (Multi-Factor Fit Score + Greedy Assignment)
 */
export const matchPersonsToSeats = (
  seats: DomainSeat[],
  detectedPersons: any[]
): MatchedSeatResult[] => {
  if (!Array.isArray(seats) || seats.length === 0) return [];
  const persons = Array.isArray(detectedPersons) ? [...detectedPersons] : [];

  const seatResults: MatchedSeatResult[] = seats.map((seat) => ({
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

  const normalizedPersons = persons
    .map((p, idx) => {
      const x = typeof p.x === 'number' ? p.x : (p.originX || 0);
      const y = typeof p.y === 'number' ? p.y : (p.originY || 0);
      const width = typeof p.width === 'number' ? p.width : (p.w || 0);
      const height = typeof p.height === 'number' ? p.height : (p.h || 0);

      if (width <= 0 || height <= 0) return null;

      const aspectRatio = height / (width || 1);
      if (aspectRatio < 0.40) return null;

      const centerX = x + width * 0.5;
      const headY = y + height * 0.28;
      const centerY = y + height * 0.48;

      return {
        id: idx,
        raw: p,
        x, y, width, height,
        centerX, headY, centerY,
        area: width * height,
        confidence: typeof p.confidence === 'number' ? p.confidence : (p.categories?.[0]?.score || 0.95),
      };
    })
    .filter(Boolean);

  if (normalizedPersons.length === 0) {
    return seatResults;
  }

  const candidatePairs: any[] = [];

  normalizedPersons.forEach((person: any) => {
    seats.forEach((seat, seatIdx) => {
      const sRoi = seat.roi;
      const sX = sRoi.x;
      const sY = sRoi.y;
      const sW = sRoi.width;
      const sH = sRoi.height;
      const sArea = sW * sH;

      if (sArea <= 0) return;

      const padX = sW * 0.12;
      const padY = sH * 0.12;

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

      const interW = Math.max(0, Math.min(person.x + person.width, sX + sW) - Math.max(person.x, sX));
      const interH = Math.max(0, Math.min(person.y + person.height, sY + sH) - Math.max(person.y, sY));
      const interArea = interW * interH;
      const overlapRatio = interArea / sArea;

      if ((isHeadInside || isCenterInside || overlapRatio > 0.25) && overlapRatio > 0.12) {
        let fitScore = 0;
        if (isHeadInside) fitScore += 0.45;
        if (isCenterInside) fitScore += 0.35;
        fitScore += Math.min(0.35, overlapRatio * 0.5);

        candidatePairs.push({
          personIdx: person.id,
          seatIdx,
          fitScore,
          overlapRatio,
          person,
        });
      }
    });
  });

  candidatePairs.sort((a, b) => b.fitScore - a.fitScore);

  const matchedPersonIds = new Set<number>();
  const matchedSeatIndices = new Set<number>();

  candidatePairs.forEach((pair) => {
    if (!matchedPersonIds.has(pair.personIdx) && !matchedSeatIndices.has(pair.seatIdx)) {
      matchedPersonIds.add(pair.personIdx);
      matchedSeatIndices.add(pair.seatIdx);

      const result = seatResults[pair.seatIdx];
      result.status = 'OCCUPIED';
      result.confidence = parseFloat(pair.fitScore.toFixed(3));
      result.overlap_ratio = parseFloat(pair.overlapRatio.toFixed(3));
      result.matched_person = pair.person.raw;
    }
  });

  return seatResults;
};
