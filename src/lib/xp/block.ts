export const XP_PER_STUDY_MINUTE = 1;
export const XP_BLOCK_COMPLETE_BONUS = 10;
export const XP_ALL_BLOCKS_COMPLETE_BONUS = 50;
export const XP_BOOK_COMPLETE_BONUS = 300;
export const XP_NEW_LOCATION_BONUS = 100;

export interface BlockXpInput {
  status: "planned" | "done" | "partial" | "skipped";
  actualMin: number | null;
  /** このブロック以外に、同じ場所での完了/一部完了の記録が過去に一度もないか（呼び出し側がDBを見て判定する）。 */
  isFirstAtLocation: boolean;
}

/**
 * 1ブロックぶんのXPを計算する純粋関数。done/partial以外は0（skipped・plannedは勉強時間として記録されないため）。
 * 実施分数×1XP + ブロック完了ボーナス10XP（+ 初めての場所なら+100XP）。
 */
export function computeBlockXp(input: BlockXpInput): number {
  if (input.status !== "done" && input.status !== "partial") return 0;
  const minutes = Math.max(0, input.actualMin ?? 0);
  let xp = minutes * XP_PER_STUDY_MINUTE + XP_BLOCK_COMPLETE_BONUS;
  if (input.isFirstAtLocation) xp += XP_NEW_LOCATION_BONUS;
  return xp;
}

/** 1日の全studyブロックがdoneのみ（partial・skipped・plannedを含まない）かどうかを判定する純粋関数。 */
export function isDayFullyComplete(statuses: BlockXpInput["status"][]): boolean {
  return statuses.length > 0 && statuses.every((s) => s === "done");
}
