const MIN_BLOCK_FOR_BUDGET = 60;

/**
 * totalUnits 個の単位を totalDays 日にできるだけ均等に配分する（Bresenham風）。
 * 端数の丸めは四捨五入を使うことで、単純な切り捨てが先頭の日を0にしてしまう
 * 偏りを避ける。
 */
export function distributeEvenly(totalUnits: number, totalDays: number): number[] {
  const perDay: number[] = [];
  for (let d = 0; d < totalDays; d++) {
    const upper = Math.round(((d + 1) * totalUnits) / totalDays);
    const lower = Math.round((d * totalUnits) / totalDays);
    perDay.push(upper - lower);
  }
  return perDay;
}

/**
 * 科目ごとに、生成対象の各日に割り当ててよい上限分数（dailyLimit）を計算する。
 * ノルマを60分単位に切り上げてから均等配分することで、
 * 「1場所あたり最小60分ブロック」を守りつつ、特定の日（特に週の前半）に
 * 偏って割り当てられることを防ぐ。
 *
 * 戻り値: subjectId -> 各日（0-indexed, 長さ totalDays）の上限分数
 */
export function computeDailyLimits(
  subjects: Array<{ id: string; quotaMin: number }>,
  totalDays: number,
): Map<string, number[]> {
  const result = new Map<string, number[]>();
  for (const s of subjects) {
    const units = Math.ceil(Math.max(0, s.quotaMin) / MIN_BLOCK_FOR_BUDGET);
    const perDayUnits = distributeEvenly(units, totalDays);
    result.set(
      s.id,
      perDayUnits.map((u) => u * MIN_BLOCK_FOR_BUDGET),
    );
  }
  return result;
}
