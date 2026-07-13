import { addDaysToDate, weekdayIndex } from "./scheduler/time";

export interface StreakState {
  currentCount: number;
  longestCount: number;
  lastQualifiedDate: string | null; // "YYYY-MM-DD"
  freezeUsedInWeek: boolean;
}

export interface ApplyDailyResultParams {
  /** その日の判定対象日（"YYYY-MM-DD"）。ブロックを1つ以上完了/一部完了にした日。 */
  date: string;
  /** その日に完了/一部完了のブロックが1件以上あるか */
  hasProgress: boolean;
}

export interface ApplyDailyResultResult extends StreakState {
  /** このフィールド更新でフリーズが発動したか */
  freezeTriggered: boolean;
}

function weekStartOf(date: string): string {
  return addDaysToDate(date, -weekdayIndex(date));
}

function daysBetween(from: string, to: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / msPerDay);
}

/**
 * ストリーク状態にその日の実績を反映する純粋関数（JST日付基準、"YYYY-MM-DD"文字列で扱う）。
 * - 前日から連続していれば継続
 * - ちょうど1日だけ空いた場合は週1回まで自動フリーズで継続を救済
 * - フリーズは週（月曜開始）が変わるたびにリセットされる
 * - 同じ日に複数回呼ばれても（date === lastQualifiedDate）冪等
 */
export function applyDailyResult(streak: StreakState, params: ApplyDailyResultParams): ApplyDailyResultResult {
  const { date, hasProgress } = params;

  if (!hasProgress || streak.lastQualifiedDate === date) {
    return { ...streak, freezeTriggered: false };
  }

  const currentWeekStart = weekStartOf(date);
  const freezeUsedInWeek =
    streak.lastQualifiedDate !== null && weekStartOf(streak.lastQualifiedDate) === currentWeekStart
      ? streak.freezeUsedInWeek
      : false;

  if (streak.lastQualifiedDate === null) {
    const currentCount = 1;
    return {
      currentCount,
      longestCount: Math.max(streak.longestCount, currentCount),
      lastQualifiedDate: date,
      freezeUsedInWeek,
      freezeTriggered: false,
    };
  }

  const gap = daysBetween(streak.lastQualifiedDate, date);

  if (gap === 1) {
    const currentCount = streak.currentCount + 1;
    return {
      currentCount,
      longestCount: Math.max(streak.longestCount, currentCount),
      lastQualifiedDate: date,
      freezeUsedInWeek,
      freezeTriggered: false,
    };
  }

  if (gap === 2 && !freezeUsedInWeek) {
    const currentCount = streak.currentCount + 1;
    return {
      currentCount,
      longestCount: Math.max(streak.longestCount, currentCount),
      lastQualifiedDate: date,
      freezeUsedInWeek: true,
      freezeTriggered: true,
    };
  }

  // フリーズ不可（2日以上のギャップ、または今週フリーズ使用済み）→ 途切れて1からリスタート
  const currentCount = 1;
  return {
    currentCount,
    longestCount: Math.max(streak.longestCount, currentCount),
    lastQualifiedDate: date,
    freezeUsedInWeek,
    freezeTriggered: false,
  };
}
