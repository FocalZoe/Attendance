// TEAM_008: 多座位與在座佔用分析服務 (Vercel Serverless)

function calculateOverlapRatio(rectA, rectB) {
  if (!rectA || !rectB) return 0;

  const aX = typeof rectA.x_pct === 'number' ? rectA.x_pct : rectA.x;
  const aY = typeof rectA.y_pct === 'number' ? rectA.y_pct : rectA.y;
  const aW = typeof rectA.width_pct === 'number' ? rectA.width_pct : rectA.width;
  const aH = typeof rectA.height_pct === 'number' ? rectA.height_pct : rectA.height;

  const bX = typeof rectB.x_pct === 'number' ? rectB.x_pct : rectB.x;
  const bY = typeof rectB.y_pct === 'number' ? rectB.y_pct : rectB.y;
  const bW = typeof rectB.width_pct === 'number' ? rectB.width_pct : rectB.width;
  const bH = typeof rectB.height_pct === 'number' ? rectB.height_pct : rectB.height;

  const x1 = Math.max(aX, bX);
  const y1 = Math.max(aY, bY);
  const x2 = Math.min(aX + aW, bX + bW);
  const y2 = Math.min(aY + aH, bY + bH);

  if (x2 <= x1 || y2 <= y1) {
    return 0;
  }

  const intersectionArea = (x2 - x1) * (y2 - y1);
  const seatArea = aW * aH;
  if (seatArea <= 0) return 0;

  return parseFloat((intersectionArea / seatArea).toFixed(4));
}

export async function analyzeAttendanceImage(base64Data, hintMessage, clientPersons, clientSeats) {
  const startTime = Date.now();

  const cleanBase64 = (base64Data || '').replace(/^data:image\/\w+;base64,/, '');
  const imageBuffer = Buffer.from(cleanBase64, 'base64');
  const isImageValid = imageBuffer.length >= 100;

  const persons = [];
  if (isImageValid && Array.isArray(clientPersons) && clientPersons.length > 0) {
    clientPersons.forEach((p) => {
      if (typeof p.x === 'number' && typeof p.y === 'number' && p.width > 0 && p.height > 0) {
        persons.push({
          bounding_box: {
            x: Math.round(p.x),
            y: Math.round(p.y),
            width: Math.round(p.width),
            height: Math.round(p.height),
            x_pct: typeof p.x_pct === 'number' ? p.x_pct : undefined,
            y_pct: typeof p.y_pct === 'number' ? p.y_pct : undefined,
            width_pct: typeof p.width_pct === 'number' ? p.width_pct : undefined,
            height_pct: typeof p.height_pct === 'number' ? p.height_pct : undefined,
          },
          confidence: typeof p.confidence === 'number' ? parseFloat(p.confidence.toFixed(4)) : 0.95,
          label: p.label || 'Person',
        });
      }
    });
  }

  const seatDefinitions = Array.isArray(clientSeats) ? clientSeats : [];
  const OVERLAP_THRESHOLD = 0.2;
  const seatStatuses = [];

  seatDefinitions.forEach((seat) => {
    let bestOverlap = 0;
    let matchedPerson = null;

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

    for (const person of persons) {
      const overlap = calculateOverlapRatio(seatBox, person.bounding_box);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        matchedPerson = person;
      }
    }

    const isOccupied = bestOverlap >= OVERLAP_THRESHOLD || (matchedPerson !== null && bestOverlap > 0.12);

    seatStatuses.push({
      seat_id: seat.seat_id,
      name: seat.name || seat.seat_id,
      status: isOccupied ? 'OCCUPIED' : 'VACANT',
      confidence: isOccupied && matchedPerson ? matchedPerson.confidence : 0,
      overlap_ratio: bestOverlap,
      roi: seatBox,
      person_box: isOccupied && matchedPerson ? matchedPerson.bounding_box : null,
    });
  });

  const totalSeats = seatStatuses.length;
  const occupiedCount = seatStatuses.filter((s) => s.status === 'OCCUPIED').length;
  const vacantCount = totalSeats - occupiedCount;
  const attendanceRate = totalSeats > 0 ? `${((occupiedCount / totalSeats) * 100).toFixed(1)}%` : (persons.length > 0 ? '100.0%' : '0.0%');
  const hasOccupied = occupiedCount > 0 || (totalSeats === 0 && persons.length > 0);

  const occupiedSeatIds = seatStatuses.filter((s) => s.status === 'OCCUPIED').map((s) => s.seat_id);
  const summaryText = hasOccupied
    ? (occupiedSeatIds.length > 0 ? `在座: ${occupiedSeatIds.join(', ')} (${occupiedCount}/${totalSeats} 席)` : `偵測到在位人數: ${persons.length} 人`)
    : '全體空位 (VACANT)';

  const primaryBox = persons.length > 0 ? persons[0].bounding_box : { x: 0, y: 0, width: 0, height: 0 };
  const maxConfidence = persons.length > 0 ? Math.max(...persons.map((p) => p.confidence)) : 0;

  const processingTimeMs = Date.now() - startTime;
  console.log(
    `[Vercel Serverless Occupancy Engine] 分析完成 (${processingTimeMs}ms): 真實座位數=${totalSeats}, 在座=${occupiedCount}`
  );

  return {
    engine: 'ClassVision Occupancy Engine v1.0 (Real AI / Privacy-Safe / Vercel)',
    detected: hasOccupied,
    status: hasOccupied ? 'OCCUPIED' : 'VACANT',
    total_seats: totalSeats,
    occupied_count: occupiedCount,
    vacant_count: vacantCount,
    attendance_rate: attendanceRate,
    seat_statuses: seatStatuses,
    persons: persons,
    confidence: maxConfidence,
    recognized_person: summaryText,
    bounding_box: primaryBox,
    quality_score: isImageValid ? (hasOccupied ? 0.95 : 0.5) : 0,
    processed_at: new Date().toISOString(),
  };
}
