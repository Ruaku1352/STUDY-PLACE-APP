import { toHHMM, toMinutes } from "../scheduler/time";
import type { HourlyWeatherPoint, WeatherBlock3h, WeatherSummary } from "./types";

/** 日中(出発〜21:00)の最大降水確率がこの値以上なら「雨の日」とみなす。 */
export const RAIN_PRECIPITATION_THRESHOLD_PERCENT = 50;

const BLOCK_LENGTH_MIN = 180;

/**
 * WMO weathercode の悪天候度。数値が大きいほど悪天候。
 * 3時間区間の集約で「区間内で最も悪天候のコード」を選ぶために使う。
 */
const WEATHER_CODE_SEVERITY: Record<number, number> = {
  0: 0, // 快晴
  1: 1, // 晴れ
  2: 2, // 一部曇り
  3: 3, // 曇り
  45: 4, // 霧
  48: 4, // 霧氷
  51: 5, // 弱い霧雨
  53: 6, // 霧雨
  55: 7, // 強い霧雨
  56: 7, // 着氷性の弱い霧雨
  57: 8, // 着氷性の霧雨
  61: 8, // 弱い雨
  63: 9, // 雨
  65: 10, // 強い雨
  66: 9, // 着氷性の弱い雨
  67: 10, // 着氷性の雨
  71: 8, // 弱い雪
  73: 9, // 雪
  75: 10, // 強い雪
  77: 6, // 霧雪
  80: 9, // 弱いにわか雨
  81: 10, // にわか雨
  82: 11, // 激しいにわか雨
  85: 9, // 弱いにわか雪
  86: 10, // にわか雪
  95: 12, // 雷雨
  96: 13, // 雷雨（ひょう混じり）
  99: 14, // 雷雨（激しいひょう混じり）
};

function severityOf(code: number): number {
  return WEATHER_CODE_SEVERITY[code] ?? 0;
}

/** 区間内のweathercode群から最も悪天候のものを選ぶ。 */
export function pickWorstWeatherCode(codes: number[]): number {
  return codes.reduce((worst, c) => (severityOf(c) > severityOf(worst) ? c : worst), codes[0] ?? 0);
}

/** 天気コードを絵文字に変換する（開封カード表示用）。 */
export function weatherCodeToEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 3) return "🌤️";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 71 && code <= 77) return "❄️";
  if (code >= 85 && code <= 86) return "🌨️";
  if (code >= 95) return "⛈️";
  if (code >= 51) return "🌧️";
  return "☀️";
}

/**
 * 起床時刻を含む3時間区切りの開始時刻一覧を、上限時刻(21:00)未満まで作る。
 * 例: 起床7:00 → ["07:00","10:00","13:00","16:00","19:00"]
 */
export function computeBlockStartTimes(wakeTimeHHMM: string, limitHHMM = "21:00"): string[] {
  const times: string[] = [];
  const limit = toMinutes(limitHHMM);
  for (let m = toMinutes(wakeTimeHHMM); m < limit; m += BLOCK_LENGTH_MIN) {
    times.push(toHHMM(m));
  }
  return times;
}

/**
 * 1時間ごとの生データを、指定した開始時刻ごとに3時間区切りで集約する。
 * 天気コードは区間内で最も悪天候のもの、気温は区間先頭時刻の値、
 * 降水確率は区間内の最大値を採用する（悲観側に倒す）。
 */
export function aggregateTo3Hour(hourly: HourlyWeatherPoint[], blockStartTimes: string[]): WeatherBlock3h[] {
  return blockStartTimes.map((startTime, i) => {
    const startMin = toMinutes(startTime);
    const endMin = i + 1 < blockStartTimes.length ? toMinutes(blockStartTimes[i + 1]) : startMin + BLOCK_LENGTH_MIN;

    const pointsInRange = hourly.filter((p) => {
      const t = toMinutes(p.time);
      return t >= startMin && t < endMin;
    });
    const points = pointsInRange.length > 0 ? pointsInRange : hourly.filter((p) => p.time === startTime);

    const startPoint = hourly.find((p) => p.time === startTime) ?? points[0];

    return {
      time: startTime,
      weatherCode: pickWorstWeatherCode(points.map((p) => p.weatherCode)),
      temperatureC: startPoint?.temperatureC ?? 0,
      precipitationProbability: points.reduce((max, p) => Math.max(max, p.precipitationProbability), 0),
    };
  });
}

/**
 * 日中(出発〜21:00)の範囲で最高/最低気温・最大降水確率・雨の日判定を求める。
 */
export function summarizeDayWeather(hourly: HourlyWeatherPoint[], startHHMM: string, endHHMM = "21:00"): WeatherSummary {
  const startMin = toMinutes(startHHMM);
  const endMin = toMinutes(endHHMM);
  const daytime = hourly.filter((p) => {
    const t = toMinutes(p.time);
    return t >= startMin && t <= endMin;
  });
  const points = daytime.length > 0 ? daytime : hourly;

  const temps = points.map((p) => p.temperatureC);
  const maxPrecip = points.reduce((max, p) => Math.max(max, p.precipitationProbability), 0);

  return {
    maxTempC: Math.max(...temps),
    minTempC: Math.min(...temps),
    maxPrecipitationProbability: maxPrecip,
    isRainy: maxPrecip >= RAIN_PRECIPITATION_THRESHOLD_PERCENT,
  };
}
