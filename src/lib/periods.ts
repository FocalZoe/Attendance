/** 點名節次選項（顯示順序與 seatOccupancyService.formatFullPeriodMessage 的標籤一致） */
export const PERIOD_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'morning', label: '晨間點名' },
  { value: '1', label: '第 1 節' },
  { value: '2', label: '第 2 節' },
  { value: '3', label: '第 3 節' },
  { value: '4', label: '第 4 節' },
  { value: 'afternoon', label: '午後點名' },
  { value: '5', label: '第 5 節' },
  { value: '6', label: '第 6 節' },
  { value: '7', label: '第 7 節' },
  { value: '8', label: '第 8 節' },
];

export function periodLabel(period: string): string {
  return PERIOD_OPTIONS.find((p) => p.value === period)?.label ?? `第 ${period} 節`;
}
