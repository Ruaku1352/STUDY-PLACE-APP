import { toHHMM, toMinutes, weekdayIndex } from "./time";
import type {
  ScheduleBlock,
  SchedulerFixedEvent,
  SchedulerLocation,
  SchedulerSettings,
  SchedulerSubject,
  TravelTimeFn,
} from "./types";

export interface SubjectState {
  subject: SchedulerSubject;
  remaining: number;
}

const MIN_BLOCK = 60;
const MAX_CHUNK = 120;
const BREAK_THRESHOLD = 90;
const BREAK_LEN = 15;
const LUNCH_LEN = 45;
const LUNCH_WINDOW_START = toMinutes("11:30");
const LUNCH_WINDOW_END = toMinutes("13:30");

function businessOpenMin(loc: SchedulerLocation, weekday: number): number | undefined {
  const hrs = loc.openingHours[weekday];
  return hrs ? toMinutes(hrs.open) : undefined;
}

function businessCloseMin(loc: SchedulerLocation, weekday: number): number | undefined {
  const hrs = loc.openingHours[weekday];
  return hrs ? toMinutes(hrs.close) : undefined;
}

function pickSubject(states: SubjectState[], nowMin: number, morningEndMin: number): SubjectState | undefined {
  const eligible = states.filter((s) => s.remaining > 0);
  if (eligible.length === 0) return undefined;
  const byPriority = (a: SubjectState, b: SubjectState) => a.subject.priority - b.subject.priority;
  const inMorning = nowMin < morningEndMin;

  if (inMorning) {
    const morning = eligible.filter((s) => s.subject.timeSlot === "morning").sort(byPriority);
    if (morning.length > 0) return morning[0];
    return eligible.sort(byPriority)[0];
  }

  const anytime = eligible.filter((s) => s.subject.timeSlot === "anytime").sort(byPriority);
  if (anytime.length > 0) return anytime[0];
  // 午前枠に収まらなかった morning 科目の午後への繰り越し
  return eligible.sort(byPriority)[0];
}

interface ChosenLocation {
  location: SchedulerLocation;
  travelMin: number;
  arrival: number;
}

function chooseLocation(params: {
  locations: SchedulerLocation[];
  usedToday: Set<string>;
  weekday: number;
  tMin: number;
  windowEnd: number;
  usageHistory: string[];
  fromKey: string;
  travelTimeFn: TravelTimeFn;
}): ChosenLocation | undefined {
  const { locations, usedToday, weekday, tMin, windowEnd, usageHistory, fromKey, travelTimeFn } = params;

  const candidates: ChosenLocation[] = [];
  for (const location of locations) {
    if (usedToday.has(location.id)) continue;
    const open = businessOpenMin(location, weekday);
    const close = businessCloseMin(location, weekday);
    if (open === undefined || close === undefined) continue;

    const travelMin = travelTimeFn(fromKey, location.id);
    const arrival = Math.max(tMin + travelMin, open);
    const cap = Math.min(close, windowEnd);
    if (cap - arrival >= MIN_BLOCK) {
      candidates.push({ location, travelMin, arrival });
    }
  }
  if (candidates.length === 0) return undefined;

  // ローテーション: 使ったことがない場所を最優先、次に直近使用が古い場所を優先
  const score = (c: ChosenLocation) => {
    const idx = usageHistory.indexOf(c.location.id);
    return idx === -1 ? Number.POSITIVE_INFINITY : idx;
  };
  candidates.sort((a, b) => score(b) - score(a));
  return candidates[0];
}

