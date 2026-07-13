"use client";

import type { RevealResult } from "./types";

export function RevealCard({
  result,
  streakDays,
  onClose,
}: {
  result: RevealResult;
  streakDays: number;
  onClose: () => void;
}) {
  return (
    <div className="gacha-reveal-card">
      <p className="gacha-reveal-streak">🔥 {streakDays}日目！</p>
      <p className="gacha-reveal-mission">{result.missionText}</p>
      {result.locationNames.length > 0 && (
        <p className="gacha-reveal-summary">
          本日は {result.locationNames.join(" → ")} で合計{result.totalStudyMin}分の勉強ミッション
        </p>
      )}
      <button type="button" className="button-primary button-block" onClick={onClose}>
        閉じる
      </button>
    </div>
  );
}
