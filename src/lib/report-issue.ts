export const ISSUES_NEW_URL = 'https://github.com/FocalZoe/Attendance/issues/new';

const MAX_URL_LENGTH = 1900;

export interface IssueInput {
  /** Screen path, e.g. location.pathname */
  where: string;
  /** Plain-language description shown to the user */
  summary: string;
  /** Error code if known (e.g. Postgres 42501) */
  code?: string;
  /** Raw error message (technical detail for developers) */
  detail?: string;
}

/**
 * Build a prefilled "new issue" URL. No token is involved: the user reviews and
 * submits the issue on GitHub themselves. Only technical context is included,
 * never personal data (no email, names, phone numbers or tokens).
 */
export function buildIssueUrl(input: IssueInput, now: Date = new Date()): string {
  const title = `[錯誤] ${input.where}：${input.summary}`.slice(0, 120);

  const lines = [
    '### 發生了什麼事',
    input.summary,
    '',
    '### 技術資訊',
    `- 畫面：${input.where}`,
    `- 錯誤代碼：${input.code || '無'}`,
    `- 訊息：${input.detail || '無'}`,
    `- 時間：${now.toISOString()}`,
    `- 瀏覽器：${typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent}`,
    '',
    '### 操作步驟（請補充）',
    '1. ',
  ];

  let body = lines.join('\n');
  const build = (b: string) =>
    `${ISSUES_NEW_URL}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(b)}&labels=bug`;

  let url = build(body);
  // Trim the body until the encoded URL fits in typical browser/GitHub limits
  while (url.length > MAX_URL_LENGTH && body.length > 200) {
    body = body.slice(0, Math.floor(body.length * 0.8));
    url = build(body);
  }
  return url;
}
