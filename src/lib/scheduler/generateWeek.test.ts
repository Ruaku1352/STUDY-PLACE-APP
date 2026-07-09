import { describe, expect, it } from "vitest";
import { generateWeek } from "./generateWeek";
import { addDaysToDate, toMinutes } from "./time";
import {
  baseSettings,
  cafe,
  flatTravelTimeFn,
  library,
  libraryAlt,
  makeRecordingTravelTimeFn,
  WEEK_START,
} from "./testFixtures";
import type { ScheduleBlock, SchedulerSubject } from "./types";

function blocksByDate(blocks: ScheduleBlock[], date: string) {
  return blocks.filter((b) => b.date === date).sort((a, b) => toMinutes(a.startsAt) - toMinutes(b.startsAt));
}

describe("generateWeek", () => {
  it("1週間分が破綻なく生成される（時刻の重複なし）", () => {
    const subjects: SchedulerSubject[] = [{ id: "s1", name: "英語", weeklyQuotaMin: 300, priority: 0, timeSlot: "anytime" }];
    const { blocks } = generateWeek({
      weekStartDate: WEEK_START,
      subjects,
      locations: [library, cafe],
      fixedEvents: [],
      settings: baseSettings,
      travelTimeFn: flatTravelTimeFn,
    });

    expect(blocks.length).toBeGreaterThan(0);

    for (let d = 0; d < 7; d++) {
      const date = addDaysToDate(WEEK_START, d);
      const dayBlocks = blocksByDate(blocks, date);
      for (let i = 1; i < dayBlocks.length; i++) {
        expect(toMinutes(dayBlocks[i].startsAt)).toBeGreaterThanOrEqual(toMinutes(dayBlocks[i - 1].endsAt));
      }
      for (const b of dayBlocks) {
        expect(toMinutes(b.endsAt)).toBeLessThanOrEqual(toMinutes("21:00"));
        expect(toMinutes(b.startsAt)).toBeGreaterThanOrEqual(toMinutes("08:00"));
      }
    }
  });

  it("morning科目は午前枠に配置される", () => {
    const subjects: SchedulerSubject[] = [
      { id: "math", name: "数学", weeklyQuotaMin: 180, priority: 0, timeSlot: "morning" },
      { id: "eng", name: "英語", weeklyQuotaMin: 180, priority: 1, timeSlot: "anytime" },
    ];
    const { blocks } = generateWeek({
      weekStartDate: WEEK_START,
      subjects,
      locations: [library],
      fixedEvents: [],
      settings: baseSettings,
      travelTimeFn: flatTravelTimeFn,
    });

    const mathBlocks = blocks.filter((b) => b.subjectId === "math");
    expect(mathBlocks.length).toBeGreaterThan(0);
    for (const b of mathBlocks) {
      expect(toMinutes(b.startsAt)).toBeLessThan(toMinutes("12:00"));
    }
  });

  it("cafeの最大滞在時間を超えず、同じ場所が同日に2回現れない", () => {
    const subjects: SchedulerSubject[] = [{ id: "s1", name: "英語", weeklyQuotaMin: 1200, priority: 0, timeSlot: "anytime" }];
    const { blocks } = generateWeek({
      weekStartDate: WEEK_START,
      subjects,
      locations: [cafe, library],
      fixedEvents: [],
      settings: baseSettings,
      travelTimeFn: flatTravelTimeFn,
    });

    for (let d = 0; d < 7; d++) {
      const date = addDaysToDate(WEEK_START, d);
      const dayBlocks = blocksByDate(blocks, date);

      // 同じ場所が同日に2回（非連続で）現れないことを、場所ごとの最初と最後の出現がすべて連続していることで確認
      const order = dayBlocks.filter((b) => b.type === "study").map((b) => b.locationId as string);
      const firstSeenIndex = new Map<string, number>();
      const lastSeenIndex = new Map<string, number>();
      order.forEach((id, idx) => {
        if (!firstSeenIndex.has(id)) firstSeenIndex.set(id, idx);
        lastSeenIndex.set(id, idx);
      });
      for (const id of firstSeenIndex.keys()) {
        for (let idx = firstSeenIndex.get(id)!; idx <= lastSeenIndex.get(id)!; idx++) {
          expect(order[idx]).toBe(id);
        }
      }

      // cafe の滞在（到着〜そのセッションの最終ブロック終了）が maxStayMin を超えない。
      // 休憩・昼食ブロックは locationId を持たないため、直前の cafe 滞在に連続するものとして扱う。
      const firstCafeIdx = dayBlocks.findIndex((b) => b.locationId === cafe.id);
      if (firstCafeIdx !== -1) {
        const arrival = toMinutes(dayBlocks[firstCafeIdx].startsAt);
        let lastIdx = firstCafeIdx;
        for (let idx = firstCafeIdx + 1; idx < dayBlocks.length; idx++) {
          const type = dayBlocks[idx].type;
          if (type === "study" || type === "break" || type === "lunch") {
            lastIdx = idx;
          } else {
            break;
          }
        }
        const departure = toMinutes(dayBlocks[lastIdx].endsAt);
        expect(departure - arrival).toBeLessThanOrEqual(cafe.maxStayMin!);
      }
    }
  });

  it("個人予定と重複せず、予定の場所が次の移動の起点になる", () => {
    const { fn, calls } = makeRecordingTravelTimeFn();
    const subjects: SchedulerSubject[] = [{ id: "s1", name: "英語", weeklyQuotaMin: 300, priority: 0, timeSlot: "anytime" }];
    const { blocks } = generateWeek({
      weekStartDate: WEEK_START,
      subjects,
      locations: [library, libraryAlt],
      fixedEvents: [
        { id: "ev1", title: "学校", date: WEEK_START, startsAt: "09:00", endsAt: "10:00", locationId: "event-loc" },
      ],
      settings: baseSettings,
      travelTimeFn: fn,
    });

    const dayBlocks = blocksByDate(blocks, WEEK_START);
    for (const b of dayBlocks) {
      if (b.type === "event") continue;
      const overlaps = toMinutes(b.startsAt) < toMinutes("10:00") && toMinutes(b.endsAt) > toMinutes("09:00");
      expect(overlaps).toBe(false);
    }

    expect(calls.some(([from]) => from === "event-loc")).toBe(true);
  });

  it("21:00以降にブロックが存在しない", () => {
    const subjects: SchedulerSubject[] = [{ id: "s1", name: "英語", weeklyQuotaMin: 2000, priority: 0, timeSlot: "anytime" }];
    const { blocks } = generateWeek({
      weekStartDate: WEEK_START,
      subjects,
      locations: [library],
      fixedEvents: [],
      settings: baseSettings,
      travelTimeFn: flatTravelTimeFn,
    });

    for (const b of blocks) {
      expect(toMinutes(b.endsAt)).toBeLessThanOrEqual(toMinutes("21:00"));
    }
  });

  it("ノルマ超過時に warning が出て、優先順位の高い科目から割り当てられる", () => {
    const subjects: SchedulerSubject[] = [
      { id: "high", name: "優先度高", weeklyQuotaMin: 100000, priority: 0, timeSlot: "anytime" },
      { id: "low", name: "優先度低", weeklyQuotaMin: 100000, priority: 1, timeSlot: "anytime" },
    ];
    const tightSettings = { ...baseSettings, outsideEnd: "10:30" };
    const { blocks, warnings } = generateWeek({
      weekStartDate: WEEK_START,
      subjects,
      locations: [library],
      fixedEvents: [],
      settings: tightSettings,
      travelTimeFn: flatTravelTimeFn,
    });

    expect(warnings.length).toBe(2);

    const sumFor = (id: string) =>
      blocks
        .filter((b) => b.type === "study" && b.subjectId === id)
        .reduce((acc, b) => acc + (toMinutes(b.endsAt) - toMinutes(b.startsAt)), 0);

    expect(sumFor("low")).toBe(0);
    expect(sumFor("high")).toBeGreaterThan(0);
  });

  it("60分未満の隙間には勉強ブロックが入らない", () => {
    const subjects: SchedulerSubject[] = [{ id: "s1", name: "英語", weeklyQuotaMin: 300, priority: 0, timeSlot: "anytime" }];
    const { blocks } = generateWeek({
      weekStartDate: WEEK_START,
      subjects,
      locations: [library],
      fixedEvents: [
        { id: "ev1", title: "予定A", date: WEEK_START, startsAt: "08:00", endsAt: "09:00", locationId: "evloc" },
        { id: "ev2", title: "予定B", date: WEEK_START, startsAt: "09:40", endsAt: "11:00" },
      ],
      settings: baseSettings,
      travelTimeFn: flatTravelTimeFn,
    });

    const gapBlocks = blocks.filter(
      (b) => b.date === WEEK_START && toMinutes(b.startsAt) >= toMinutes("09:00") && toMinutes(b.endsAt) <= toMinutes("09:40"),
    );
    expect(gapBlocks.length).toBe(0);
  });
});
