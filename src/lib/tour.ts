export type TourRole = 'teacher' | 'school_admin';

export interface TourStep {
  /** CSS selector of the element to spotlight, usually [data-tour="..."] */
  selector: string;
  title: string;
  description: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export const START_TOUR_EVENT = 'attendance:start-tour';

export const TOUR_STEPS: Record<TourRole, TourStep[]> = {
  teacher: [
    {
      selector: '[data-tour="today"]',
      title: '今天的點名',
      description: '這裡會顯示今天的點名時間。時間快到時會提醒你，並讓你一鍵開始點名。',
      side: 'bottom',
    },
    {
      selector: '[data-tour="camera-permission"]',
      title: '先允許使用鏡頭',
      description: '按「允許使用鏡頭」，瀏覽器詢問時選「允許」。只要允許一次，以後點名就會自動開啟鏡頭。',
      side: 'bottom',
    },
    {
      selector: '[data-tour="classes"]',
      title: '你的班級',
      description: '你負責的班級都在這裡。每個班級右邊有三個按鈕，下面一個一個介紹。',
      side: 'top',
    },
    {
      selector: '[data-tour="seat"]',
      title: '第一步：排座位',
      description: '第一次使用先按「座位」，把每位學生排到教室的座位上。點名時，鏡頭就知道誰該坐哪裡。',
      side: 'left',
    },
    {
      selector: '[data-tour="rollcall"]',
      title: '第二步：開始點名',
      description: '按「點名」會開啟鏡頭，系統自動看每個座位有沒有人。你確認後按「完成點名」就存檔了。',
      side: 'left',
    },
    {
      selector: '[data-tour="records"]',
      title: '看點名結果',
      description: '每一欄是一次點名，每一列是一位學生。圖示不對的話，直接點它就能更正。',
      side: 'bottom',
    },
    {
      selector: '[data-tour="account"]',
      title: '帳號選單',
      description: '在這裡可以修改密碼、切換深色模式，或隨時重看這份導覽。',
      side: 'bottom',
    },
  ],
  school_admin: [
    {
      selector: '[data-tour="sa-classes"]',
      title: '建立班級與教師',
      description: '先在「班級與教師」建立班級、新增教師帳號，再指派誰是導師或科任老師。',
      side: 'bottom',
    },
    {
      selector: '[data-tour="sa-schedule"]',
      title: '設定每位老師的點名時間',
      description: '在班級列按「課表」，選老師、星期與節次。時間快到時，老師的網頁會提醒他點名。',
      side: 'left',
    },
    {
      selector: '[data-tour="sa-students"]',
      title: '建立學生名冊',
      description: '到「學生名冊」選一個班級，新增學生。有名冊，老師才能排座位與點名。',
      side: 'bottom',
    },
    {
      selector: '[data-tour="sa-attendance"]',
      title: '查看全校出勤',
      description: '選一個班級，就能看到每次點名的結果，也可以更正或下載成 Excel 檔。',
      side: 'bottom',
    },
    {
      selector: '[data-tour="account"]',
      title: '帳號選單',
      description: '在這裡可以修改密碼、切換深色模式，或隨時重看這份導覽。',
      side: 'bottom',
    },
  ],
};

export function tourStorageKey(role: TourRole, userId: string): string {
  return `attendance:tour:${role}:${userId}`;
}

export function hasSeenTour(role: TourRole, userId: string): boolean {
  try {
    return window.localStorage.getItem(tourStorageKey(role, userId)) === 'done';
  } catch {
    // Storage can be blocked (private mode); treat as not seen but never throw
    return false;
  }
}

export function markTourSeen(role: TourRole, userId: string): void {
  try {
    window.localStorage.setItem(tourStorageKey(role, userId), 'done');
  } catch {
    /* ignore */
  }
}

/** Keep only steps whose target element is actually on the page */
export function availableSteps(steps: TourStep[], exists: (selector: string) => boolean): TourStep[] {
  return steps.filter((step) => exists(step.selector));
}
