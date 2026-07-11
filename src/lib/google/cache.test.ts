import { describe, expect, it, vi } from "vitest";
import { getOpeningHours, getTravelMinutes, type OpeningHoursStore, type TravelCacheStore } from "./cache";
import type { PlacesWeeklyHours } from "./places";

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function fakeTravelStore(initial?: { minutes: number; fetchedAt: Date }): TravelCacheStore & { upserts: number } {
  let record = initial ?? null;
  return {
    upserts: 0,
    async find() {
      return record;
    },
    async upsert(_userId, _fromKey, _toKey, minutes) {
      this.upserts++;
      record = { minutes, fetchedAt: new Date() };
    },
  };
}

describe("getTravelMinutes (キャッシュ層)", () => {
  it("有効なキャッシュがあればAPIを呼ばずキャッシュを返す", async () => {
    const store = fakeTravelStore({ minutes: 25, fetchedAt: daysAgo(1) });
    const fetchFn = vi.fn().mockResolvedValue(999);

    const result = await getTravelMinutes({ store, userId: "u1", fromKey: "home", toKey: "loc1", fetchFn });

    expect(result).toEqual({ minutes: 25, source: "cache" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("キャッシュがなければAPIを呼び、結果をキャッシュに保存する", async () => {
    const store = fakeTravelStore();
    const fetchFn = vi.fn().mockResolvedValue(30);

    const result = await getTravelMinutes({ store, userId: "u1", fromKey: "home", toKey: "loc1", fetchFn });

    expect(result).toEqual({ minutes: 30, source: "api" });
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(store.upserts).toBe(1);
  });

  it("キャッシュが期限切れ（30日超）ならAPIを再度呼ぶ", async () => {
    const store = fakeTravelStore({ minutes: 25, fetchedAt: daysAgo(31) });
    const fetchFn = vi.fn().mockResolvedValue(40);

    const result = await getTravelMinutes({ store, userId: "u1", fromKey: "home", toKey: "loc1", fetchFn });

    expect(result).toEqual({ minutes: 40, source: "api" });
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("APIが失敗し期限切れキャッシュがあれば、その値にフォールバックする", async () => {
    const store = fakeTravelStore({ minutes: 25, fetchedAt: daysAgo(31) });
    const fetchFn = vi.fn().mockRejectedValue(new Error("network error"));

    const result = await getTravelMinutes({ store, userId: "u1", fromKey: "home", toKey: "loc1", fetchFn });

    expect(result).toEqual({ minutes: 25, source: "stale-cache" });
  });

  it("APIが失敗しキャッシュもなければ、手動入力値にフォールバックする", async () => {
    const store = fakeTravelStore();
    const fetchFn = vi.fn().mockRejectedValue(new Error("network error"));

    const result = await getTravelMinutes({
      store,
      userId: "u1",
      fromKey: "home",
      toKey: "loc1",
      fetchFn,
      manualFallbackMin: 45,
    });

    expect(result).toEqual({ minutes: 45, source: "manual" });
  });

  it("APIが失敗しキャッシュも手動入力値もなければ null を返す", async () => {
    const store = fakeTravelStore();
    const fetchFn = vi.fn().mockRejectedValue(new Error("network error"));

    const result = await getTravelMinutes({ store, userId: "u1", fromKey: "home", toKey: "loc1", fetchFn });

    expect(result).toBeNull();
  });
});

function fakeOpeningHoursStore(initial?: {
  hours: PlacesWeeklyHours;
  fetchedAt: Date;
}): OpeningHoursStore & { saves: number } {
  let record = initial ?? null;
  return {
    saves: 0,
    async find() {
      return record;
    },
    async save(_userId, _locationId, hours) {
      this.saves++;
      record = { hours, fetchedAt: new Date() };
    },
  };
}

describe("getOpeningHours (キャッシュ層)", () => {
  const sampleHours: PlacesWeeklyHours = { 0: { open: "09:00", close: "20:00" } };

  it("有効なキャッシュがあればAPIを呼ばない", async () => {
    const store = fakeOpeningHoursStore({ hours: sampleHours, fetchedAt: daysAgo(1) });
    const fetchFn = vi.fn().mockResolvedValue({ 0: { open: "00:00", close: "23:59" } });

    const result = await getOpeningHours({ store, userId: "u1", locationId: "loc1", fetchFn });

    expect(result).toEqual({ hours: sampleHours, source: "cache" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("APIが失敗し期限切れキャッシュがあれば、その値にフォールバックする", async () => {
    const store = fakeOpeningHoursStore({ hours: sampleHours, fetchedAt: daysAgo(31) });
    const fetchFn = vi.fn().mockRejectedValue(new Error("network error"));

    const result = await getOpeningHours({ store, userId: "u1", locationId: "loc1", fetchFn });

    expect(result).toEqual({ hours: sampleHours, source: "stale-cache" });
  });

  it("APIが失敗しキャッシュもなければ manualHoursJson にフォールバックする", async () => {
    const store = fakeOpeningHoursStore();
    const fetchFn = vi.fn().mockRejectedValue(new Error("network error"));
    const manualFallback: PlacesWeeklyHours = { 1: { open: "10:00", close: "18:00" } };

    const result = await getOpeningHours({ store, userId: "u1", locationId: "loc1", fetchFn, manualFallback });

    expect(result).toEqual({ hours: manualFallback, source: "manual" });
  });
});
