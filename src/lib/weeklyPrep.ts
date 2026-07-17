import { addDaysToDate, weekdayIndex } from "./scheduler/time";

/** 日曜18時以降〜月曜終日を「来週の準備」を促すべき時間帯とする。 */
export function isWeeklyPrepWindow(now: Date = new Date()): boolean {
  const day = now.getDay(); // 0=Sun..6=Sat（JS標準）
  if (day === 0) return now.getHours() >= 18;
  if (day === 1) return true;
  return false;
}

/** 指定日から見て次の月曜日を返す（今日が月曜なら7日後、日曜なら翌日）。 */
export function nextWeekStartDateFrom(today: string): string {
  return addDaysToDate(today, 7 - weekdayIndex(today));
}
