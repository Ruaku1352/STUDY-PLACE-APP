import { addDaysToDate, toMinutes, weekdayIndex } from "../scheduler/time";

export interface RawStudyBlock {
  date: string; // "YYYY-MM-DD"
  subjectId: string;
  status: "planned" | "done" | "partial" | "skipped";
  actualMin: number | null;
  startsAt: string; // "HH:MM"
}

export interface RawDayState {
  date: string; // "YYYY-MM-DD"
  rerollUsed: boolean;
  gaveUp: boolean;
}

export interface ReviewSubject {
  id: string;
  name: string;
  weeklyQuotaMin: number;
  timeSlot: "morning" | "anytime";
}

export interface SummarizeWeeklyReviewParams {
  subjects: ReviewSubject[];
  blocks: RawStudyBlock[];
  dayStates: RawDayState[];
  morningEnd: string; // "HH:MM"
}

export interface SubjectWeeklyStat {
  subjectId: string;
  name: string;
  quotaMin: number;
  actualMin: number;
  /** 週平均の達成率（0以上、上限なし）。実績週が無ければ0。 */
  achievementRate: number;
  /** 午前枠に置かれたブロックのうち未実施だった割合。morning科目以外・対象ブロックが無い場合はnull。 */
  morningMissRate: number | null;
}

export interface WeeklyReviewInput {
  weeksObserved: number;
  blocksObserved: number;
  subjects: SubjectWeeklyStat[];
  rerollCount: number;
  giveUpCount: number;
}

function weekStartOf(date: string): string {
  return addDaysToDate(date, -weekdayIndex(date));
}

/** 実績データ（ScheduleBlock/DayStateの生行）を集計してAI提案の入力を作る純粋関数。DB・日時APIには依存しない。 */
export function summarizeWeeklyReview(params: SummarizeWeeklyReviewParams): WeeklyReviewInput {
  const { subjects, blocks, dayStates, morningEnd } = params;

  const recordedBlocks = blocks.filter((b) => b.status === "done" || b.status === "partial");
  const weeksWithRecords = new Set(recordedBlocks.map((b) => weekStartOf(b.date)));
  const weeksObserved = weeksWithRecords.size;

  const subjectStats: SubjectWeeklyStat[] = subjects.map((s) => {
    const subjectBlocks = blocks.filter((b) => b.subjectId === s.id);
    const actualMin = subjectBlocks
      .filter((b) => b.status === "done" || b.status === "partial")
      .reduce((sum, b) => sum + (b.actualMin ?? 0), 0);
    const achievementRate = weeksObserved > 0 && s.weeklyQuotaMin > 0 ? actualMin / (weeksObserved * s.weeklyQuotaMin) : 0;

    let morningMissRate: number | null = null;
    if (s.timeSlot === "morning") {
      const morningBlocks = subjectBlocks.filter((b) => toMinutes(b.startsAt) < toMinutes(morningEnd));
      if (morningBlocks.length > 0) {
        const missed = morningBlocks.filter((b) => b.status === "skipped").length;
        morningMissRate = missed / morningBlocks.length;
      }
    }

    return {
      subjectId: s.id,
      name: s.name,
      quotaMin: s.weeklyQuotaMin,
      actualMin,
      achievementRate,
      morningMissRate,
    };
  });

  return {
    weeksObserved,
    blocksObserved: recordedBlocks.length,
    subjects: subjectStats,
    rerollCount: dayStates.filter((d) => d.rerollUsed).length,
    giveUpCount: dayStates.filter((d) => d.gaveUp).length,
  };
}
