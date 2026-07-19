import { describe, expect, it } from "vitest";
import { computeBlockXp, isDayFullyComplete, XP_BLOCK_COMPLETE_BONUS, XP_NEW_LOCATION_BONUS } from "./block";

describe("computeBlockXp", () => {
  it("plannedは0XP", () => {
    expect(computeBlockXp({ status: "planned", actualMin: null, isFirstAtLocation: false })).toBe(0);
  });

  it("skippedは実施分数があっても0XP", () => {
    expect(computeBlockXp({ status: "skipped", actualMin: 0, isFirstAtLocation: false })).toBe(0);
  });

  it("doneは実施分数×1 + ブロック完了ボーナス", () => {
    expect(computeBlockXp({ status: "done", actualMin: 60, isFirstAtLocation: false })).toBe(60 + XP_BLOCK_COMPLETE_BONUS);
  });

  it("partialも同じ計算式（実施分数分のみ）", () => {
    expect(computeBlockXp({ status: "partial", actualMin: 25, isFirstAtLocation: false })).toBe(25 + XP_BLOCK_COMPLETE_BONUS);
  });

  it("初めての場所ならさらに+100XP", () => {
    expect(computeBlockXp({ status: "done", actualMin: 60, isFirstAtLocation: true })).toBe(
      60 + XP_BLOCK_COMPLETE_BONUS + XP_NEW_LOCATION_BONUS,
    );
  });

  it("actualMinがnullなら0分として扱う", () => {
    expect(computeBlockXp({ status: "done", actualMin: null, isFirstAtLocation: false })).toBe(XP_BLOCK_COMPLETE_BONUS);
  });

  it("actualMinが負の値でも0分に丸める", () => {
    expect(computeBlockXp({ status: "done", actualMin: -10, isFirstAtLocation: false })).toBe(XP_BLOCK_COMPLETE_BONUS);
  });
});

describe("isDayFullyComplete", () => {
  it("全てdoneならtrue", () => {
    expect(isDayFullyComplete(["done", "done"])).toBe(true);
  });

  it("1つでもpartial・skipped・plannedがあればfalse", () => {
    expect(isDayFullyComplete(["done", "partial"])).toBe(false);
    expect(isDayFullyComplete(["done", "skipped"])).toBe(false);
    expect(isDayFullyComplete(["done", "planned"])).toBe(false);
  });

  it("空配列はfalse（対象ブロックが無い日にボーナスを出さない）", () => {
    expect(isDayFullyComplete([])).toBe(false);
  });
});
