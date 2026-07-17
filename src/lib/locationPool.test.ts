import { describe, expect, it } from "vitest";
import { MIN_LOCATION_POOL_SIZE, filterLocationPool, validateLocationPoolSize } from "./locationPool";

describe("filterLocationPool", () => {
  const locations = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("プールが空なら全場所を返す（後方互換のデフォルト）", () => {
    expect(filterLocationPool(locations, [])).toEqual(locations);
  });

  it("プールに含まれる場所だけを返す", () => {
    expect(filterLocationPool(locations, ["b", "c"])).toEqual([{ id: "b" }, { id: "c" }]);
  });

  it("プールに含まれない場所は抽選対象から除外される", () => {
    const result = filterLocationPool(locations, ["a"]);
    expect(result.some((l) => l.id === "b" || l.id === "c")).toBe(false);
  });
});

describe("validateLocationPoolSize", () => {
  it(`登録場所が${MIN_LOCATION_POOL_SIZE}件以上あるのにプールが${MIN_LOCATION_POOL_SIZE}件未満なら例外を投げる`, () => {
    expect(() => validateLocationPoolSize(3, 1)).toThrow();
  });

  it(`プールが${MIN_LOCATION_POOL_SIZE}件以上なら例外を投げない`, () => {
    expect(() => validateLocationPoolSize(3, 2)).not.toThrow();
  });

  it("登録場所自体が1件しかない場合は検証しない（そもそも選びようがないため）", () => {
    expect(() => validateLocationPoolSize(1, 1)).not.toThrow();
  });
});
