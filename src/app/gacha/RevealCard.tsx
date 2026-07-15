"use client";

import { weatherCodeToEmoji } from "@/lib/weather/aggregate";
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
  const { weather } = result;

  return (
    <div className="gacha-reveal-card">
      <p className="gacha-reveal-streak">🔥 {streakDays}日目！</p>

      {weather && (
        <div className="gacha-weather">
          <p className="gacha-weather-summary">
            {Math.round(weather.minTempC)}℃〜{Math.round(weather.maxTempC)}℃
            {weather.isRainy && ` ・ 降水確率最大${Math.round(weather.maxPrecipitationProbability)}%`}
          </p>
          <div className="gacha-weather-blocks">
            {weather.blocks.map((b) => (
              <div key={b.time} className={`gacha-weather-block${b.precipitationProbability >= 50 ? " gacha-weather-block-rainy" : ""}`}>
                <span className="gacha-weather-block-time">{b.time}</span>
                <span className="gacha-weather-block-icon" aria-hidden="true">
                  {weatherCodeToEmoji(b.weatherCode)}
                </span>
                <span className="gacha-weather-block-temp">{Math.round(b.temperatureC)}℃</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
