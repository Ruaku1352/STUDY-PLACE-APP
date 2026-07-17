import type { SubjectState } from "./core";
import { generateDaysInRange } from "./dayRange";
import type { GenerateWeekInput, GenerateWeekResult } from "./types";

export function generateWeek(input: GenerateWeekInput): GenerateWeekResult {
  const subjectStates: SubjectState[] = input.subjects.map((s) => ({
    subject: s,
    remaining: s.weeklyQuotaMin,
    dailyLimit: 0,
  }));

  return generateDaysInRange({
    weekStartDate: input.weekStartDate,
    startDate: input.startDate ?? input.weekStartDate,
    startLocationId: input.startLocationId,
    subjectStates,
    locations: input.locations,
    fixedEvents: input.fixedEvents,
    settings: input.settings,
    travelTimeFn: input.travelTimeFn,
    recentlyUsedLocationIds: input.recentlyUsedLocationIds,
  });
}
