import { describe, expect, it } from 'vitest';
import { friendlyError } from './errors';
import { buildIssueUrl, ISSUES_NEW_URL } from './report-issue';

describe('friendlyError', () => {
  it('maps RLS violations to a permission message', () => {
    const r = friendlyError(
      { code: '42501', message: 'new row violates row-level security policy for table "x"' },
      'fallback'
    );
    expect(r.unexpected).toBe(false);
    expect(r.message).toContain('沒有權限');
  });

  it('maps duplicate and foreign key errors', () => {
    expect(friendlyError({ code: '23505', message: 'dup' }, 'f').message).toContain('已經存在');
    expect(friendlyError({ code: '23503', message: 'fk' }, 'f').message).toContain('其他資料');
  });

  it('maps a missing database function to an update-needed message', () => {
    const r = friendlyError({ code: 'PGRST202', message: 'Could not find the function public.x' }, 'f');
    expect(r.unexpected).toBe(false);
    expect(r.message).toContain('更新');
  });

  it('maps network failures', () => {
    expect(friendlyError(new Error('Failed to fetch'), 'f').message).toContain('網路');
  });

  it('passes through Chinese business-rule messages raised by RPCs', () => {
    const r = friendlyError({ code: 'P0001', message: '不可停用或啟用自己的帳號' }, 'f');
    expect(r.message).toBe('不可停用或啟用自己的帳號');
  });

  it('uses the fallback and flags unknown errors as unexpected', () => {
    const r = friendlyError({ code: 'XX000', message: 'boom' }, '操作失敗');
    expect(r).toMatchObject({ message: '操作失敗', unexpected: true, detail: 'boom' });
  });

  it('handles non-object errors', () => {
    expect(friendlyError(undefined, 'f').message).toBe('f');
    expect(friendlyError('Failed to fetch', 'f').unexpected).toBe(false);
  });
});

describe('buildIssueUrl', () => {
  it('targets the repository issue form with a prefilled title', () => {
    const url = buildIssueUrl({ where: '/dashboard', summary: '儲存失敗', code: 'X' });
    expect(url.startsWith(`${ISSUES_NEW_URL}?title=`)).toBe(true);
    expect(decodeURIComponent(url)).toContain('[錯誤] /dashboard：儲存失敗');
  });

  it('keeps the URL within the length limit for long details', () => {
    const url = buildIssueUrl({ where: '/x', summary: 's', detail: 'a'.repeat(10000) });
    expect(url.length).toBeLessThanOrEqual(1900);
  });
});
