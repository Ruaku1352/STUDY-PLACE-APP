import { describe, expect, it } from "vitest";
import { summarizeWeeklyReview } from "./weeklyReview";
import type { RawDayState, RawStudyBlock, ReviewSubject } from "./weeklyReview";

const subjects: ReviewSubject[] = [
  { id: "math", name: "数学", weeklyQuotaMin: 300, timeSlot: "morning" },
  { id: "eng", name: "英語", weeklyQuotaMin: 200, timeSlot: "anytime" },
];

describe("summarizeWeeklyReview", () => {
  it("実績のない場合はゼロ集計を返す", () => {
    const result = summarizeWeeklyReview({
      subjects,
      blocks: [],
      dayStates: [],
      morningEnd: "12:00",
    });

    expect(result.weeksObserved).toBe(0);
    expect(result.blocksObserved).toBe(0);
    expect(result.subjects).toHaveLength(2);
    expect(result.subjects[0].achievementRate).toBe(0);
    expect(result.subjects[0].morningMissRate).toBeNull();
  });

  it("達成率を週数で正しく平均する", () => {
    const blocks: RawStudyBlock[] = [
      { date: "2026-07-06", subjectId: "math", status: "done", actualMin: 150, startsAt: "09:00" },
      { date: "2026-07-13", subjectId: "math", status: "done", actualMin: 150, startsAt: "09:00" },
    ];

    const result = summarizeWeeklyReview({ subjects, blocks, dayStates: [], morningEnd: "12:00" });

    expect(result.weeksObserved).toBe(2);
    expect(result.blocksObserved).toBe(2);
    const math = result.subjects.find((s) => s.subjectId === "math")!;
    expect(math.actualMin).toBe(300);
    // 週平均 150分/週 ÷ ノルマ300分 = 0.5
    expect(math.achievementRate).toBeCloseTo(0.5);
  });

  it("午前枠の未実施率をmorning科目のみ計算する", () => {
    const blocks: RawStudyBlock[] = [
      { date: "2026-07-06", subjectId: "math", status: "skipped", actualMin: null, startsAt: "09:00" },
      { date: "2026-07-06", subjectId: "math", status: "done", actualMin: 60, startsAt: "10:00" },
      { date: "2026-07-06", subjectId: "eng", status: "skipped", actualMin: null, startsAt: "09:00" },
    ];

    const result = summarizeWeeklyReview({ subjects, blocks, dayStates: [], morningEnd: "12:00" });

    const math = result.subjects.find((s) => s.subjectId === "math")!;
    const eng = result.subjects.find((s) => s.subjectId === "eng")!;
    expect(math.morningMissRate).toBeCloseTo(0.5);
    expect(eng.morningMissRate).toBeNull();
  });

  it("リロール・ギブアップ回数を集計する", () => {
    const dayStates: RawDayState[] = [
      { date: "2026-07-06", rerollUsed: true, gaveUp: false },
      { date: "2026-07-07", rerollUsed: false, gaveUp: true },
      { date: "2026-07-08", rerollUsed: true, gaveUp: true },
    ];

    const result = summarizeWeeklyReview({ subjects, blocks: [], dayStates, morningEnd: "12:00" });

    expect(result.rerollCount).toBe(2);
    expect(result.giveUpCount).toBe(2);
  });
});
