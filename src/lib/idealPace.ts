/**
 * 週の実際の開始日(effectiveStartDate)〜週末(weekEndDate)を100%として、
 * today時点での理想ペース(%)を計算する純粋関数。
 * 週の途中から設定した場合はeffectiveStartDateがweekStartDateより後になり、
 * 分母となる日数もその分短くなる（月曜起点固定にしない）。
 */
export function computeIdealPacePercent(effectiveStartDate: string, weekEndDate: string, today: string): number {
  const start = new Date(`${effectiveStartDate}T00:00:00Z`).getTime();
  const end = new Date(`${weekEndDate}T00:00:00Z`).getTime();
  const now = new Date(`${today}T00:00:00Z`).getTime();

  const totalDays = Math.round((end - start) / 86_400_000) + 1;
  if (totalDays <= 0) return 100;

  const elapsedDays = Math.round((now - start) / 86_400_000) + 1;
  const clampedElapsed = Math.max(0, Math.min(totalDays, elapsedDays));

  return Math.round((clampedElapsed / totalDays) * 100);
}
