import { generateDay, type SubjectState } from "./core";
import { toMinutes } from "./time";
import type {
  ScheduleBlock,
  SchedulerFixedEvent,
  SchedulerLocation,
  SchedulerSettings,
  SchedulerSubject,
  TravelTimeFn,
} from "./types";

export interface RerollInput {
  date: string;
  /** その日の直前のプラン（科目ごとの分数配分と、避けたい場所を読み取るために使う） */
  previousBlocks: ScheduleBlock[];
  subjects: SchedulerSubject[];
  locations: SchedulerLocation[];
  fixedEvents: SchedulerFixedEvent[];
  settings: SchedulerSettings;
  travelTimeFn: TravelTimeFn;
  recentlyUsedLocationIds?: string[];
  /** 開封時に取得済みの当日の天気から判定した「雨の日」フラグ。trueなら近場優先の重み付け抽選にする。 */
  isRainy?: boolean;
  randomFn?: () => number;
}

export interface RerollResult {
  blocks: ScheduleBlock[];
  /** 雨ルール（近場優先の重み付け抽選）が実際に発動したか。開封カードへの明示に使う。 */
  rainRuleApplied: boolean;
}

export function reroll(input: RerollInput): RerollResult {
  const targetMinutesBySubject = new Map<string, number>();
  const previousLocationIds = new Set<string>();

  for (const b of input.previousBlocks) {
    if (b.type !== "study" || !b.subjectId) continue;
    const minutes = toMinutes(b.endsAt) - toMinutes(b.startsAt);
    targetMinutesBySubject.set(b.subjectId, (targetMinutesBySubject.get(b.subjectId) ?? 0) + minutes);
    if (b.locationId) previousLocationIds.add(b.locationId);
  }

  const subjectStates: SubjectState[] = input.subjects
    .filter((s) => targetMinutesBySubject.has(s.id))
    .map((s) => {
      const target = targetMinutesBySubject.get(s.id)!;
      // reroll は単日の再抽選なので、週配分の上限は課さず前回のその日の配分をそのまま上限にする
      return { subject: s, remaining: target, dailyLimit: target };
    });

  // 前回と同じ場所構成にならないよう、選択肢があれば前回使った場所を除外する
  const alternativeLocations = input.locations.filter((l) => !previousLocationIds.has(l.id));
  const locations = alternativeLocations.length > 0 ? alternativeLocations : input.locations;

  const usageHistory = [...previousLocationIds, ...(input.recentlyUsedLocationIds ?? [])];

  const blocks = generateDay({
    date: input.date,
    subjectStates,
    locations,
    fixedEvents: input.fixedEvents,
    settings: input.settings,
    travelTimeFn: input.travelTimeFn,
    usageHistory,
    isRainy: input.isRainy,
    randomFn: input.randomFn,
  });

  const rainRuleApplied = Boolean(input.isRainy) && blocks.some((b) => b.type === "study" && b.locationId);

  return { blocks, rainRuleApplied };
}
