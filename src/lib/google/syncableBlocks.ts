import { prisma } from "@/lib/prisma";
import type { SyncableBlock } from "./calendarSync";

interface ScheduleBlockRow {
  id: string;
  type: string;
  startsAt: Date;
  endsAt: Date;
  subjectId: string | null;
  locationId: string | null;
  gcalEventId: string | null;
}

/**
 * ScheduleBlock の生データに、カレンダー同期に必要な科目名・場所名・予定タイトルを
 * 付与した SyncableBlock[] を組み立てる。
 */
export async function buildSyncableBlocks(userId: string, blocks: ScheduleBlockRow[]): Promise<SyncableBlock[]> {
  if (blocks.length === 0) return [];

  const subjectIds = Array.from(new Set(blocks.map((b) => b.subjectId).filter((id): id is string => Boolean(id))));
  const locationIds = Array.from(new Set(blocks.map((b) => b.locationId).filter((id): id is string => Boolean(id))));
  const eventBlocks = blocks.filter((b) => b.type === "event");

  const [subjects, locations, fixedEvents] = await Promise.all([
    subjectIds.length > 0
      ? prisma.subject.findMany({ where: { id: { in: subjectIds }, userId } })
      : Promise.resolve([]),
    locationIds.length > 0
      ? prisma.location.findMany({ where: { id: { in: locationIds }, userId } })
      : Promise.resolve([]),
    eventBlocks.length > 0
      ? prisma.fixedEvent.findMany({
          where: {
            userId,
            OR: eventBlocks.map((b) => ({ startsAt: b.startsAt, endsAt: b.endsAt })),
          },
        })
      : Promise.resolve([]),
  ]);

  const subjectNameById = new Map(subjects.map((s) => [s.id, s.name]));
  const locationById = new Map(locations.map((l) => [l.id, l]));
  const eventTitleByTimeRange = new Map(
    fixedEvents.map((e) => [`${e.startsAt.getTime()}-${e.endsAt.getTime()}`, e.title]),
  );

  return blocks.map((b) => {
    const location = b.locationId ? locationById.get(b.locationId) : undefined;
    return {
      id: b.id,
      type: b.type as SyncableBlock["type"],
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      subjectName: b.subjectId ? (subjectNameById.get(b.subjectId) ?? null) : null,
      locationName: location?.name ?? null,
      locationAddress: location?.address ?? null,
      eventTitle:
        b.type === "event" ? (eventTitleByTimeRange.get(`${b.startsAt.getTime()}-${b.endsAt.getTime()}`) ?? null) : null,
      gcalEventId: b.gcalEventId,
    };
  });
}
