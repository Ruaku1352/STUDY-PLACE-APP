import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { OpeningHoursStore, TravelCacheStore } from "./cache";
import type { PlacesWeeklyHours } from "./places";

export function createPrismaTravelCacheStore(prisma: PrismaClient): TravelCacheStore {
  return {
    async find(userId, fromKey, toKey) {
      const row = await prisma.travelCache.findUnique({
        where: { userId_fromKey_toKey: { userId, fromKey, toKey } },
      });
      return row ? { minutes: row.minutes, fetchedAt: row.fetchedAt } : null;
    },
    async upsert(userId, fromKey, toKey, minutes) {
      await prisma.travelCache.upsert({
        where: { userId_fromKey_toKey: { userId, fromKey, toKey } },
        create: { userId, fromKey, toKey, minutes },
        update: { minutes, fetchedAt: new Date() },
      });
    },
  };
}

export function createPrismaOpeningHoursStore(prisma: PrismaClient): OpeningHoursStore {
  return {
    async find(userId, locationId) {
      const loc = await prisma.location.findFirst({ where: { id: locationId, userId } });
      if (!loc?.openingHoursJson || !loc.openingHoursFetchedAt) return null;
      return {
        hours: loc.openingHoursJson as PlacesWeeklyHours,
        fetchedAt: loc.openingHoursFetchedAt,
      };
    },
    async save(userId, locationId, hours) {
      await prisma.location.updateMany({
        where: { id: locationId, userId },
        data: { openingHoursJson: hours as Prisma.InputJsonValue, openingHoursFetchedAt: new Date() },
      });
    },
  };
}
