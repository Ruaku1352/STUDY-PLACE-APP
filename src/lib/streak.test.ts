import { describe, expect, it } from "vitest";
import { applyDailyResult, type StreakState } from "./streak";

const ZERO: StreakState = { currentCount: 0, longestCount: 0, lastQualifiedDate: null, freezeUsedInWeek: false };

// 2026-01-05は月曜日
const MON = "2026-01-05";
const TUE = "2026-01-06";
const WED = "2026-01-07";
const THU = "2026-01-08";
const NEXT_TUE = "2026-01-13";

describe("applyDailyResult", () => {
  it("初回の実績でストリークが1になる", () => {
    const result = applyDailyResult(ZERO, { date: MON, hasProgress: true });
    expect(result.currentCount).toBe(1);
    expect(result.longestCount).toBe(1);
    expect(result.lastQualifiedDate).toBe(MON);
    expect(result.freezeTriggered).toBe(false);
  });

  it("前日から連続していれば継続する", () => {
    const streak: StreakState = { currentCount: 1, longestCount: 1, lastQualifiedDate: MON, freezeUsedInWeek: false };
    const result = applyDailyResult(streak, { date: TUE, hasProgress: true });
    expect(result.currentCount).toBe(2);
    expect(result.longestCount).toBe(2);
  });

  it("同じ日に複数回呼ばれても冪等", () => {
    const streak: StreakState = { currentCount: 2, longestCount: 2, lastQualifiedDate: TUE, freezeUsedInWeek: false };
    const result = applyDailyResult(streak, { date: TUE, hasProgress: true });
    expect(result).toEqual({ ...streak, freezeTriggered: false });
  });

  it("hasProgressがfalseなら何もしない", () => {
    const streak: StreakState = { currentCount: 2, longestCount: 2, lastQualifiedDate: TUE, freezeUsedInWeek: false };
    const result = applyDailyResult(streak, { date: WED, hasProgress: false });
    expect(result).toEqual({ ...streak, freezeTriggered: false });
  });

  it("1日だけ途切れた場合はフリーズで継続する", () => {
    // MONで実績あり、TUEは未実施、WEDに実績（1日ギャップ）
    const streak: StreakState = { currentCount: 1, longestCount: 1, lastQualifiedDate: MON, freezeUsedInWeek: false };
    const result = applyDailyResult(streak, { date: WED, hasProgress: true });
    expect(result.freezeTriggered).toBe(true);
    expect(result.currentCount).toBe(2);
    expect(result.freezeUsedInWeek).toBe(true);
  });

  it("同じ週で2回目の途切れはフリーズ済みのため救済されない", () => {
    const streak: StreakState = { currentCount: 2, longestCount: 2, lastQualifiedDate: WED, freezeUsedInWeek: true };
    const result = applyDailyResult(streak, { date: "2026-01-09" /* 木曜+1日ギャップ相当を金曜として */, hasProgress: true });
    // WED -> FRI はギャップ2日でフリーズ済みのため途切れる
    expect(result.freezeTriggered).toBe(false);
    expect(result.currentCount).toBe(1);
    expect(result.longestCount).toBe(2);
  });

  it("2日以上のギャップはフリーズ未使用でも途切れる", () => {
    const streak: StreakState = { currentCount: 3, longestCount: 3, lastQualifiedDate: MON, freezeUsedInWeek: false };
    const result = applyDailyResult(streak, { date: THU, hasProgress: true }); // 3日ギャップ
    expect(result.freezeTriggered).toBe(false);
    expect(result.currentCount).toBe(1);
    expect(result.longestCount).toBe(3);
  });

  it("週が変わるとフリーズ使用済みフラグがリセットされる", () => {
    // 前週（THU）にフリーズを使用済みのまま、次週(NEXT_TUE)に実績があった場合
    // ギャップが大きく途切れるが、freezeUsedInWeekは週が変わったのでfalseにリセットされる
    const streak: StreakState = { currentCount: 4, longestCount: 4, lastQualifiedDate: THU, freezeUsedInWeek: true };
    const result = applyDailyResult(streak, { date: NEXT_TUE, hasProgress: true });
    expect(result.freezeUsedInWeek).toBe(false);
    expect(result.currentCount).toBe(1);
  });
});
