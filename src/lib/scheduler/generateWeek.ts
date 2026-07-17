import { generateDay, type SubjectState } from "./core";
import { computeDailyLimits } from "./dailyBudget";
import { addDaysToDate } from "./time";
import type { GenerateWeekInput, GenerateWeekResult, QuotaWarning, ScheduleBlock } from "./types";

const DAYS_IN_WEEK = 7;

export function generateWeek(input: GenerateWeekInput): GenerateWeekResult {
  const subjectStates: SubjectState[] = input.subjects.map((s) => ({
    subject: s,
    remaining: s.weeklyQuotaMin,
    dailyLimit: 0,
  }));
  const dailyLimits = computeDailyLimits(
    input.subjects.map((s) => ({ id: s.id, quotaMin: s.weeklyQuotaMin })),
    DAYS_IN_WEEK,
  );
  const usageHistory = [...(input.recentlyUsedLocationIds ?? [])];
  const blocks: ScheduleBlock[] = [];

  for (let d = 0; d < DAYS_IN_WEEK; d++) {
    for (const state of subjectStates) {
      state.dailyLimit = dailyLimits.get(state.subject.id)?.[d] ?? 0;
    }

    const date = addDaysToDate(input.weekStartDate, d);
    blocks.push(
      ...generateDay({
        date,
        startLocation: input.startLocationId,
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
