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
      description: '這裡是今天的點名提醒，平常收合在旁邊，點開就能看到下一節並一鍵開始點名。時間快到時也會提醒你。',
      side: 'left',
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
      title: '建立班級',
      description: '在「班級」建立班級。點一個班級，下方就會出現這個班的老師、學生名冊、座位表與出勤紀錄。',
      side: 'bottom',
    },
    {
      selector: '[data-tour="sa-class-detail"]',
      title: '管理這個班級',
      description: '在這裡指派導師與科任老師、新增學生、排座位，也能查看每次點名的結果並更正。',
      side: 'top',
    },
    {
      selector: '[data-tour="sa-teachers"]',
      title: '新增教師帳號',
      description: '到「教師」新增帳號，建立時可以直接指派班級，也能看到每位老師負責哪些班。',
      side: 'bottom',
    },
    {
      selector: '[data-tour="sa-schedule"]',
      title: '設定全校點名時間',
      description: '在「點名時間」設定每一節的上課時間，設定一次，全校所有班級與老師都會套用，時間快到時老師會收到提醒。',
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
