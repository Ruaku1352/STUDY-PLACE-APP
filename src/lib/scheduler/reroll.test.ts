import { describe, expect, it } from "vitest";
import { reroll } from "./reroll";
import { toMinutes } from "./time";
import { baseSettings, cafe, flatTravelTimeFn, library, libraryAlt, WEEK_START } from "./testFixtures";
import type { ScheduleBlock, SchedulerSubject, TravelTimeFn } from "./types";

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

  describe("雨の日の場所抽選", () => {
    // 自宅からの移動時間: library=10分(近い), libraryAlt=20分, cafe=30分(遠い)。場所間の移動は一律15分。
    const homeTravelMin: Record<string, number> = { [library.id]: 10, [libraryAlt.id]: 20, [cafe.id]: 30 };
    const rainTravelTimeFn: TravelTimeFn = (from, to) => {
      if (from === to) return 0;
      if (from === "home") return homeTravelMin[to] ?? 20;
      return 15;
    };

    const subjects: SchedulerSubject[] = [{ id: "s1", name: "英語", weeklyQuotaMin: 60, priority: 0, timeSlot: "anytime" }];
    const previousBlocks: ScheduleBlock[] = [
      { date: WEEK_START, type: "study", startsAt: "08:00", endsAt: "09:00", subjectId: "s1", status: "planned" },
    ];

    it("isRainyがfalseなら重み付け抽選は発動しない", () => {
      const { blocks, rainRuleApplied } = reroll({
        date: WEEK_START,
        previousBlocks,
        subjects,
        locations: [library, libraryAlt, cafe],
        fixedEvents: [],
        settings: baseSettings,
        travelTimeFn: rainTravelTimeFn,
        isRainy: false,
      });
      expect(rainRuleApplied).toBe(false);
      expect(blocks.some((b) => b.type === "study" && b.locationId)).toBe(true);
    });

    it("isRainyがtrueだと近い場所ほど選ばれやすい重み付けになる（乱数0→最も近い場所）", () => {
      const { blocks, rainRuleApplied } = reroll({
        date: WEEK_START,
        previousBlocks,
        subjects,
        locations: [library, libraryAlt, cafe],
        fixedEvents: [],
        settings: baseSettings,
        travelTimeFn: rainTravelTimeFn,
        isRainy: true,
        randomFn: () => 0,
      });
      expect(rainRuleApplied).toBe(true);
      const studyBlock = blocks.find((b) => b.type === "study");
      expect(studyBlock?.locationId).toBe(library.id); // 最も自宅から近い場所
    });

    it("isRainyがtrueでも乱数次第では遠い場所も選ばれる（完全な除外はしない）", () => {
      // 候補3件・近い半分(library, libraryAlt)は重み2、遠い側(cafe)は重み1 → 合計5
      // randomFn=0.9 → r=4.5 は重みを使い切りcafe(最も遠い場所)に到達する
      const { blocks } = reroll({
        date: WEEK_START,
        previousBlocks,
        subjects,
        locations: [library, libraryAlt, cafe],
        fixedEvents: [],
        settings: baseSettings,
        travelTimeFn: rainTravelTimeFn,
        isRainy: true,
        randomFn: () => 0.9,
      });
      const studyBlock = blocks.find((b) => b.type === "study");
      expect(studyBlock?.locationId).toBe(cafe.id);
    });
  });
});
