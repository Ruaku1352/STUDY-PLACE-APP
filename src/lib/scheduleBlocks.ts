import { combineDateAndTime, dateStringToDate, dateToDateString, dateToHHMM } from "@/lib/date";
import type { ScheduleBlock } from "@/lib/scheduler/types";

interface PrismaBlockLike {
  date: Date;
  type: string;
  startsAt: Date;
  endsAt: Date;
  subjectId: string | null;
  locationId: string | null;
  status: string;
  actualMin: number | null;
}

export function prismaBlockToScheduler(row: PrismaBlockLike): ScheduleBlock {
  return {
    date: dateToDateString(row.date),
    type: row.type as ScheduleBlock["type"],
    startsAt: dateToHHMM(row.startsAt),
    endsAt: dateToHHMM(row.endsAt),
    subjectId: row.subjectId ?? undefined,
    locationId: row.locationId ?? undefined,
    status: row.status as ScheduleBlock["status"],
    actualMin: row.actualMin ?? undefined,
  };
}

export function schedulerBlockToPrismaCreate(userId: string, b: ScheduleBlock) {
  return {
    userId,
    date: dateStringToDate(b.date),
    type: b.type,
    startsAt: combineDateAndTime(b.date, b.startsAt),
    endsAt: combineDateAndTime(b.date, b.endsAt),
    subjectId: b.subjectId ?? null,
    locationId: b.locationId ?? null,
    status: b.status,
  };
}
