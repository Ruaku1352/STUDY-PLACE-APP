import { generateDay, type SubjectState } from "./core";
import { computeDailyLimits } from "./dailyBudget";
import { addDaysToDate, toMinutes } from "./time";
import type { GenerateWeekInput, GenerateWeekResult, QuotaWarning, ScheduleBlock } from "./types";

const DAYS_IN_WEEK = 7;

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

  const includedDayIndices = Array.from({ length: DAYS_IN_WEEK }, (_, d) => d).filter(
    (d) => addDaysToDate(input.weekStartDate, d) >= input.fromDate,
  );
  const dailyLimits = computeDailyLimits(
    subjectStates.map((s) => ({ id: s.subject.id, quotaMin: s.remaining })),
    includedDayIndices.length,
  );

  const usageHistory = [...(input.recentlyUsedLocationIds ?? [])];
  const blocks: ScheduleBlock[] = [];

  includedDayIndices.forEach((d, spreadIndex) => {
    for (const state of subjectStates) {
      state.dailyLimit = dailyLimits.get(state.subject.id)?.[spreadIndex] ?? 0;
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
  });

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
