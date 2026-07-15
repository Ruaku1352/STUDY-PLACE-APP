import type { HourlyWeatherPoint } from "./types";

/** 開発用モック切り替え。true のとき Open-Meteo APIを一切呼ばず固定値を返す。 */
export function isMockWeatherApiEnabled(): boolean {
  return process.env.MOCK_WEATHER_API === "true";
}

/** 7:00〜21:00の晴れ〜曇りの1時間ごとモックデータ。 */
export const MOCK_HOURLY_WEATHER: HourlyWeatherPoint[] = Array.from({ length: 15 }, (_, i) => {
  const hour = 7 + i;
  return {
    time: `${hour.toString().padStart(2, "0")}:00`,
    weatherCode: i % 4 === 0 ? 2 : 1,
    temperatureC: 20 + Math.round(Math.sin((i / 15) * Math.PI) * 5),
    precipitationProbability: 10,
  };
});
