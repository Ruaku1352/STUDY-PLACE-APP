import { describe, expect, it } from "vitest";
import { reroll } from "./reroll";
import { toMinutes } from "./time";
import { baseSettings, cafe, flatTravelTimeFn, library, libraryAlt, WEEK_START } from "./testFixtures";
import type { ScheduleBlock, SchedulerSubject } from "./types";

describe("reroll", () => {
  it("ノルマ配分（科目・分数）を維持しつつ、場所構成を変える", () => {
    const subjects: SchedulerSubject[] = [{ id: "s1", name: "英語", weeklyQuotaMin: 9999, priority: 0, timeSlot: "anytime" }];
    const previousBlocks: ScheduleBlock[] = [
      { date: WEEK_START, type: "move", startsAt: "08:00", endsAt: "08:20", status: "planned" },
      {
        date: WEEK_START,
        type: "study",
        startsAt: "08:20",
        endsAt: "09:50",
        subjectId: "s1",
        locationId: library.id,
        status: "planned",
      },
    ];

    const { blocks } = reroll({
      date: WEEK_START,
      previousBlocks,
      subjects,
      locations: [library, libraryAlt, cafe],
      fixedEvents: [],
      settings: baseSettings,
      travelTimeFn: flatTravelTimeFn,
    });

    const studyMin = blocks
      .filter((b) => b.type === "study" && b.subjectId === "s1")
      .reduce((acc, b) => acc + (toMinutes(b.endsAt) - toMinutes(b.startsAt)), 0);

    // 前回と同じ90分がそのまま維持される
    expect(studyMin).toBe(90);

    // 前回使った場所（library）は使われない
    const usedLocationIds = new Set(blocks.filter((b) => b.type === "study").map((b) => b.locationId));
    expect(usedLocationIds.has(library.id)).toBe(false);
  });
});
