import { describe, expect, it } from "vitest";
import { MIN_LOCATION_POOL_SIZE, filterEnabledLocations, validateLocationPoolSize } from "./locationPool";

describe("filterEnabledLocations", () => {
  const locations = [
    { id: "a", isEnabled: true },
    { id: "b", isEnabled: false },
    { id: "c", isEnabled: true },
  ];

  it("isEnabledがtrueの場所だけを返す", () => {
    expect(filterEnabledLocations(locations)).toEqual([
      { id: "a", isEnabled: true },
      { id: "c", isEnabled: true },
    ]);
  });

  it("全て無効なら空配列を返す", () => {
    expect(filterEnabledLocations([{ id: "a", isEnabled: false }])).toEqual([]);
  });
});

describe("validateLocationPoolSize", () => {
  it(`登録場所が${MIN_LOCATION_POOL_SIZE}件以上あるのに有効な場所が${MIN_LOCATION_POOL_SIZE}件未満なら例外を投げる`, () => {
    expect(() => validateLocationPoolSize(3, 1)).toThrow();
  });

  it(`有効な場所が${MIN_LOCATION_POOL_SIZE}件以上なら例外を投げない`, () => {
    expect(() => validateLocationPoolSize(3, 2)).not.toThrow();
  });

  it("登録場所自体が1件しかない場合は検証しない（そもそも選びようがないため）", () => {
    expect(() => validateLocationPoolSize(1, 1)).not.toThrow();
  });
});
