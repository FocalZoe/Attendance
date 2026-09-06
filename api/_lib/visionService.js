// TEAM_008: 高精度多座位與在座佔用分析服務 (Vercel Serverless)

export async function analyzeAttendanceImage(base64Data, hintMessage, clientPersons, clientSeats) {
  const startTime = Date.now();

  const cleanBase64 = (base64Data || '').replace(/^data:image\/\w+;base64,/, '');
  const imageBuffer = Buffer.from(cleanBase64, 'base64');
  const isImageValid = imageBuffer.length >= 100;

  // 1. 整理人員邊框
  const rawPersons = Array.isArray(clientPersons) ? clientPersons : [];
  const normalizedPersons = [];

  if (isImageValid && rawPersons.length > 0) {
    rawPersons.forEach((p, idx) => {
      const x = typeof p.x === 'number' ? p.x : (p.originX || 0);
      const y = typeof p.y === 'number' ? p.y : (p.originY || 0);
      const width = typeof p.width === 'number' ? p.width : (p.w || 0);
      const height = typeof p.height === 'number' ? p.height : (p.h || 0);

      if (width > 0 && height > 0) {
        // 形態防偽過濾：排除橫向扁平非坐姿物體 (如平攤課本雜物或橫放背包，正常人體坐姿高寬比 >= 0.60)
        const aspectRatio = height / (width || 1);
        if (aspectRatio < 0.60) return;

        const centerX = x + width * 0.5;
        const headY = y + height * 0.28;
        const centerY = y + height * 0.48;

        normalizedPersons.push({
          id: idx,
          raw: p,
          bounding_box: {
            x: Math.round(x),
            y: Math.round(y),
            width: Math.round(width),
            height: Math.round(height),
            x_pct: typeof p.x_pct === 'number' ? p.x_pct : undefined,
            y_pct: typeof p.y_pct === 'number' ? p.y_pct : undefined,
            width_pct: typeof p.width_pct === 'number' ? p.width_pct : undefined,
            height_pct: typeof p.height_pct === 'number' ? p.height_pct : undefined,
          },
          centerX, headY, centerY,
          area: width * height,
          confidence: typeof p.confidence === 'number' ? parseFloat(p.confidence.toFixed(4)) : 0.95,
          label: p.label || 'Person',
        });
      }
    });
  }

  const seatDefinitions = Array.isArray(clientSeats) ? clientSeats : [];
  const seatStatuses = [];

  // 初始化所有座位
  seatDefinitions.forEach((seat) => {
    const seatBox = {
      x: seat.roi.x,
      y: seat.roi.y,
      width: seat.roi.width,
      height: seat.roi.height,
      x_pct: typeof seat.roi.x_pct === 'number' ? seat.roi.x_pct : (seat.roi.x <= 100 ? seat.roi.x : undefined),
      y_pct: typeof seat.roi.y_pct === 'number' ? seat.roi.y_pct : (seat.roi.y <= 100 ? seat.roi.y : undefined),
      width_pct: typeof seat.roi.width_pct === 'number' ? seat.roi.width_pct : (seat.roi.width <= 100 ? seat.roi.width : undefined),
      height_pct: typeof seat.roi.height_pct === 'number' ? seat.roi.height_pct : (seat.roi.height <= 100 ? seat.roi.height : undefined),
    };

    seatStatuses.push({
      seat_id: seat.seat_id,
      name: seat.name || seat.seat_id,
      status: 'VACANT',
      confidence: 0,
      overlap_ratio: 0,
      roi: seatBox,
      person_box: null,
    });
  });

  // 2. 高精度契合度計算 (中心點錨定 + 空間重疊比)
  const candidatePairs = [];

  normalizedPersons.forEach((person) => {
    seatDefinitions.forEach((seat, seatIdx) => {
      const sX = seat.roi.x;
      const sY = seat.roi.y;
      const sW = seat.roi.width;
      const sH = seat.roi.height;
      const sCenterX = sX + sW * 0.5;
      const sHeadCenterY = sY + sH * 0.35;
      const sArea = sW * sH;

      if (sArea <= 0) return;

      // 寬容範圍 (適應透視邊界與學生俯身傾斜)
      const padX = sW * 0.12;
      const padY = sH * 0.12;

      // (A) 頭部核心是否實質落在座位 ROI 範圍內
      const isHeadInside =
        person.centerX >= (sX - padX) &&
        person.centerX <= (sX + sW + padX) &&
        person.headY >= (sY - padY) &&
        person.headY <= (sY + sH + padY);

      // (B) 軀幹中心是否實質落在座位內部
      const isCenterInside =
        person.centerX >= (sX - padX) &&
        person.centerX <= (sX + sW + padX) &&
        person.centerY >= (sY - padY) &&
        person.centerY <= (sY + sH + padY);

      // (C) 計算幾何重疊面積
      const interX1 = Math.max(sX, person.bounding_box.x);
      const interY1 = Math.max(sY, person.bounding_box.y);
      const interX2 = Math.min(sX + sW, person.bounding_box.x + person.bounding_box.width);
      const interY2 = Math.min(sY + sH, person.bounding_box.y + person.bounding_box.height);

      let overlapArea = 0;
      if (interX2 > interX1 && interY2 > interY1) {
        overlapArea = (interX2 - interX1) * (interY2 - interY1);
      }

      const overlapOverSeat = overlapArea / sArea;
      const overlapOverPerson = person.area > 0 ? (overlapArea / person.area) : 0;

      // (D) 走道穿行人體嚴格排除機制 (Passerby Strict Filter)
      if (!isHeadInside && !isCenterInside && overlapOverSeat < 0.35) {
        return;
      }

      // (E) 綜合入座門檻 (適應低頭俯身與背影人體)
      const isQualify =
        ((isHeadInside || isCenterInside) && (overlapOverSeat >= 0.08 || overlapOverPerson >= 0.12)) ||
        (overlapOverSeat >= 0.32);

      if (isQualify) {
        const dist = Math.hypot(person.centerX - sCenterX, person.headY - sHeadCenterY);
        const maxDim = Math.max(sW, sH) || 1;
        const normalizedDist = Math.min(1.5, dist / maxDim);
        const centerAffinity = Math.max(0, 1 - normalizedDist * 0.6);

        const headBonus = isHeadInside ? 1.0 : 0.4;
        const score = ((overlapOverSeat * 0.45) + (centerAffinity * 0.35) + (headBonus * 0.20)) * person.confidence;

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

  // 3. 貪婪唯一性匹配 (一人一座)
  candidatePairs.sort((a, b) => b.score - a.score);

  const matchedSeatIndices = new Set();
  const matchedPersonIndices = new Set();

  candidatePairs.forEach((pair) => {
    if (!matchedSeatIndices.has(pair.seatIdx) && !matchedPersonIndices.has(pair.personIdx)) {
      matchedSeatIndices.add(pair.seatIdx);
      matchedPersonIndices.add(pair.personIdx);

      seatStatuses[pair.seatIdx].status = 'OCCUPIED';
      seatStatuses[pair.seatIdx].confidence = pair.person.confidence;
      seatStatuses[pair.seatIdx].overlap_ratio = pair.overlapRatio;
      seatStatuses[pair.seatIdx].person_box = pair.person.bounding_box;
    }
  });

  const totalSeats = seatStatuses.length;
  const occupiedCount = seatStatuses.filter((s) => s.status === 'OCCUPIED').length;
  const vacantCount = totalSeats - occupiedCount;
  const attendanceRate = totalSeats > 0 ? `${((occupiedCount / totalSeats) * 100).toFixed(1)}%` : (normalizedPersons.length > 0 ? '100.0%' : '0.0%');
  const hasOccupied = occupiedCount > 0 || (totalSeats === 0 && normalizedPersons.length > 0);

  const occupiedSeatIds = seatStatuses.filter((s) => s.status === 'OCCUPIED').map((s) => s.seat_id);
  const summaryText = hasOccupied
    ? (occupiedSeatIds.length > 0 ? `在座: ${occupiedSeatIds.join(', ')} (${occupiedCount}/${totalSeats} 席)` : `偵測到在位人數: ${normalizedPersons.length} 人`)
    : '全體空位 (VACANT)';

  const primaryBox = normalizedPersons.length > 0 ? normalizedPersons[0].bounding_box : { x: 0, y: 0, width: 0, height: 0 };
  const maxConfidence = normalizedPersons.length > 0 ? Math.max(...normalizedPersons.map((p) => p.confidence)) : 0;

  const processingTimeMs = Date.now() - startTime;
  console.log(
    `[High-Precision Occupancy Engine] 分析完成 (${processingTimeMs}ms): 真實座位數=${totalSeats}, 在座=${occupiedCount}, 缺席=${vacantCount}`
  );

  return {
    engine: 'ClassVision High-Precision Occupancy Engine v2.0 (Head-Centroid Anchored)',
    detected: hasOccupied,
    status: hasOccupied ? 'OCCUPIED' : 'VACANT',
    total_seats: totalSeats,
    occupied_count: occupiedCount,
    vacant_count: vacantCount,
    attendance_rate: attendanceRate,
    seat_statuses: seatStatuses,
    persons: normalizedPersons.map((p) => ({
      bounding_box: p.bounding_box,
      confidence: p.confidence,
      label: p.label,
    })),
    confidence: maxConfidence,
    recognized_person: summaryText,
    bounding_box: primaryBox,
    quality_score: isImageValid ? (hasOccupied ? 0.95 : 0.5) : 0,
    processed_at: new Date().toISOString(),
  };
}