function fillWindow(params: {
  windowStart: number;
  windowEnd: number;
  startLocation: string;
  date: string;
  weekday: number;
  locations: SchedulerLocation[];
  subjectStates: SubjectState[];
  morningEndMin: number;
  usedToday: Set<string>;
  usageHistory: string[];
  travelTimeFn: TravelTimeFn;
  hadLunch: { value: boolean };
  blocksOut: ScheduleBlock[];
}): string {
  const {
    windowStart,
    windowEnd,
    date,
    weekday,
    locations,
    subjectStates,
    morningEndMin,
    usedToday,
    usageHistory,
    travelTimeFn,
    hadLunch,
    blocksOut,
  } = params;

  let t = windowStart;
  let loc = params.startLocation;

  while (windowEnd - t >= MIN_BLOCK) {
    if (!subjectStates.some((s) => s.remaining > 0)) break;

    const picked = chooseLocation({
      locations,
      usedToday,
      weekday,
      tMin: t,
      windowEnd,
      usageHistory,
      fromKey: loc,
      travelTimeFn,
    });
    if (!picked) break;

    const { location, travelMin, arrival } = picked;
    if (travelMin > 0) {
      blocksOut.push({
        date,
        type: "move",
        startsAt: toHHMM(t),
        endsAt: toHHMM(t + travelMin),
        status: "planned",
      });
    }
    t = arrival;
    loc = location.id;
    usedToday.add(loc);
    usageHistory.unshift(loc);

    const close = businessCloseMin(location, weekday)!;
    const capByMaxStay = location.maxStayMin !== undefined ? t + location.maxStayMin : Number.POSITIVE_INFINITY;
    const sessionCap = Math.min(windowEnd, close, capByMaxStay);

    while (sessionCap - t >= MIN_BLOCK) {
      if (!hadLunch.value && t >= LUNCH_WINDOW_START && t < LUNCH_WINDOW_END && sessionCap - t - LUNCH_LEN >= 0) {
        blocksOut.push({ date, type: "lunch", startsAt: toHHMM(t), endsAt: toHHMM(t + LUNCH_LEN), status: "planned" });
        t += LUNCH_LEN;
        hadLunch.value = true;
        continue;
      }

      const subj = pickSubject(subjectStates, t, morningEndMin);
      if (!subj) break;

      const remainingSession = sessionCap - t;
      const chunk = Math.min(remainingSession, Math.max(MIN_BLOCK, Math.min(subj.remaining, MAX_CHUNK)));

      blocksOut.push({
        date,
        type: "study",
        startsAt: toHHMM(t),
        endsAt: toHHMM(t + chunk),
        subjectId: subj.subject.id,
        locationId: loc,
        status: "planned",
      });
      subj.remaining = Math.max(0, subj.remaining - chunk);
      t += chunk;

      if (chunk >= BREAK_THRESHOLD && sessionCap - t >= 20) {
        const breakLen = Math.min(BREAK_LEN, sessionCap - t);
        blocksOut.push({ date, type: "break", startsAt: toHHMM(t), endsAt: toHHMM(t + breakLen), status: "planned" });
        t += breakLen;
      }
    }
  }

  return loc;
}

export function generateDay(params: {
  date: string;
  subjectStates: SubjectState[];
  locations: SchedulerLocation[];
  fixedEvents: SchedulerFixedEvent[];
  settings: SchedulerSettings;
  travelTimeFn: TravelTimeFn;
  usageHistory: string[];
}): ScheduleBlock[] {
  const { date, subjectStates, locations, fixedEvents, settings, travelTimeFn, usageHistory } = params;

  const weekday = weekdayIndex(date);
  const isWeekend = weekday >= 5;
  const wake = toMinutes(isWeekend ? settings.wakeWeekend : settings.wakeWeekday);
  const outsideEnd = toMinutes(settings.outsideEnd);
  const morningEndMin = toMinutes(settings.morningEnd);

  const dayEvents = fixedEvents
    .filter((e) => e.date === date)
    .sort((a, b) => toMinutes(a.startsAt) - toMinutes(b.startsAt));

  const blocks: ScheduleBlock[] = [];
  const usedToday = new Set<string>();
  const hadLunch = { value: false };

  let t = wake;
  let loc = "home";

  for (const ev of dayEvents) {
    const evStart = toMinutes(ev.startsAt);
    const evEnd = toMinutes(ev.endsAt);

    if (evStart > t) {
      loc = fillWindow({
        windowStart: t,
        windowEnd: Math.min(evStart, outsideEnd),
        startLocation: loc,
        date,
        weekday,
        locations,
        subjectStates,
        morningEndMin,
        usedToday,
        usageHistory,
        travelTimeFn,
        hadLunch,
        blocksOut: blocks,
      });
    }

    blocks.push({ date, type: "event", startsAt: ev.startsAt, endsAt: ev.endsAt, status: "planned" });
    t = Math.max(t, evEnd);
    if (ev.locationId) {
      loc = ev.locationId;
    }
  }

  if (t < outsideEnd) {
    fillWindow({
      windowStart: t,
      windowEnd: outsideEnd,
      startLocation: loc,
      date,
      weekday,
      locations,
      subjectStates,
      morningEndMin,
      usedToday,
      usageHistory,
      travelTimeFn,
      hadLunch,
      blocksOut: blocks,
    });
  }

  return blocks;
}
