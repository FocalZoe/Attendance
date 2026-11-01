import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateGridSeats,
  calculateSeatPersonOverlap,
  matchPersonsToSeats,
  SeatTemporalTracker,
  formatFullPeriodMessage,
  compileAttendanceRecords,
  NormalizedBox,
  DetectedPerson,
} from './seatOccupancyService';

describe('seatOccupancyService', () => {
  describe('generateGridSeats', () => {
    it('應正確產生指定列與行之歸一化座位網格', () => {
      const seats = generateGridSeats(2, 3, { marginRatio: 0.1, gapRatio: 0.05, prefix: 'T' });
      expect(seats).toHaveLength(6);
      expect(seats[0].seat_label).toBe('T-1');
      expect(seats[5].seat_label).toBe('T-6');
      expect(seats[0].x_ratio).toBeGreaterThanOrEqual(0);
      expect(seats[0].y_ratio).toBeGreaterThanOrEqual(0);
      expect(seats[0].w_ratio).toBeGreaterThan(0);
      expect(seats[0].h_ratio).toBeGreaterThan(0);
    });

    it('邊界容錯：傳入 0 列或 0 行時應自動回退為至少 1 格', () => {
      const seats = generateGridSeats(0, 0);
      expect(seats).toHaveLength(1);
      expect(seats[0].seat_label).toBe('1');
    });
  });

  describe('calculateSeatPersonOverlap', () => {
    const seat = {
      x_ratio: 0.2,
      y_ratio: 0.2,
      w_ratio: 0.2,
      h_ratio: 0.2,
    };
    const resolution = { width: 1000, height: 1000 };

    it('完全不相交時應返回 0 分', () => {
      const person: DetectedPerson = {
        originX: 800,
        originY: 800,
        width: 100,
        height: 100,
        score: 0.9,
      };
      const score = calculateSeatPersonOverlap(seat, person, resolution);
      expect(score).toBe(0);
    });

    it('人體與座位有交疊，且頭部質心落於座位內時應獲得額外頭部權重加分', () => {
      // 座位區域：x: [0.2, 0.4], y: [0.2, 0.4]
      // 人體：x: [250, 350], y: [220, 350] (歸一化為 [0.25, 0.35], [0.22, 0.35])
      // 頭部質心 (y + h*0.25) 約為 0.22 + 0.13*0.25 = 0.2525，在座位區間內
      const person: DetectedPerson = {
        originX: 250,
        originY: 220,
        width: 100,
        height: 130,
        score: 0.95,
      };
      const score = calculateSeatPersonOverlap(seat, person, resolution);
      // 交疊比例約 (0.1 * 0.13) / (0.2 * 0.2) = 0.013 / 0.04 = 0.325 + 0.45 加分 = 0.775
      expect(score).toBeGreaterThan(0.5);
    });
  });

  describe('matchPersonsToSeats (Greedy 1-1 Assignment)', () => {
    const seats: NormalizedBox[] = [
      { id: 's1', seat_label: '1', x_ratio: 0.1, y_ratio: 0.1, w_ratio: 0.2, h_ratio: 0.2 },
      { id: 's2', seat_label: '2', x_ratio: 0.5, y_ratio: 0.1, w_ratio: 0.2, h_ratio: 0.2 },
    ];
    const resolution = { width: 1000, height: 1000 };

    it('應正確將多個人體單射匹配至最適之單一座位', () => {
      const detectedPersons: DetectedPerson[] = [
        { originX: 120, originY: 120, width: 150, height: 150, score: 0.9 }, // 匹配 s1
        { originX: 520, originY: 120, width: 150, height: 150, score: 0.88 }, // 匹配 s2
      ];

      const matches = matchPersonsToSeats(seats, detectedPersons, resolution, 0.15);
      expect(matches).toHaveLength(2);
      expect(matches[0].isOccupied).toBe(true);
      expect(matches[0].seatId).toBe('s1');
      expect(matches[1].isOccupied).toBe(true);
      expect(matches[1].seatId).toBe('s2');
    });

    it('兩個相鄰座位爭奪同一偵測人物時，只分配給交疊分數較高者，另一位為空', () => {
      // 僅一個人體，偏向 s1
      const detectedPersons: DetectedPerson[] = [
        { originX: 150, originY: 120, width: 200, height: 150, score: 0.9 },
      ];

      const matches = matchPersonsToSeats(seats, detectedPersons, resolution, 0.1);
      const occupiedSeats = matches.filter((m) => m.isOccupied);
      expect(occupiedSeats).toHaveLength(1);
      expect(occupiedSeats[0].seatId).toBe('s1');
      expect(matches.find((m) => m.seatId === 's2')?.isOccupied).toBe(false);
    });
  });

  describe('SeatTemporalTracker (Hysteresis Decay)', () => {
    let tracker: SeatTemporalTracker;

    beforeEach(() => {
      tracker = new SeatTemporalTracker(800); // 800ms 衰減期
    });

    it('偵測到在座時應即時判定為在座', () => {
      const matches = [
        { seatId: 's1', seatLabel: '1', isOccupied: true, overlapScore: 0.8 },
      ];
      const result = tracker.update(matches, 1000);
      expect(result.get('s1')).toBe(true);
    });

    it('若短暫一幀未偵測到 (在 800ms 內)，應維持在座平滑狀態', () => {
      // t=1000: 在座
      tracker.update([{ seatId: 's1', seatLabel: '1', isOccupied: true, overlapScore: 0.8 }], 1000);

      // t=1400 (+400ms): 暫時被遮蔽或未偵測到
      const resultMid = tracker.update([{ seatId: 's1', seatLabel: '1', isOccupied: false, overlapScore: 0 }], 1400);
      expect(resultMid.get('s1')).toBe(true);
    });

    it('超過 800ms 仍未偵測到時，應消退為缺席', () => {
      // t=1000: 在座
      tracker.update([{ seatId: 's1', seatLabel: '1', isOccupied: true, overlapScore: 0.8 }], 1000);

      // t=1900 (+900ms): 超過 800ms
      const resultLate = tracker.update([{ seatId: 's1', seatLabel: '1', isOccupied: false, overlapScore: 0 }], 1900);
      expect(resultLate.get('s1')).toBe(false);
    });
  });

  describe('formatFullPeriodMessage', () => {
    it('應正確將日期與節次代碼格式化為易讀文字', () => {
      expect(formatFullPeriodMessage('2026-10-26', '1')).toBe('2026-10-26 · 第 1 節');
      expect(formatFullPeriodMessage('2026-10-26', 'morning')).toBe('2026-10-26 · 晨間點名');
      expect(formatFullPeriodMessage('2026-10-26', null)).toBe('2026-10-26 · 一般節次');
    });
  });

  describe('compileAttendanceRecords (閉環考勤收斂)', () => {
    const students = [
      { id: 'stu-1' },
      { id: 'stu-2' },
      { id: 'stu-3' }, // 未排入座位表之學生
    ];

    it('應完整收斂全班學生，未劃位學生自動計為缺席並附帶備註', () => {
      const seatingBoxes = [
        { id: 'box-1', student_id: 'stu-1' },
        { id: 'box-2', student_id: 'stu-2' },
      ];
      const occupancyMap = new Map<string, boolean>([
        ['box-1', true],
        ['box-2', false],
      ]);

      const records = compileAttendanceRecords(students, seatingBoxes, occupancyMap);

      expect(records).toHaveLength(3);
      expect(records[0]).toEqual({
        student_id: 'stu-1',
        status: 'present',
        ai_detected_status: 'present',
        is_overridden: false,
        note: null,
      });
      expect(records[1]).toEqual({
        student_id: 'stu-2',
        status: 'absent',
        ai_detected_status: 'absent',
        is_overridden: false,
        note: null,
      });
      expect(records[2]).toEqual({
        student_id: 'stu-3',
        status: 'absent',
        ai_detected_status: 'absent',
        is_overridden: false,
        note: '未排入座位表',
      });
    });

    it('防禦同一學生被錯誤綁定多個座位：任一在座判定為出席，且輸出無重複 student_id', () => {
      const seatingBoxes = [
        { id: 'box-1', student_id: 'stu-1' },
        { id: 'box-1-dup', student_id: 'stu-1' },
      ];
      const occupancyMap = new Map<string, boolean>([
        ['box-1', false],
        ['box-1-dup', true],
      ]);

      const records = compileAttendanceRecords(students, seatingBoxes, occupancyMap);
      const stu1Records = records.filter((r) => r.student_id === 'stu-1');

      expect(stu1Records).toHaveLength(1);
      expect(stu1Records[0].status).toBe('present');
    });
  });
});
