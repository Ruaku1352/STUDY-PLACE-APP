import { generateDay, type SubjectState } from "./core";
import { addDaysToDate } from "./time";
import type { GenerateWeekInput, GenerateWeekResult, QuotaWarning, ScheduleBlock } from "./types";

export function generateWeek(input: GenerateWeekInput): GenerateWeekResult {
  const subjectStates: SubjectState[] = input.subjects.map((s) => ({
    subject: s,
    remaining: s.weeklyQuotaMin,
  }));
  const usageHistory = [...(input.recentlyUsedLocationIds ?? [])];
  const blocks: ScheduleBlock[] = [];

  for (let d = 0; d < 7; d++) {
    const date = addDaysToDate(input.weekStartDate, d);
    blocks.push(
      ...generateDay({
        date,
        subjectStates,
        locations: input.locations,
        fixedEvents: input.fixedEvents,
        settings: input.settings,
        travelTimeFn: input.travelTimeFn,
        usageHistory,
      }),
    );
  }

  const warnings: QuotaWarning[] = subjectStates
    .filter((s) => s.remaining > 0)
    .map((s) => ({
      type: "quota_exceeded",
      subjectId: s.subject.id,
      shortfallMin: s.remaining,
      message: `${s.subject.name} のノルマに対して ${s.remaining} 分割り当てられませんでした`,
    }));

  return { blocks, warnings };
}
