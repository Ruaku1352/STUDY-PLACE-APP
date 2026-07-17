import { describe, expect, it } from "vitest";
import { isWeeklyPrepWindow, nextWeekStartDateFrom } from "./weeklyPrep";

describe("isWeeklyPrepWindow", () => {
  it("日曜18時以降はtrue", () => {
    expect(isWeeklyPrepWindow(new Date("2026-07-19T18:00:00"))).toBe(true);
    expect(isWeeklyPrepWindow(new Date("2026-07-19T23:00:00"))).toBe(true);
  });

  it("日曜18時より前はfalse", () => {
    expect(isWeeklyPrepWindow(new Date("2026-07-19T17:59:00"))).toBe(false);
  });

  it("月曜は終日true", () => {
    expect(isWeeklyPrepWindow(new Date("2026-07-20T00:30:00"))).toBe(true);
    expect(isWeeklyPrepWindow(new Date("2026-07-20T23:00:00"))).toBe(true);
  });

  it("火曜〜土曜はfalse", () => {
    expect(isWeeklyPrepWindow(new Date("2026-07-21T12:00:00"))).toBe(false);
    expect(isWeeklyPrepWindow(new Date("2026-07-25T12:00:00"))).toBe(false);
  });
});

describe("nextWeekStartDateFrom", () => {
  it("日曜なら翌日（月曜）を返す", () => {
    expect(nextWeekStartDateFrom("2026-07-19")).toBe("2026-07-20");
  });

  it("月曜なら7日後（次の月曜）を返す", () => {
    expect(nextWeekStartDateFrom("2026-07-20")).toBe("2026-07-27");
  });

  it("水曜なら次の月曜を返す", () => {
    expect(nextWeekStartDateFrom("2026-07-22")).toBe("2026-07-27");
  });
});
