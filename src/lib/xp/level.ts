/** Lv.N→N+1 に必要なXP = 100×N（累積）。 */
export const XP_PER_LEVEL_STEP = 100;

/** レベルNに到達するために必要な累積XP（Lv.1は0から開始）。 */
export function cumulativeXpForLevel(level: number): number {
  if (level <= 1) return 0;
  return (XP_PER_LEVEL_STEP * (level - 1) * level) / 2;
}

export interface LevelInfo {
  level: number;
  /** このレベル内で獲得したXP。 */
  currentLevelXp: number;
  /** 次のレベルまでの残りXP。 */
  xpToNextLevel: number;
  /** 次のレベルに必要なXP幅（100×level）。 */
  xpForNextLevel: number;
}

/** 累積XPから現在のレベルと進捗を算出する純粋関数。 */
export function levelInfoFromTotalXp(totalXp: number): LevelInfo {
  const xp = Math.max(0, totalXp);
  let level = 1;
  while (cumulativeXpForLevel(level + 1) <= xp) {
    level++;
  }
  const baseXp = cumulativeXpForLevel(level);
  const xpForNextLevel = XP_PER_LEVEL_STEP * level;
  const currentLevelXp = xp - baseXp;
  return {
    level,
    currentLevelXp,
    xpToNextLevel: xpForNextLevel - currentLevelXp,
    xpForNextLevel,
  };
}
