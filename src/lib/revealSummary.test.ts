import { describe, expect, it } from "vitest";
import { summarizeTodayBlocks } from "./revealSummary";

describe("summarizeTodayBlocks", () => {
  it("ブロックが無ければ空の概要を返す", () => {
    expect(summarizeTodayBlocks([])).toEqual({ locationNames: [], totalStudyMin: 0 });
  });

  it("場所名の重複を除去し、登場順を保つ", () => {
    const result = summarizeTodayBlocks([
      { startsAt: "09:00", endsAt: "10:00", locationName: "図書館" },
      { startsAt: "10:30", endsAt: "11:30", locationName: "カフェA" },
      { startsAt: "13:00", endsAt: "14:00", locationName: "図書館" },
    ]);
    expect(result.locationNames).toEqual(["図書館", "カフェA"]);
  });

  it("場所名がnullのブロックは無視する", () => {
    const result = summarizeTodayBlocks([{ startsAt: "09:00", endsAt: "10:00", locationName: null }]);
    expect(result.locationNames).toEqual([]);
  });

  it("勉強ブロックの合計時間を分単位で計算する", () => {
    const result = summarizeTodayBlocks([
      { startsAt: "09:00", endsAt: "10:30", locationName: "図書館" },
      { startsAt: "13:00", endsAt: "14:00", locationName: "カフェA" },
    ]);
    expect(result.totalStudyMin).toBe(150);
  });
});
