import { combineDateAndTime, dateStringToDate, dateToDateString, dateToHHMM } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { addDaysToDate } from "@/lib/scheduler/time";
import type {
  GenerateWeekInput,
  SchedulerFixedEvent,
  SchedulerLocation,
  SchedulerSubject,
  WeeklyOpeningHours,
} from "@/lib/scheduler/types";
import { getOpeningHours, getTravelMinutes } from "./cache";
import { fetchOpeningHours } from "./places";
import { createPrismaOpeningHoursStore, createPrismaTravelCacheStore } from "./prismaStores";
import { fetchTravelMinutes, type RouteEndpoint } from "./routes";

const RECENT_LOCATION_LOOKBACK_DAYS = 14;

/**
 * DB・Google APIから週間プラン生成に必要な入力（GenerateWeekInput）を組み立てる。
 * 移動時間・営業時間はすべてここで事前解決し、scheduler 本体には純粋な同期関数として渡す
 * （キャッシュなしのループ呼び出しを避けるため）。
 * startPointIdはその生成が起点とする出発地点（週間生成時はデフォルト出発地点、
 * 単日再生成時はその日の選択済み出発地点）。
 */
export async function buildSchedulerInput(
  userId: string,
  weekStartDate: string,
  startPointId: string,
): Promise<GenerateWeekInput> {
  const [settings, subjects, locations, weeklyPlan, startPoint] = await Promise.all([
    prisma.settings.findUniqueOrThrow({ where: { userId } }),
    prisma.subject.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.location.findMany({ where: { userId } }),
    prisma.weeklyPlan.findUnique({ where: { userId_weekStartDate: { userId, weekStartDate: dateStringToDate(weekStartDate) } } }),
    prisma.startPoint.findFirstOrThrow({ where: { id: startPointId, userId } }),
  ]);

  const weekEndDate = addDaysToDate(weekStartDate, 6);
  const [fixedEventsRaw, recentBlocks] = await Promise.all([
    prisma.fixedEvent.findMany({
      where: {
        userId,
        startsAt: { gte: dateStringToDate(weekStartDate), lte: combineDateAndTime(weekEndDate, "23:59") },
      },
    }),
    prisma.scheduleBlock.findMany({
      where: {
        userId,
        type: "study",
        locationId: { not: null },
        date: {
          gte: dateStringToDate(addDaysToDate(weekStartDate, -RECENT_LOCATION_LOOKBACK_DAYS)),
          lt: dateStringToDate(weekStartDate),
        },
      },
      orderBy: { date: "desc" },
    }),
  ]);

  const priorityOrder = Array.isArray(weeklyPlan?.priorities) ? (weeklyPlan.priorities as string[]) : subjects.map((s) => s.id);

  const schedulerSubjects: SchedulerSubject[] = subjects.map((s) => {
    const idx = priorityOrder.indexOf(s.id);
    return {
      id: s.id,
      name: s.name,
      weeklyQuotaMin: s.weeklyQuotaMin,
      priority: idx === -1 ? priorityOrder.length + subjects.indexOf(s) : idx,
      timeSlot: s.timeSlot,
    };
  });

  const travelCacheStore = createPrismaTravelCacheStore(prisma);
  const openingHoursStore = createPrismaOpeningHoursStore(prisma);

  let apiCalls = 0;
  let cacheHits = 0;

  const schedulerLocations: SchedulerLocation[] = [];
  for (const loc of locations) {
    const manualFallback = (loc.manualHoursJson as WeeklyOpeningHours | null) ?? undefined;
    const result = await getOpeningHours({
      store: openingHoursStore,
      userId,
      locationId: loc.id,
      fetchFn: async () => {
        if (!loc.placeId) throw new Error(`${loc.name}: placeId が未設定です`);
        apiCalls++;
        return fetchOpeningHours(loc.placeId);
      },
      manualFallback,
    });
    if (result?.source === "cache") cacheHits++;

    schedulerLocations.push({
      id: loc.id,
      name: loc.name,
      kind: loc.kind,
      maxStayMin: loc.maxStayMin ?? undefined,
      openingHours: result?.hours ?? {},
    });
  }

  const endpointFor = (key: string): RouteEndpoint => {
    if (key === startPoint.id) return { address: startPoint.address };
    const loc = locations.find((l) => l.id === key);
    if (loc?.placeId) return { placeId: loc.placeId };
    if (loc) return { address: loc.address };
    throw new Error(`未知の場所キー: ${key}`);
  };

  const travelKeys = [startPoint.id, ...locations.map((l) => l.id)];
  const travelMinutesByPair = new Map<string, number>();

  for (const fromKey of travelKeys) {
    for (const toKey of travelKeys) {
      if (fromKey === toKey) {
        travelMinutesByPair.set(`${fromKey}|${toKey}`, 0);
        continue;
      }
      const destLocation = locations.find((l) => l.id === toKey);
      const result = await getTravelMinutes({
        store: travelCacheStore,
        userId,
        fromKey,
        toKey,
        fetchFn: async () => {
          apiCalls++;
          return fetchTravelMinutes(endpointFor(fromKey), endpointFor(toKey));
        },
        manualFallbackMin: destLocation?.manualTravelMin ?? undefined,
      });
      if (result?.source === "cache") cacheHits++;

      if (result) {
        travelMinutesByPair.set(`${fromKey}|${toKey}`, result.minutes);
      } else {
        console.warn(`移動時間を解決できませんでした: ${fromKey} -> ${toKey}。到達不可として扱います。`);
        travelMinutesByPair.set(`${fromKey}|${toKey}`, 24 * 60);
      }
    }
  }

  console.log(`[buildSchedulerInput] Google API呼び出し ${apiCalls}件 / キャッシュヒット ${cacheHits}件`);

  const schedulerFixedEvents: SchedulerFixedEvent[] = fixedEventsRaw.map((e) => ({
    id: e.id,
    title: e.title,
    date: dateToDateString(e.startsAt),
    startsAt: dateToHHMM(e.startsAt),
    endsAt: dateToHHMM(e.endsAt),
    locationId: e.locationId ?? undefined,
  }));

  const recentlyUsedLocationIds = Array.from(new Set(recentBlocks.map((b) => b.locationId as string)));

  return {
    weekStartDate,
    startLocationId: startPoint.id,
    subjects: schedulerSubjects,
    locations: schedulerLocations,
    fixedEvents: schedulerFixedEvents,
    settings: {
      wakeWeekday: settings.wakeWeekday,
      wakeWeekend: settings.wakeWeekend,
      morningEnd: settings.morningEnd,
      outsideEnd: settings.outsideEnd,
    },
    travelTimeFn: (from, to) => travelMinutesByPair.get(`${from}|${to}`) ?? 24 * 60,
    recentlyUsedLocationIds,
  };
}
