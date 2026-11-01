// ==============================================================================
// 班級自動化點名系統 - 座位幾何匹配與時序平滑引擎 (seatOccupancyService.ts)
// 移植與適配自 FocalZoe/Attendance@db11fd959c991ed8a5730ab1af347f403aa221e8
// ==============================================================================

export interface NormalizedBox {
  id?: string;
  seat_label?: string;
  student_id?: string | null;
  x_ratio: number;
  y_ratio: number;
  w_ratio: number;
  h_ratio: number;
}

export interface DetectedPerson {
  originX: number; // 歸一化或像素坐標
  originY: number;
  width: number;
  height: number;
  score: number;
  classLabel?: string;
}

export interface SeatMatchResult {
  seatId: string;
  seatLabel: string;
  isOccupied: boolean;
  assignedPerson?: DetectedPerson;
  overlapScore: number;
}

/**
 * 矩陣網格座位快速產生器 (依行與列均勻分佈)
 */
export const generateGridSeats = (
  rows: number,
  cols: number,
  options: {
    marginRatio?: number;
    gapRatio?: number;
    prefix?: string;
  } = {}
): NormalizedBox[] => {
  const { marginRatio = 0.05, gapRatio = 0.02, prefix = '' } = options;

  const validRows = Math.max(1, rows);
  const validCols = Math.max(1, cols);

  const availableW = 1.0 - marginRatio * 2;
  const availableH = 1.0 - marginRatio * 2;

  const totalGapW = (validCols - 1) * gapRatio;
  const totalGapH = (validRows - 1) * gapRatio;

  const cellW = (availableW - totalGapW) / validCols;
  const cellH = (availableH - totalGapH) / validRows;

  const seats: NormalizedBox[] = [];
  let seatNumber = 1;

  for (let r = 0; r < validRows; r++) {
    for (let c = 0; c < validCols; c++) {
      const x = marginRatio + c * (cellW + gapRatio);
      const y = marginRatio + r * (cellH + gapRatio);

      seats.push({
        seat_label: prefix ? `${prefix}-${seatNumber}` : `${seatNumber}`,
        x_ratio: Math.max(0, Math.min(1, x)),
        y_ratio: Math.max(0, Math.min(1, y)),
        w_ratio: Math.max(0.01, Math.min(1, cellW)),
        h_ratio: Math.max(0.01, Math.min(1, cellH)),
        student_id: null,
      });
      seatNumber++;
    }
  }

  return seats;
};

/**
 * 幾何交疊比例與人體頂部 (頭部核心特徵) 質心權重計算
 * 計算 bounding box A (座位框) 與 B (偵測到的人體) 的相交度
 */
export const calculateSeatPersonOverlap = (
  seat: { x_ratio: number; y_ratio: number; w_ratio: number; h_ratio: number },
  person: DetectedPerson,
  referenceResolution: { width: number; height: number }
): number => {
  // 將 person 歸一化 (若傳入為像素坐標)
  const px = person.originX > 1 ? person.originX / referenceResolution.width : person.originX;
  const py = person.originY > 1 ? person.originY / referenceResolution.height : person.originY;
  const pw = person.width > 1 ? person.width / referenceResolution.width : person.width;
  const ph = person.height > 1 ? person.height / referenceResolution.height : person.height;

  const sx1 = seat.x_ratio;
  const sy1 = seat.y_ratio;
  const sx2 = seat.x_ratio + seat.w_ratio;
  const sy2 = seat.y_ratio + seat.h_ratio;

  const px1 = px;
  const py1 = py;
  const px2 = px + pw;
  const py2 = py + ph;

  // 計算交集面積
  const interX1 = Math.max(sx1, px1);
  const interY1 = Math.max(sy1, py1);
  const interX2 = Math.min(sx2, px2);
  const interY2 = Math.min(sy2, py2);

  const interW = Math.max(0, interX2 - interX1);
  const interH = Math.max(0, interY2 - interY1);
  const interArea = interW * interH;

  const seatArea = seat.w_ratio * seat.h_ratio;
  if (seatArea <= 0) return 0;

  // 交疊佔座位面積比
  const seatCoverage = interArea / seatArea;

  // 人體頭部/上半身核心點判定 (人體頂部 25% 處質心)
  const headCentroidX = px + pw * 0.5;
  const headCentroidY = py + ph * 0.25;

  const isHeadInsideSeat =
    headCentroidX >= sx1 && headCentroidX <= sx2 &&
    headCentroidY >= sy1 && headCentroidY <= sy2;

  // 綜合評分：交疊覆蓋率 + 頭部質心在框內加權 (0.45)
  let score = seatCoverage;
  if (isHeadInsideSeat) {
    score += 0.45;
  }

  return score;
};

/**
 * 貪婪單射匹配 (Greedy 1-to-1 Assignment)
 * 確保一個偵測到的人體最多只佔用一個座位，一個座位也最多綁定一個人
 */
