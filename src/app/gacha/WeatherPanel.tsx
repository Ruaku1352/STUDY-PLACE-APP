import { weatherCodeToEmoji } from "@/lib/weather/aggregate";
import type { RevealWeather } from "./types";

/** 天気サマリー＋3時間ごとの内訳。開封カードと、開封後の常時表示（TodayClient）の両方から使う。 */
export function WeatherPanel({ weather }: { weather: RevealWeather }) {
  return (
    <div className="gacha-weather">
      <p className="gacha-weather-summary">
        {Math.round(weather.minTempC)}℃〜{Math.round(weather.maxTempC)}℃
        {weather.isRainy && ` ・ 降水確率最大${Math.round(weather.maxPrecipitationProbability)}%`}
      </p>
      <div className="gacha-weather-blocks">
        {weather.blocks.map((b) => (
          <div
            key={b.time}
            className={`gacha-weather-block${b.precipitationProbability >= 50 ? " gacha-weather-block-rainy" : ""}`}
          >
            <span className="gacha-weather-block-time">{b.time}</span>
            <span className="gacha-weather-block-icon" aria-hidden="true">
              {weatherCodeToEmoji(b.weatherCode)}
            </span>
            <span className="gacha-weather-block-temp">{Math.round(b.temperatureC)}℃</span>
          </div>
        ))}
      </div>
    </div>
  );
}
