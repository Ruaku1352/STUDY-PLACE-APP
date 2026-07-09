import type { SchedulerLocation, SchedulerSettings, TravelTimeFn, WeeklyOpeningHours } from "./types";

/** 全曜日で同じ営業時間にする（テストではカレンダー曜日を気にしなくてよいようにする） */
export function openAllDays(open: string, close: string): WeeklyOpeningHours {
  const hours: WeeklyOpeningHours = {};
  for (let i = 0; i < 7; i++) hours[i] = { open, close };
  return hours;
}

export const WEEK_START = "2026-01-05"; // 実際に月曜日

export const baseSettings: SchedulerSettings = {
  wakeWeekday: "08:00",
  wakeWeekend: "09:00",
  morningEnd: "12:00",
  outsideEnd: "21:00",
};

export const library: SchedulerLocation = {
  id: "loc-library",
  name: "図書館",
  kind: "library",
  openingHours: openAllDays("09:00", "22:00"),
};

export const libraryAlt: SchedulerLocation = {
  id: "loc-library-alt",
  name: "別の図書館",
  kind: "library",
  openingHours: openAllDays("09:00", "22:00"),
};

export const cafe: SchedulerLocation = {
  id: "loc-cafe",
  name: "カフェ",
  kind: "cafe",
  maxStayMin: 90,
  openingHours: openAllDays("09:00", "20:00"),
};

/** home→どこでも20分、場所間は15分の固定モック */
export const flatTravelTimeFn: TravelTimeFn = (from, to) => {
  if (from === to) return 0;
  return from === "home" ? 20 : 15;
};

export function makeRecordingTravelTimeFn(): { fn: TravelTimeFn; calls: Array<[string, string]> } {
  const calls: Array<[string, string]> = [];
  const fn: TravelTimeFn = (from, to) => {
    calls.push([from, to]);
    return flatTravelTimeFn(from, to);
  };
  return { fn, calls };
}
