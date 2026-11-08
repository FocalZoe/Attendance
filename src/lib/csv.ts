export type CsvCell = string | number | boolean | null | undefined;

/**
 * 逸出單一欄位，並防範 CSV / Excel 公式注入：
 * 文字欄位若以 = + - @ 或 Tab / CR 開頭，前置單引號使其被視為純文字。
 * 數字與布林值不受影響。
 */
export function csvEscape(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  let text = value;
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(rows: CsvCell[][]): string {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
}

/** 下載 CSV；加上 UTF-8 BOM 讓 Excel 正確顯示中文。 */
export function downloadCsv(filename: string, csvText: string): void {
  const blob = new Blob(['﻿', csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
