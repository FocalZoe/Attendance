export const MIN_PASSWORD_LENGTH = 6;

/** 回傳錯誤訊息；合法則回傳 null。密碼不做 trim，與註冊/登入行為一致。 */
export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `密碼長度至少需 ${MIN_PASSWORD_LENGTH} 個字元`;
  }
  return null;
}
