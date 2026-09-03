// ==============================================================================
// ClassVision / Zoe Attendance - 自動點名定時排程服務模組 (scheduleService.js)
// 支援自訂多組固定課堂時間點（如 08:05, 09:05...）、防重複觸發與下一次時間計算
// ==============================================================================

const LOCAL_STORAGE_KEY = 'attendance_schedules_config_v1';

export const DEFAULT_SCHEDULES = [
  { id: 'sch-1', time: '08:05', period: '第 1 節', enabled: true },
  { id: 'sch-2', time: '09:05', period: '第 2 節', enabled: true },
  { id: 'sch-3', time: '10:05', period: '第 3 節', enabled: true },
  { id: 'sch-4', time: '11:05', period: '第 4 節', enabled: true },
  { id: 'sch-5', time: '13:30', period: '第 5 節', enabled: true },
  { id: 'sch-6', time: '14:30', period: '第 6 節', enabled: true },
  { id: 'sch-7', time: '15:30', period: '第 7 節', enabled: true },
  { id: 'sch-8', time: '16:30', period: '第 8 節', enabled: true },
];

/**
 * 取得已儲存之自動排程配置
 * @returns {{ enabled: boolean, schedules: Array<{ id: string, time: string, period: string, enabled: boolean }> }}
 */
export const getSavedSchedulesConfig = () => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && Array.isArray(parsed.schedules)) {
        return {
          enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : true,
          schedules: parsed.schedules,
        };
      }
    }
  } catch (e) {
    console.warn('[ScheduleService] 讀取排程配置失敗，使用預設值:', e);
  }

  // 預設配置
  return {
    enabled: true,
    schedules: DEFAULT_SCHEDULES,
  };
};

/**
 * 儲存排程配置至 localStorage
 * @param {Object} config 
 */
export const saveSchedulesConfig = (config) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('[ScheduleService] 儲存排程配置失敗:', e);
  }
};

/**
 * 取得標準課堂排程範本
 */
export const getDefaultSchedules = () => {
  return JSON.parse(JSON.stringify(DEFAULT_SCHEDULES));
};

/**
 * 計算下一個即將到達的排程
 * @param {Object} config 
 * @returns {{ schedule: Object, diffMinutes: number, formattedText: string } | null}
 */
export const getNextUpcomingSchedule = (config) => {
  if (!config || !config.enabled || !Array.isArray(config.schedules)) {
    return null;
  }

  const activeSchedules = config.schedules
    .filter((s) => s.enabled && typeof s.time === 'string' && s.time.includes(':'))
    .sort((a, b) => a.time.localeCompare(b.time));

  if (activeSchedules.length === 0) return null;

  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTotalMins = currentHours * 60 + currentMinutes;

  // 1. 尋找今天尚未到達的排程
  for (const item of activeSchedules) {
    const [hStr, mStr] = item.time.split(':');
    const itemTotalMins = parseInt(hStr, 10) * 60 + parseInt(mStr, 10);

    if (itemTotalMins > currentTotalMins) {
      const diffMinutes = itemTotalMins - currentTotalMins;
      return {
        schedule: item,
        diffMinutes,
        formattedText: `今日 ${item.time} (${item.period}) · 剩餘 ${diffMinutes} 分鐘`,
        isTomorrow: false,
      };
    }
  }

  // 2. 今日排程已過，取明天的第一個排程
  const firstTomorrow = activeSchedules[0];
  const [hStr, mStr] = firstTomorrow.time.split(':');
  const itemTotalMins = parseInt(hStr, 10) * 60 + parseInt(mStr, 10);
  const diffMinutes = (24 * 60 - currentTotalMins) + itemTotalMins;

  return {
    schedule: firstTomorrow,
    diffMinutes,
    formattedText: `明日 ${firstTomorrow.time} (${firstTomorrow.period})`,
    isTomorrow: true,
  };
};

/**
 * 檢查當前時間是否應觸發排程點名 (含同日期分鐘防重防護)
 * @param {Object} config 
 * @param {string|null} lastTriggerKey 
 * @returns {{ shouldTrigger: boolean, schedule: Object, triggerKey: string } | null}
 */
export const checkScheduleTrigger = (config, lastTriggerKey) => {
  if (!config || !config.enabled || !Array.isArray(config.schedules)) {
    return null;
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  const todayDateStr = `${year}-${month}-${day}`;
  const currentHHmm = `${hours}:${minutes}`;

  // 尋找符合當前時間且啟用的排程
  const matched = config.schedules.find((s) => s.enabled && s.time === currentHHmm);
  if (!matched) {
    return null;
  }

  const triggerKey = `${todayDateStr}_${currentHHmm}_${matched.id}`;
  if (triggerKey === lastTriggerKey) {
    // 當前分鐘已觸發過
    return null;
  }

  return {
    shouldTrigger: true,
    schedule: matched,
    triggerKey,
  };
};
