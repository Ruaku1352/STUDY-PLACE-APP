import { describe, expect, it, vi } from "vitest";
import { getDayWeather, type DayWeatherStore } from "./cache";
import type { HourlyWeatherPoint } from "./types";

const samplePoint: HourlyWeatherPoint = { time: "07:00", weatherCode: 1, temperatureC: 20, precipitationProbability: 10 };

function fakeStore(initial?: HourlyWeatherPoint[]): DayWeatherStore & { saves: number } {
  let record = initial ?? null;
  return {
    saves: 0,
    async find() {
      return record ? { hourly: record } : null;
    },
    async save(_userId, _date, hourly) {
      this.saves++;
      record = hourly;
    },
  };
}

describe("getDayWeather (キャッシュ層)", () => {
  it("同日にすでに取得済みならAPIを呼ばずキャッシュを返す", async () => {
    const store = fakeStore([samplePoint]);
    const fetchFn = vi.fn().mockResolvedValue([{ ...samplePoint, temperatureC: 999 }]);

    const result = await getDayWeather({ store, userId: "u1", date: "2026-07-15", fetchFn });

    expect(result).toEqual({ hourly: [samplePoint], source: "cache" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("未取得ならAPIを呼び、結果をキャッシュに保存する", async () => {
    const store = fakeStore();
    const fetchFn = vi.fn().mockResolvedValue([samplePoint]);

    const result = await getDayWeather({ store, userId: "u1", date: "2026-07-15", fetchFn });

    expect(result).toEqual({ hourly: [samplePoint], source: "api" });
    expect(store.saves).toBe(1);
  });

  it("API失敗時は例外を投げずnullを返す（天気なしで通常フロー続行）", async () => {
    const store = fakeStore();
    const fetchFn = vi.fn().mockRejectedValue(new Error("network error"));

    const result = await getDayWeather({ store, userId: "u1", date: "2026-07-15", fetchFn });

    expect(result).toBeNull();
  });
});
