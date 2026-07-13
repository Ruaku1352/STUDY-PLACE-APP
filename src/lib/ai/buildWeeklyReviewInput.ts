import { combineDateAndTime, dateStringToDate, dateToDateString, dateToHHMM } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { addDaysToDate } from "@/lib/scheduler/time";
import { summarizeWeeklyReview, type RawDayState, type RawStudyBlock, type WeeklyReviewInput } from "./weeklyReview";

const LOOKBACK_WEEKS = 4;

/** 直近数週間の実績をDBから集計し、AI提案の入力（WeeklyReviewInput）を組み立てる。 */
export async function buildWeeklyReviewInput(userId: string, weekStartDate: string): Promise<WeeklyReviewInput> {
  const lookbackStart = addDaysToDate(weekStartDate, -7 * LOOKBACK_WEEKS);
  const weekEndDate = addDaysToDate(weekStartDate, 6);

  const [subjects, settings, blocksRaw, dayStatesRaw] = await Promise.all([
    prisma.subject.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.settings.findUniqueOrThrow({ where: { userId } }),
    prisma.scheduleBlock.findMany({
      where: {
        userId,
        type: "study",
        date: { gte: dateStringToDate(lookbackStart), lt: dateStringToDate(weekStartDate) },
      },
    }),
    prisma.dayState.findMany({
      where: {
        userId,
        date: { gte: dateStringToDate(lookbackStart), lte: combineDateAndTime(weekEndDate, "23:59") },
      },
    }),
  ]);

  const blocks: RawStudyBlock[] = blocksRaw.map((b) => ({
    date: dateToDateString(b.date),
    subjectId: b.subjectId ?? "",
    status: b.status,
    actualMin: b.actualMin,
    startsAt: dateToHHMM(b.startsAt),
  }));

  const dayStates: RawDayState[] = dayStatesRaw.map((d) => ({
    date: dateToDateString(d.date),
    rerollUsed: d.rerollUsed,
    gaveUp: d.gaveUp,
  }));

  return summarizeWeeklyReview({
    subjects: subjects.map((s) => ({ id: s.id, name: s.name, weeklyQuotaMin: s.weeklyQuotaMin, timeSlot: s.timeSlot })),
    blocks,
    dayStates,
    morningEnd: settings.morningEnd,
  });
}
