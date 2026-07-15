"use client";

import type { RevealResult } from "./types";
import { WeatherPanel } from "./WeatherPanel";

export function RevealCard({
  result,
  streakDays,
  onClose,
}: {
  result: RevealResult;
  streakDays: number;
  onClose: () => void;
}) {
  const { weather } = result;

  return (
    <div className="gacha-reveal-card">
      <p className="gacha-reveal-streak">🔥 {streakDays}日目！</p>

      {weather && <WeatherPanel weather={weather} />}

      <p className="gacha-reveal-mission">{result.missionText}</p>
      {result.rainRuleApplied && <p className="gacha-reveal-rain-note">☔ 雨予報のため近場を優先して選びました</p>}
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
