import type { HourlyWeatherPoint } from "./types";

export interface DayWeatherStore {
  find(userId: string, date: string): Promise<{ hourly: HourlyWeatherPoint[] } | null>;
  save(userId: string, date: string, hourly: HourlyWeatherPoint[]): Promise<void>;
}

export type WeatherSource = "cache" | "api";

export interface DayWeatherResult {
  hourly: HourlyWeatherPoint[];
  source: WeatherSource;
}

/**
 * 当日の天気予報をキャッシュ(DayState)経由で取得する。
 * 同日にすでに取得済みなら再取得しない（リロール時も保存済みデータを使う）。
 * 取得に失敗した場合は例外を投げず null を返す（天気なしとして通常フローで開封を続ける）。
 */
export async function getDayWeather(params: {
  store: DayWeatherStore;
  userId: string;
  date: string; // "YYYY-MM-DD"
  fetchFn: () => Promise<HourlyWeatherPoint[]>;
}): Promise<DayWeatherResult | null> {
  const { store, userId, date, fetchFn } = params;

  const cached = await store.find(userId, date);
  if (cached) return { hourly: cached.hourly, source: "cache" };

  try {
    const hourly = await fetchFn();
    await store.save(userId, date, hourly);
    return { hourly, source: "api" };
  } catch (e) {
    console.error("[getDayWeather] 天気予報の取得に失敗しました。天気なしで続行します", e);
    return null;
  }
}