export const matchPersonsToSeats = (
  seats: NormalizedBox[],
  detectedPersons: DetectedPerson[],
  referenceResolution: { width: number; height: number },
  minOverlapThreshold: number = 0.15
): SeatMatchResult[] => {
  interface CandidatePair {
    seatIndex: number;
    personIndex: number;
    score: number;
  }

  const pairs: CandidatePair[] = [];

  for (let sIdx = 0; sIdx < seats.length; sIdx++) {
    const seat = seats[sIdx];
    for (let pIdx = 0; pIdx < detectedPersons.length; pIdx++) {
      const person = detectedPersons[pIdx];
      const score = calculateSeatPersonOverlap(seat, person, referenceResolution);
      if (score >= minOverlapThreshold) {
        pairs.push({
          seatIndex: sIdx,
          personIndex: pIdx,
          score,
        });
      }
    }
  }

  // 依配對分數由高至低排序
  pairs.sort((a, b) => b.score - a.score);

  const matchedSeatIndices = new Set<number>();
  const matchedPersonIndices = new Set<number>();
  const assignments = new Map<number, { person: DetectedPerson; score: number }>();

  for (const pair of pairs) {
    if (!matchedSeatIndices.has(pair.seatIndex) && !matchedPersonIndices.has(pair.personIndex)) {
      matchedSeatIndices.add(pair.seatIndex);
      matchedPersonIndices.add(pair.personIndex);
      assignments.set(pair.seatIndex, {
        person: detectedPersons[pair.personIndex],
        score: pair.score,
      });
    }
  }

  return seats.map((seat, index) => {
    const match = assignments.get(index);
    return {
      seatId: seat.id || `seat-${index}`,
      seatLabel: seat.seat_label || `${index + 1}`,
      isOccupied: !!match,
      assignedPerson: match?.person,
      overlapScore: match?.score || 0,
    };
  });
};

/**
 * 時序防抖追蹤器 (SeatTemporalTracker)
 * 具備 800ms 滯後消退 (Hysteresis Decay) 機制，防止單張抽檢時眨眼或短暫被遮蔽造成的誤判
 */
export class SeatTemporalTracker {
  private seatState: Map<string, { lastSeenTimestamp: number; isPresent: boolean }> = new Map();
  private readonly decayTimeoutMs: number;

  constructor(decayTimeoutMs: number = 800) {
    this.decayTimeoutMs = decayTimeoutMs;
  }

  public update(currentMatches: SeatMatchResult[], nowTimestamp: number = Date.now()): Map<string, boolean> {
    const finalOccupancy = new Map<string, boolean>();

    for (const match of currentMatches) {
      const state = this.seatState.get(match.seatId) || {
        lastSeenTimestamp: 0,
        isPresent: false,
      };

      if (match.isOccupied) {
        state.lastSeenTimestamp = nowTimestamp;
        state.isPresent = true;
      } else {
        // 若當前偵測為空，但距離上次看到仍在衰減保護期內，維持在座狀態
        if (state.isPresent && nowTimestamp - state.lastSeenTimestamp <= this.decayTimeoutMs) {
          state.isPresent = true;
        } else {
          state.isPresent = false;
        }
      }

      this.seatState.set(match.seatId, state);
      finalOccupancy.set(match.seatId, state.isPresent);
    }

    return finalOccupancy;
  }

  public reset(): void {
    this.seatState.clear();
  }
}

/**
 * 節次與日期格式化公用函式
 */
export const formatFullPeriodMessage = (dateStr: string, periodStr: string | null): string => {
  const periodMap: Record<string, string> = {
    '1': '第 1 節',
    '2': '第 2 節',
    '3': '第 3 節',
    '4': '第 4 節',
    '5': '第 5 節',
    '6': '第 6 節',
    '7': '第 7 節',
    '8': '第 8 節',
    morning: '晨間點名',
    afternoon: '午後點名',
  };

  const periodLabel = periodStr ? (periodMap[periodStr] || `第 ${periodStr} 節`) : '一般節次';
  return `${dateStr} · ${periodLabel}`;
};

export interface CompiledAttendanceRecord {
  student_id: string;
  status: 'present' | 'absent';
  ai_detected_status: 'present' | 'absent';
  is_overridden: boolean;
  note: string | null;
}

/**
 * 考勤紀錄彙整與防重收斂器
 * 確保以班級在籍學生為母體，所有學生皆有出缺勤紀錄，去重並防止 DB UNIQUE 約束違規
 */
export const compileAttendanceRecords = (
  students: { id: string }[],
  seatingBoxes: { id: string; student_id: string | null }[],
  occupancyMap: Map<string, boolean>
): CompiledAttendanceRecord[] => {
  const studentOccupancy = new Map<string, boolean>();

  for (const box of seatingBoxes) {
    if (!box.student_id) continue;
    const isOccupied = occupancyMap.get(box.id) || false;
    const current = studentOccupancy.get(box.student_id) || false;
    studentOccupancy.set(box.student_id, current || isOccupied);
  }

  const seenStudentIds = new Set<string>();
  const records: CompiledAttendanceRecord[] = [];

  for (const student of students) {
    if (seenStudentIds.has(student.id)) continue;
    seenStudentIds.add(student.id);

    const isAssignedSeat = studentOccupancy.has(student.id);
    const isPresent = studentOccupancy.get(student.id) || false;

    records.push({
      student_id: student.id,
      status: isPresent ? 'present' : 'absent',
      ai_detected_status: isPresent ? 'present' : 'absent',
      is_overridden: false,
      note: isAssignedSeat ? null : '未排入座位表',
    });
  }

  return records;
};
