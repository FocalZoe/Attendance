/**
 * 時序遲滯防抖與防偽狀態機 (Temporal Hysteresis & Debouncing)
 * 依循 .agents/domain/TemporalHysteresis_Anti-Spoofing/ 規範
 * 純函式實作，零外部 UI 依賴
 */

export type OccupancyState = 'VACANT' | 'TRANSITIONAL' | 'OCCUPIED'

export interface HysteresisConfig {
  enterThreshold: number // 進入 occupied 所需連續偵測幀數
  exitThreshold: number  // 離開 occupied 所需連續離開幀數
  confidenceThreshold: number // AI 信心度閥值 (0.0 ~ 1.0)
}

export const DEFAULT_HYSTERESIS_CONFIG: HysteresisConfig = {
  enterThreshold: 5,
  exitThreshold: 8,
  confidenceThreshold: 0.65,
}

export interface SeatOccupancyTracker {
  seatId: string
  currentState: OccupancyState
  consecutivePresentFrames: number
  consecutiveAbsentFrames: number
  lastUpdated: number
}

/**
 * 依據當前偵測結果與歷史累積幀數，計算遲滯狀態轉移
 */
export function updateHysteresisTracker(
  tracker: SeatOccupancyTracker,
  detectedPresent: boolean,
  confidence: number,
  config: HysteresisConfig = DEFAULT_HYSTERESIS_CONFIG
): SeatOccupancyTracker {
  const isConfident = confidence >= config.confidenceThreshold
  const isValidPresent = detectedPresent && isConfident
  const now = Date.now()

  let presentFrames = tracker.consecutivePresentFrames
  let absentFrames = tracker.consecutiveAbsentFrames

  if (isValidPresent) {
    presentFrames += 1
    absentFrames = 0
  } else {
    absentFrames += 1
    presentFrames = 0
  }

  let nextState: OccupancyState = tracker.currentState

  if (tracker.currentState === 'VACANT') {
    if (presentFrames >= config.enterThreshold) {
      nextState = 'OCCUPIED'
    } else if (presentFrames > 0) {
      nextState = 'TRANSITIONAL'
    }
  } else if (tracker.currentState === 'TRANSITIONAL') {
    if (presentFrames >= config.enterThreshold) {
      nextState = 'OCCUPIED'
    } else if (absentFrames >= config.exitThreshold) {
      nextState = 'VACANT'
    }
  } else if (tracker.currentState === 'OCCUPIED') {
    if (absentFrames >= config.exitThreshold) {
      nextState = 'VACANT'
    } else if (absentFrames > 0) {
      nextState = 'TRANSITIONAL'
    }
  }

  return {
    seatId: tracker.seatId,
    currentState: nextState,
    consecutivePresentFrames: presentFrames,
    consecutiveAbsentFrames: absentFrames,
    lastUpdated: now,
  }
}
