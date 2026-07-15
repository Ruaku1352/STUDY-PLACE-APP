import type { PrismaClient } from "@prisma/client";
import { aggregateTo3Hour, computeBlockStartTimes, summarizeDayWeather } from "./aggregate";
import { getDayWeather } from "./cache";
import { fetchDayWeather } from "./openMeteo";
import { createPrismaDayWeatherStore } from "./prismaStore";
import type { HourlyWeatherPoint, WeatherBlock3h, WeatherSummary } from "./types";

export interface ResolvedDayWeather {
  hourly: HourlyWeatherPoint[];
  summary: WeatherSummary;
  blocks: WeatherBlock3h[];
}

/**
 * 当日の天気予報をDB(DayState)キャッシュ経由で解決し、開封カード表示用の3時間ごとの
 * コマとサマリーまで組み立てる。自宅座標が未設定、またはAPI取得に失敗した場合はnullを返し、
 * 呼び出し側は天気なしの通常フローで開封を続ける。
 */
export async function resolveDayWeather(params: {
  prisma: PrismaClient;
  userId: string;
  date: string; // "YYYY-MM-DD"
  homeLat: number | null;
  homeLng: number | null;
  wakeTimeHHMM: string;
}): Promise<ResolvedDayWeather | null> {
  const { prisma, userId, date, homeLat, homeLng, wakeTimeHHMM } = params;
  if (homeLat === null || homeLng === null) return null;

  const result = await getDayWeather({
    store: createPrismaDayWeatherStore(prisma),
    userId,
    date,
    fetchFn: () => fetchDayWeather(homeLat, homeLng, date),
  });
  if (!result) return null;

  const blockStartTimes = computeBlockStartTimes(wakeTimeHHMM);
  return {
    hourly: result.hourly,
    summary: summarizeDayWeather(result.hourly, wakeTimeHHMM),
    blocks: aggregateTo3Hour(result.hourly, blockStartTimes),
  };
}
