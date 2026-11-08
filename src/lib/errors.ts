import { toast } from 'sonner';
import { buildIssueUrl } from '@/lib/report-issue';

export interface FriendlyError {
  /** Message safe to show to end users */
  message: string;
  /** True when the error is not one we recognise (worth reporting) */
  unexpected: boolean;
  code?: string;
  detail?: string;
}

interface ErrorLike {
  code?: unknown;
  message?: unknown;
}

function asErrorLike(error: unknown): ErrorLike {
  if (error && typeof error === 'object') return error as ErrorLike;
  if (typeof error === 'string') return { message: error };
  return {};
}

/**
 * Turn a Supabase/Postgrest/network error into a message end users can act on.
 * PostgrestError is a plain object (not an Error instance), so inspect fields.
 */
export function friendlyError(error: unknown, fallback: string): FriendlyError {
  const e = asErrorLike(error);
  const code = typeof e.code === 'string' ? e.code : undefined;
  const raw = typeof e.message === 'string' ? e.message : undefined;
  const lower = (raw ?? '').toLowerCase();

  if (code === '42501' || lower.includes('row-level security') || lower.includes('permission denied')) {
    return {
      message: '你沒有權限做這個操作。請確認你已被指派到這個班級，或聯繫學校主管。',
      unexpected: false,
      code,
      detail: raw,
    };
  }
  if (lower.includes('invalid login credentials')) {
    return { message: '信箱或密碼不正確。請確認後再試一次，或使用「忘記密碼」。', unexpected: false, code, detail: raw };
  }
  if (lower.includes('password should be at least') || lower.includes('password is too short')) {
    return { message: '密碼太短，至少需要 6 個字元。', unexpected: false, code, detail: raw };
  }
  if (lower.includes('same password') || lower.includes('different from the old password')) {
    return { message: '新密碼不能和舊密碼一樣。', unexpected: false, code, detail: raw };
  }
  if (lower.includes('already registered') || lower.includes('already been registered')) {
    return { message: '這個信箱已經註冊過了。', unexpected: false, code, detail: raw };
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return { message: '操作太頻繁了，請等一分鐘再試。', unexpected: false, code, detail: raw };
  }
  if (lower.includes('email not confirmed')) {
    return { message: '這個信箱還沒有完成驗證。請到信箱點選驗證連結。', unexpected: false, code, detail: raw };
  }
  if (code === 'PGRST202' || lower.includes('could not find the function')) {
    return {
      message: '系統功能尚未更新到最新版本。請聯繫系統管理員更新資料庫後再試。',
      unexpected: false,
      code,
      detail: raw,
    };
  }
  if (code === '23505' || lower.includes('duplicate key')) {
    return { message: '這筆資料已經存在，不需要重複建立。', unexpected: false, code, detail: raw };
  }
  if (code === '23503' || lower.includes('foreign key')) {
    return {
      message: '這筆資料還有其他資料在使用，請先移除相關資料再試一次。',
      unexpected: false,
      code,
      detail: raw,
    };
  }
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('network request failed')) {
    return { message: '網路連線不穩，請檢查網路後再試一次。', unexpected: false, code, detail: raw };
  }
  // RPC functions raise Chinese messages for expected business rules; those are safe to show.
  if (raw && /[一-鿿]/.test(raw) && code === 'P0001') {
    return { message: raw, unexpected: false, code, detail: raw };
  }

  return { message: fallback, unexpected: true, code, detail: raw };
}

/** Show an error toast. Unexpected errors get a button that opens a prefilled GitHub issue. */
export function toastError(error: unknown, fallback: string): void {
  const friendly = friendlyError(error, fallback);
  if (!friendly.unexpected) {
    toast.error(friendly.message);
    return;
  }
  const url = buildIssueUrl({
    where: typeof window === 'undefined' ? '' : window.location.pathname,
    summary: friendly.message,
    code: friendly.code,
    detail: friendly.detail,
  });
  toast.error(friendly.message, {
    action: {
      label: '回報問題',
      onClick: () => window.open(url, '_blank', 'noopener,noreferrer'),
    },
  });
}
