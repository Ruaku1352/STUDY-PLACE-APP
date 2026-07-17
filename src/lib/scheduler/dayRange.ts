import type { SubjectState } from "./core";
import { generateDay } from "./core";
import { computeDailyLimits } from "./dailyBudget";
import { addDaysToDate } from "./time";
import type {
  GenerateWeekResult,
  QuotaWarning,
  ScheduleBlock,
  SchedulerFixedEvent,
  SchedulerLocation,
  SchedulerSettings,
  TravelTimeFn,
} from "./types";

const DAYS_IN_WEEK = 7;

/**
 * weekStartDateの週(7日)のうち、startDate（含む）以降の日だけを対象にした
 * 絶対日オフセット(0=weekStartDate当日, ..., 6)の配列を返す。
 */
export function computeIncludedDayIndices(weekStartDate: string, startDate: string): number[] {
  return Array.from({ length: DAYS_IN_WEEK }, (_, d) => d).filter(
    (d) => addDaysToDate(weekStartDate, d) >= startDate,
  );
}

/**
 * weekStartDateの週のうち、startDate（含む）〜週末までの各日についてgenerateDayを実行し、
 * 日ごとの科目別上限(dailyLimit)を対象日数で均等配分する。
 * generateWeek（週はじめの新規生成、startDate=weekStartDate）と
 * reschedule（週の途中からの再生成、startDate=fromDate）の共通ロジック。
 * subjectStatesの初期状態（remaining）だけが呼び出し元ごとに異なる。
 */
export function generateDaysInRange(params: {
  weekStartDate: string;
  startDate: string;
  startLocationId: string;
  subjectStates: SubjectState[];
  locations: SchedulerLocation[];
  fixedEvents: SchedulerFixedEvent[];
  settings: SchedulerSettings;
  travelTimeFn: TravelTimeFn;
  recentlyUsedLocationIds?: string[];
}): GenerateWeekResult {
  const {
    weekStartDate,
    startDate,
    startLocationId,
    subjectStates,
    locations,
    fixedEvents,
    settings,
    travelTimeFn,
    recentlyUsedLocationIds,
  } = params;

  const includedDayIndices = computeIncludedDayIndices(weekStartDate, startDate);
  const dailyLimits = computeDailyLimits(
    subjectStates.map((s) => ({ id: s.subject.id, quotaMin: s.remaining })),
    includedDayIndices.length,
  );

  const usageHistory = [...(recentlyUsedLocationIds ?? [])];
  const blocks: ScheduleBlock[] = [];

  includedDayIndices.forEach((d, spreadIndex) => {
    for (const state of subjectStates) {
      state.dailyLimit = dailyLimits.get(state.subject.id)?.[spreadIndex] ?? 0;
    }

    const date = addDaysToDate(weekStartDate, d);
    blocks.push(
      ...generateDay({
        date,
        startLocation: startLocationId,
        subjectStates,
        locations,
        fixedEvents,
        settings,
        travelTimeFn,
        usageHistory,
      }),
    );
  });

  const warnings: QuotaWarning[] = subjectStates
    .filter((s) => s.remaining > 0)
    .map((s) => ({
      type: "quota_exceeded",
      subjectId: s.subject.id,
      shortfallMin: s.remaining,
      message: `${s.subject.name} のノルマに対して ${s.remaining} 分割り当てられませんでした`,
    }));

  return { blocks, warnings };
}
