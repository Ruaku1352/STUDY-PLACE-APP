import { describe, expect, it } from "vitest";
import { reschedule } from "./reschedule";
import { addDaysToDate, toMinutes } from "./time";
import { baseSettings, flatTravelTimeFn, library, WEEK_START } from "./testFixtures";
import type { ScheduleBlock, SchedulerSubject } from "./types";

describe("reschedule", () => {
  it("完了済みブロックの実績を保持し、残ノルマを残りの日へ再割り当てする", () => {
    const subjects: SchedulerSubject[] = [{ id: "s1", name: "英語", weeklyQuotaMin: 300, priority: 0, timeSlot: "anytime" }];
    const completedBlocks: ScheduleBlock[] = [
      {
        date: WEEK_START,
        type: "study",
        startsAt: "08:20",
        endsAt: "10:20",
        subjectId: "s1",
        locationId: library.id,
        status: "done",
        actualMin: 120,
      },
    ];
    const fromDate = addDaysToDate(WEEK_START, 1);

    const { blocks, warnings } = reschedule({
      weekStartDate: WEEK_START,
      subjects,
      locations: [library],
      fixedEvents: [],
      settings: baseSettings,
      travelTimeFn: flatTravelTimeFn,
      fromDate,
      completedBlocks,
    });

    // 完了済みの日（WEEK_START）は再生成対象に含まれない
    expect(blocks.some((b) => b.date === WEEK_START)).toBe(false);

    const remainingStudyMin = blocks
      .filter((b) => b.type === "study" && b.subjectId === "s1")
      .reduce((acc, b) => acc + (toMinutes(b.endsAt) - toMinutes(b.startsAt)), 0);

    // 300分ノルマ - 実績120分 = 残り180分がすべて再配分される
    expect(remainingStudyMin).toBe(180);
    expect(warnings.length).toBe(0);
  });
});
