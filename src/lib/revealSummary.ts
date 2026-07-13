import { toMinutes } from "./scheduler/time";

export interface RawTodayStudyBlock {
  startsAt: string; // "HH:MM"
  endsAt: string; // "HH:MM"
  locationName: string | null;
}

export interface TodayScheduleSummary {
  /** 訪問する場所名（重複除去・登場順）。 */
  locationNames: string[];
  /** 予定されている勉強ブロックの合計分数（開封時点ではまだ実績はないため、予定時間の合計）。 */
  totalStudyMin: number;
}

/** 当日の勉強ブロックから、開封カードに表示する概要（訪問場所・合計時間）を集計する純粋関数。 */
export function summarizeTodayBlocks(blocks: RawTodayStudyBlock[]): TodayScheduleSummary {
  const locationNames: string[] = [];
  let totalStudyMin = 0;

  for (const b of blocks) {
    if (b.locationName && !locationNames.includes(b.locationName)) {
      locationNames.push(b.locationName);
    }
    totalStudyMin += toMinutes(b.endsAt) - toMinutes(b.startsAt);
  }

  return { locationNames, totalStudyMin };
}
