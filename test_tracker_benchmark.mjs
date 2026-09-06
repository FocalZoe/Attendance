// 基準測試腳本：驗證在座判定空間幾何與跨幀遲滯防抖狀態機
import { matchPersonsToSeats, SeatTemporalTracker } from './src/services/seatOccupancyService.js';

console.log('=== 開始執行在座判定與防抖狀態機基準測試 ===\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    process.exitCode = 1;
  }
}

// 測試用單一座位 (x=100, y=100, w=120, h=100)
const testSeats = [
  {
    seat_id: 'S1',
    name: '第 1 排 1 號',
    roi: { x: 100, y: 100, width: 120, height: 100 },
  },
  {
    seat_id: 'S2',
    name: '第 1 排 2 號',
    roi: { x: 260, y: 100, width: 120, height: 100 },
  }
];

// 測試 1: 俯拍桌遮情境 (頭部在座位上方內部，交疊 25%)
const seatedPerson = [
  { originX: 110, originY: 90, width: 100, height: 160, confidence: 0.95 }
];
const result1 = matchPersonsToSeats(testSeats, seatedPerson);
assert(result1[0].status === 'OCCUPIED', '測試 1: 正常在座人員應精準判定為 OCCUPIED');
assert(result1[1].status === 'VACANT', '測試 1: 相鄰無人座位應判定為 VACANT');

// 測試 2: 走道路人擦邊情境 (頭部在走道 x=50, 身體寬度大交疊座位邊角 30%)
const passerby = [
  { originX: 20, originY: 100, width: 110, height: 200, confidence: 0.95 } // centerX = 75, 落在座位 x=100 外側走道
];
const result2 = matchPersonsToSeats(testSeats, passerby);
assert(result2[0].status === 'VACANT', '測試 2: 走道擦邊路人應被嚴格過濾，不被錯誤吸附 (維持 VACANT)');

// 測試 3: 跨幀遲滯防抖狀態機 (SeatTemporalTracker) 瞬態漏檢測試
const tracker = new SeatTemporalTracker({ holdOffMs: 800 });

// 幀 1: 時間 t=0，有人在座
const frame1 = tracker.update(matchPersonsToSeats(testSeats, seatedPerson), 0);
assert(frame1[0].status === 'OCCUPIED', '測試 3-1: 幀 1 首次入座，立即響應為 OCCUPIED');

// 幀 2: 時間 t=100ms，模型瞬態漏檢 (detectedPersons 為空)
const frame2 = tracker.update(matchPersonsToSeats(testSeats, []), 100);
assert(frame2[0].status === 'OCCUPIED', '測試 3-2: 幀 2 瞬態漏檢 (100ms)，防抖窗口生效保持 OCCUPIED (零閃爍)');

// 幀 3: 時間 t=300ms，持續漏檢
const frame3 = tracker.update(matchPersonsToSeats(testSeats, []), 300);
assert(frame3[0].status === 'OCCUPIED', '測試 3-3: 幀 3 持續漏檢 (300ms)，依然保持 OCCUPIED');

// 幀 4: 時間 t=400ms，模型重新抓到人員
const frame4 = tracker.update(matchPersonsToSeats(testSeats, seatedPerson), 400);
assert(frame4[0].status === 'OCCUPIED', '測試 3-4: 幀 4 人員重現 (400ms)，狀態無縫延續且刷新在座計時');

// 測試 4: 真正離座超過 800ms
// 幀 5: 時間 t=1300ms (距離上次在座 400ms 已經過去 900ms > 800ms)
const frame5 = tracker.update(matchPersonsToSeats(testSeats, []), 1300);
assert(frame5[0].status === 'VACANT', '測試 4: 超過 800ms 緩衝窗口 (t=1300ms)，平滑過渡確認為 VACANT');

console.log(`\n=== 測試總結: 通過 ${passedTests}/${totalTests} 項驗證 ===\n`);
