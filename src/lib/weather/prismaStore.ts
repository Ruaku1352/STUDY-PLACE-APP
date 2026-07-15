import type { Prisma, PrismaClient } from "@prisma/client";
import { dateStringToDate } from "../date";
import type { DayWeatherStore } from "./cache";
import type { HourlyWeatherPoint } from "./types";

export function createPrismaDayWeatherStore(prisma: PrismaClient): DayWeatherStore {
  return {
    async find(userId, date) {
      const dayState = await prisma.dayState.findUnique({
        where: { userId_date: { userId, date: dateStringToDate(date) } },
      });
      if (!dayState?.weatherJson || !dayState.weatherFetchedAt) return null;
      return { hourly: dayState.weatherJson as unknown as HourlyWeatherPoint[] };
    },
    async save(userId, date, hourly) {
      await prisma.dayState.updateMany({
        where: { userId, date: dateStringToDate(date) },
        data: { weatherJson: hourly as unknown as Prisma.InputJsonValue, weatherFetchedAt: new Date() },
      });
    },
  };
}
