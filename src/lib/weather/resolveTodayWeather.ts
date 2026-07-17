import type { PrismaClient } from "@prisma/client";
import { dateStringToDate } from "../date";
import { weekdayIndex } from "../scheduler/time";
import { resolveDayWeather, type ResolvedDayWeather } from "./resolveDayWeather";

/**
 * その日の出発地点（DayState.startPointIdで選択済み、未選択ならデフォルト出発地点）の
 * 座標をもとに、指定日の天気予報一式を解決する。
 * 出発地点が未登録・座標未解決・API取得に失敗した場合はnullを返し、呼び出し側は
 * 天気なしの通常フローで続行する。開封時・開封後の常時表示の両方から使う。
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

  const dayState = await prisma.dayState.findUnique({
    where: { userId_date: { userId, date: dateStringToDate(date) } },
  });
  const startPoint = dayState?.startPointId
    ? await prisma.startPoint.findFirst({ where: { id: dayState.startPointId, userId } })
    : await prisma.startPoint.findFirst({ where: { userId, isDefault: true } });

  if (startPoint?.lat == null || startPoint?.lng == null) return null;

  return resolveDayWeather({
    prisma,
    userId,
    date,
    homeLat: startPoint.lat,
    homeLng: startPoint.lng,
    wakeTimeHHMM,
  });
}
