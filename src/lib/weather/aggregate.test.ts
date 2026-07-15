import { describe, expect, it } from "vitest";
import {
  aggregateTo3Hour,
  computeBlockStartTimes,
  pickWorstWeatherCode,
  summarizeDayWeather,
} from "./aggregate";
import type { HourlyWeatherPoint } from "./types";

function point(time: string, weatherCode: number, temperatureC: number, precipitationProbability: number): HourlyWeatherPoint {
  return { time, weatherCode, temperatureC, precipitationProbability };
}

describe("computeBlockStartTimes", () => {
  it("起床時刻から3時間区切りで21:00未満の開始時刻を作る", () => {
    expect(computeBlockStartTimes("07:00")).toEqual(["07:00", "10:00", "13:00", "16:00", "19:00"]);
  });

  it("起床時刻が21:00に近い場合は少ないコマになる", () => {
    expect(computeBlockStartTimes("20:00")).toEqual(["20:00"]);
  });
});

describe("pickWorstWeatherCode", () => {
  it("区間内で最も悪天候のコードを選ぶ", () => {
    expect(pickWorstWeatherCode([0, 1, 63])).toBe(63); // 快晴・晴れ・雨 → 雨
    expect(pickWorstWeatherCode([95, 61])).toBe(95); // 雷雨・弱い雨 → 雷雨
  });
});

describe("aggregateTo3Hour", () => {
  const hourly: HourlyWeatherPoint[] = [
    point("07:00", 1, 18, 10),
    point("08:00", 2, 19, 20),
    point("09:00", 63, 20, 70), // 09時に雨
    point("10:00", 1, 22, 5),
    point("11:00", 1, 23, 5),
  ];

  it("天気コードは区間内最悪、気温は区間先頭、降水確率は区間内最大を採用する", () => {
    const blocks = aggregateTo3Hour(hourly, ["07:00", "10:00"]);

    expect(blocks).toEqual([
      { time: "07:00", weatherCode: 63, temperatureC: 18, precipitationProbability: 70 },
      { time: "10:00", weatherCode: 1, temperatureC: 22, precipitationProbability: 5 },
    ]);
  });
});

describe("summarizeDayWeather", () => {
  it("日中の最大降水確率が閾値(50%)未満なら雨の日ではない", () => {
    const hourly = [point("07:00", 1, 18, 10), point("12:00", 2, 25, 40)];
    const summary = summarizeDayWeather(hourly, "07:00");
    expect(summary.isRainy).toBe(false);
    expect(summary.maxTempC).toBe(25);
    expect(summary.minTempC).toBe(18);
    expect(summary.maxPrecipitationProbability).toBe(40);
  });

  it("日中の最大降水確率が閾値(50%)以上なら雨の日と判定する", () => {
    const hourly = [point("07:00", 1, 18, 10), point("12:00", 63, 20, 80)];
    const summary = summarizeDayWeather(hourly, "07:00");
    expect(summary.isRainy).toBe(true);
    expect(summary.maxPrecipitationProbability).toBe(80);
  });

  it("日中(出発〜21:00)の範囲外のデータは集計に含めない", () => {
    const hourly = [point("22:00", 63, 20, 90), point("08:00", 1, 15, 10)];
    const summary = summarizeDayWeather(hourly, "07:00", "21:00");
    expect(summary.isRainy).toBe(false);
    expect(summary.maxPrecipitationProbability).toBe(10);
  });
});
