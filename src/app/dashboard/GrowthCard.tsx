import type { LevelInfo } from "@/lib/xp/level";

/** ダッシュボード最上部の「成長カード」。レベルを主役に、直下のXPバーとストリークを1箇所にまとめる。 */
export function GrowthCard({
  levelInfo,
  currentStreak,
  longestStreak,
}: {
  levelInfo: LevelInfo;
  currentStreak: number;
  longestStreak: number;
}) {
  const progressPercent =
    levelInfo.xpForNextLevel > 0 ? Math.round((levelInfo.currentLevelXp / levelInfo.xpForNextLevel) * 100) : 0;

  return (
    <div className="card growth-card">
      <div className="growth-card-top">
        <div className="level-badge">
          <span className="level-badge-label">Lv.</span>
          <span className="level-badge-number">{levelInfo.level}</span>
        </div>
        <div className="growth-card-xp">
          <div className="xp-bar">
            <div className="xp-bar-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="muted" style={{ fontSize: "0.8rem", marginTop: "0.35rem" }}>
            次のレベルまであと {levelInfo.xpToNextLevel} XP
          </p>
        </div>
      </div>
      <p className="growth-card-streak">
        🔥 現在 {currentStreak}日 ・ 最長記録 {longestStreak}日
      </p>
    </div>
  );
}
