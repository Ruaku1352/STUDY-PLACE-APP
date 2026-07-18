"use client";

import type { RevealResult, RevealWeather } from "./types";
import { WeatherPanel } from "./WeatherPanel";

export function RevealCard({
  result,
  missionText,
  weather,
  weatherLoaded,
  streakDays,
  onClose,
}: {
  result: RevealResult;
  /** nullの間はミッション文をまだ取得中（プレースホルダーを表示する）。 */
  missionText: string | null;
  weather: RevealWeather | null;
  /** weather取得が完了したか（trueになるまでは天気の有無に関わらずスケルトンを出す）。 */
  weatherLoaded: boolean;
  streakDays: number;
  onClose: () => void;
}) {
  return (
    <div className="gacha-reveal-card">
      <p className="gacha-reveal-streak">🔥 {streakDays}日目！</p>

      {!weatherLoaded && (
        <div className="gacha-skeleton-block" style={{ height: "4.5rem" }} aria-hidden="true" />
      )}
      {weatherLoaded && weather && <WeatherPanel weather={weather} />}

      {missionText === null ? (
        <div className="gacha-skeleton-lines" aria-hidden="true">
          <div className="gacha-skeleton-line" />
          <div className="gacha-skeleton-line" style={{ width: "80%" }} />
        </div>
      ) : (
        <p className="gacha-reveal-mission gacha-reveal-mission-in">{missionText}</p>
      )}

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
