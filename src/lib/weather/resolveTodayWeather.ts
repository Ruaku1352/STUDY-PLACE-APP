import type { PrismaClient } from "@prisma/client";
import { resolveHomeCoordinates } from "../google/resolveHomeCoordinates";
import { weekdayIndex } from "../scheduler/time";
import { resolveDayWeather, type ResolvedDayWeather } from "./resolveDayWeather";

/**
 * ユーザーの設定(自宅住所・起床時刻)から、指定日の天気予報一式を解決する。
 * Settings未登録・自宅座標が解決できない・API取得に失敗した場合はnullを返し、
 * 呼び出し側は天気なしの通常フローで続行する。開封時・開封後の常時表示の両方から使う。
 */
export async function resolveTodayWeatherForUser(params: {
  prisma: PrismaClient;
  userId: string;
  date: string; // "YYYY-MM-DD"
}): Promise<ResolvedDayWeather | null> {
  const { prisma, userId, date } = params;

  const settings = await prisma.settings.findUnique({ where: { userId } });
  if (!settings) return null;

  const isWeekend = weekdayIndex(date) >= 5;
  const wakeTimeHHMM = isWeekend ? settings.wakeWeekend : settings.wakeWeekday;

  const homeLocation = await resolveHomeCoordinates({
    prisma,
    userId,
    homeAddress: settings.homeAddress,
    homeLat: settings.homeLat,
    homeLng: settings.homeLng,
  });
  if (!homeLocation) return null;

  return resolveDayWeather({
    prisma,
    userId,
    date,
    homeLat: homeLocation.lat,
    homeLng: homeLocation.lng,
    wakeTimeHHMM,
  });
}
