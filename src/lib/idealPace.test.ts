import { describe, expect, it } from "vitest";
import { computeIdealPacePercent } from "./idealPace";

describe("computeIdealPacePercent", () => {
  it("通常の週(月曜開始)で、月曜時点は1/7 = 14%", () => {
    expect(computeIdealPacePercent("2026-01-05", "2026-01-11", "2026-01-05")).toBe(14);
  });

  it("通常の週(月曜開始)で、日曜時点は7/7 = 100%", () => {
    expect(computeIdealPacePercent("2026-01-05", "2026-01-11", "2026-01-11")).toBe(100);
  });

  it("週の途中(水曜)開始の場合、残り5日を分母にして計算する", () => {
    // 水〜日の5日間；水曜当日は1/5=20%
    expect(computeIdealPacePercent("2026-01-07", "2026-01-11", "2026-01-07")).toBe(20);
    // 金曜時点は3/5=60%
    expect(computeIdealPacePercent("2026-01-07", "2026-01-11", "2026-01-09")).toBe(60);
  });

  it("週末を過ぎても100%を超えない", () => {
    expect(computeIdealPacePercent("2026-01-05", "2026-01-11", "2026-01-15")).toBe(100);
  });
});
