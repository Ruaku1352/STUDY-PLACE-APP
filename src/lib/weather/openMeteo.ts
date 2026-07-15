import { isMockWeatherApiEnabled, MOCK_HOURLY_WEATHER } from "./mock";
import type { HourlyWeatherPoint } from "./types";

interface OpenMeteoHourlyResponse {
  hourly?: {
    time: string[];
    weathercode: number[];
    temperature_2m: number[];
    precipitation_probability: number[];
  };
}

/**
 * Open-Meteo（無料・APIキー不要）から指定日の1時間ごとの天気予報を取得する。
 * 失敗時は例外を投げる（呼び出し側でキャッシュ・フォールバックを行う）。
 */
export async function fetchDayWeather(lat: number, lng: number, dateStr: string): Promise<HourlyWeatherPoint[]> {
  if (isMockWeatherApiEnabled()) return MOCK_HOURLY_WEATHER;

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&hourly=weathercode,temperature_2m,precipitation_probability` +
    `&timezone=auto&start_date=${dateStr}&end_date=${dateStr}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo API request failed: ${res.status}`);

  const data = (await res.json()) as OpenMeteoHourlyResponse;
  if (!data.hourly) throw new Error("Open-Meteo APIのレスポンスにhourlyが含まれていません");

  const { time, weathercode, temperature_2m, precipitation_probability } = data.hourly;
  return time.map((t, i) => ({
    time: t.slice(11, 16),
    weatherCode: weathercode[i],
    temperatureC: temperature_2m[i],
    precipitationProbability: precipitation_probability[i],
  }));
}
