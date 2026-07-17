import type { SubjectState } from "./core";
import { generateDaysInRange } from "./dayRange";
import { toMinutes } from "./time";
import type { GenerateWeekInput, GenerateWeekResult, ScheduleBlock } from "./types";

export interface RescheduleInput extends GenerateWeekInput {
  /** この日付（含む）から週末までを再生成する */
  fromDate: string;
  /** fromDate より前の実績ブロック（done/partial）。ノルマから差し引く。 */
  completedBlocks: ScheduleBlock[];
}

export function reschedule(input: RescheduleInput): GenerateWeekResult {
  const actualMinBySubject = new Map<string, number>();
  for (const b of input.completedBlocks) {
    if (b.type !== "study" || !b.subjectId) continue;
    if (b.status !== "done" && b.status !== "partial") continue;
    const minutes = b.actualMin ?? toMinutes(b.endsAt) - toMinutes(b.startsAt);
    actualMinBySubject.set(b.subjectId, (actualMinBySubject.get(b.subjectId) ?? 0) + minutes);
  }

  const subjectStates: SubjectState[] = input.subjects.map((s) => ({
    subject: s,
    remaining: Math.max(0, s.weeklyQuotaMin - (actualMinBySubject.get(s.id) ?? 0)),
    dailyLimit: 0,
  }));

  return generateDaysInRange({
    weekStartDate: input.weekStartDate,
    startDate: input.fromDate,
    startLocationId: input.startLocationId,
    subjectStates,
    locations: input.locations,
    fixedEvents: input.fixedEvents,
    settings: input.settings,
    travelTimeFn: input.travelTimeFn,
    recentlyUsedLocationIds: input.recentlyUsedLocationIds,
  });
}
