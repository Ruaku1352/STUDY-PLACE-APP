import { generateDay, type SubjectState } from "./core";
import { addDaysToDate, toMinutes } from "./time";
import type { GenerateWeekInput, GenerateWeekResult, QuotaWarning, ScheduleBlock } from "./types";

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
  }));

  const usageHistory = [...(input.recentlyUsedLocationIds ?? [])];
  const blocks: ScheduleBlock[] = [];

  for (let d = 0; d < 7; d++) {
    const date = addDaysToDate(input.weekStartDate, d);
    if (date < input.fromDate) continue;

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
