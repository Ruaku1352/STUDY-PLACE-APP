"use server";

import { revalidatePath } from "next/cache";
import { combineDateAndTime, dateStringToDate, dateToDateString, dateToHHMM, todayDateString } from "@/lib/date";
import { getCurrentUserId } from "@/lib/currentUser";
import { FALLBACK_MISSION_TEXT, generateMissionText } from "@/lib/ai/missionText";
import { calcBookProgress } from "@/lib/books";
import { summarizeTodayBlocks } from "@/lib/revealSummary";
import type { RevealResult } from "@/app/gacha/types";
import { buildSchedulerInput } from "@/lib/google/buildSchedulerInput";
import { resolveTodayWeatherForUser } from "@/lib/weather/resolveTodayWeather";
import {
  createCalendarEventsForBlocks,
  deleteCalendarEventsByIds,
  revealCalendarEventsForBlocks,
} from "@/lib/google/calendarSync";
import { buildSyncableBlocks } from "@/lib/google/syncableBlocks";
import { prisma } from "@/lib/prisma";
import { prismaBlockToScheduler, schedulerBlockToPrismaCreate } from "@/lib/scheduleBlocks";
import { reroll } from "@/lib/scheduler/reroll";
import { reschedule } from "@/lib/scheduler/reschedule";
import { addDaysToDate, weekdayIndex } from "@/lib/scheduler/time";
import { getDefaultStartPointId } from "@/lib/startPoints";
import { applyDailyResult } from "@/lib/streak";

function currentWeekStart(today: string): string {
  return addDaysToDate(today, -weekdayIndex(today));
}

function datesBetween(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let d = startDate;
  while (d <= endDate) {
    dates.push(d);
    d = addDaysToDate(d, 1);
  }
  return dates;
}

/**
 * 開封演出（RevealCard）に必要な情報一式（ミッション文・訪問場所・合計勉強時間・天気）を組み立てる。
 * ミッション文はforce=falseの場合、既に生成済みならAPIを再呼び出しせずキャッシュを返す
 * （1日1回のみ生成というコスト対策）。リロール時はforce=trueで再生成してよい。
 * ミッション文の生成に失敗しても例外は投げず、固定文にフォールバックする。
 * rainRuleAppliedはリロール時に雨の日の近場優先抽選が実際に発動したかどうかを渡す（開封カードへの明示用）。
 */
async function buildRevealResult(
  userId: string,
  today: string,
  forceMissionText = false,
  rainRuleApplied = false,
): Promise<RevealResult> {
  const [blocks, subjects, locations, streak, dayState, resolvedWeather] = await Promise.all([
    prisma.scheduleBlock.findMany({ where: { userId, date: dateStringToDate(today), type: "study" } }),
    prisma.subject.findMany({ where: { userId } }),
    prisma.location.findMany({ where: { userId } }),
    prisma.streak.findUnique({ where: { userId } }),
    prisma.dayState.findUnique({ where: { userId_date: { userId, date: dateStringToDate(today) } } }),
    resolveTodayWeatherForUser({ prisma, userId, date: today }),
  ]);

  const subjectNameById = new Map(subjects.map((s) => [s.id, s.name]));
  const locationNameById = new Map(locations.map((l) => [l.id, l.name]));

  const blockSummaries = blocks.map((b) => ({
    subjectName: b.subjectId ? (subjectNameById.get(b.subjectId) ?? null) : null,
    locationName: b.locationId ? (locationNameById.get(b.locationId) ?? null) : null,
    startsAt: dateToHHMM(b.startsAt),
    endsAt: dateToHHMM(b.endsAt),
  }));

  const { locationNames, totalStudyMin } = summarizeTodayBlocks(blockSummaries);

  const weather = resolvedWeather ? { ...resolvedWeather.summary, blocks: resolvedWeather.blocks } : null;

  let missionText: string;
  if (!forceMissionText && dayState?.missionText) {
    missionText = dayState.missionText;
  } else {
    try {
      missionText = await generateMissionText({
        blocks: blockSummaries,
        streakDays: streak?.currentCount ?? 0,
        weather: weather ? { isRainy: weather.isRainy, maxTempC: weather.maxTempC, minTempC: weather.minTempC } : null,
      });
      await prisma.dayState.updateMany({ where: { userId, date: dateStringToDate(today) }, data: { missionText } });
    } catch (e) {
      console.error("[buildRevealResult] ミッション文の生成に失敗しました。固定文にフォールバックします", e);
      missionText = FALLBACK_MISSION_TEXT;
    }
  }

  return { missionText, locationNames, totalStudyMin, weather, rainRuleApplied };
}

export async function revealToday(): Promise<RevealResult> {
  const userId = await getCurrentUserId();
  const today = todayDateString();
  const updated = await prisma.dayState.updateMany({
    where: { userId, date: dateStringToDate(today), revealedAt: null },
    data: { revealedAt: new Date() },
  });

  if (updated.count > 0) {
    try {
      const blocks = await prisma.scheduleBlock.findMany({ where: { userId, date: dateStringToDate(today) } });
      const syncable = await buildSyncableBlocks(userId, blocks);
      await revealCalendarEventsForBlocks(userId, syncable);
    } catch (e) {
      console.error("[revealToday] Googleカレンダーの更新に失敗しました", e);
    }
  }

  const result = await buildRevealResult(userId, today);

  revalidatePath("/");
  return result;
}

export async function giveUpToday(): Promise<void> {
  const userId = await getCurrentUserId();
  const today = todayDateString();
  const dayState = await prisma.dayState.findUnique({
    where: { userId_date: { userId, date: dateStringToDate(today) } },
  });
  if (!dayState) return;

  const wasRevealed = Boolean(dayState.revealedAt);

  await prisma.dayState.update({
    where: { id: dayState.id },
    data: { gaveUp: true, revealedAt: dayState.revealedAt ?? new Date() },
  });

  if (!wasRevealed) {
    try {
      const blocks = await prisma.scheduleBlock.findMany({ where: { userId, date: dateStringToDate(today) } });
      const syncable = await buildSyncableBlocks(userId, blocks);
      await revealCalendarEventsForBlocks(userId, syncable);
    } catch (e) {
      console.error("[giveUpToday] Googleカレンダーの更新に失敗しました", e);
    }
  }

  revalidatePath("/");
}

export async function rerollToday(): Promise<RevealResult> {
  const userId = await getCurrentUserId();
  const today = todayDateString();
  const dayState = await prisma.dayState.findUnique({
    where: { userId_date: { userId, date: dateStringToDate(today) } },
  });
  if (!dayState || dayState.rerollUsed) {
    throw new Error("リロールはこの日にはもう使えません");
  }

  const weekStartDate = currentWeekStart(today);
  const startPointId = dayState.startPointId ?? (await getDefaultStartPointId(userId));
  const input = await buildSchedulerInput(userId, weekStartDate, startPointId);

  // 開封時に取得済みの当日の天気（同日なのでキャッシュから取得され、APIは再度呼ばれない）から
  // 雨の日かどうかを判定し、雨の日ルール（近場優先の重み付け抽選）に反映する。
  const resolvedWeather = await resolveTodayWeatherForUser({ prisma, userId, date: today });
  const isRainy = resolvedWeather?.summary.isRainy ?? false;

  const previousBlocksRaw = await prisma.scheduleBlock.findMany({
    where: { userId, date: dateStringToDate(today) },
  });

  const rerollOutput = reroll({
    date: today,
    startLocationId: startPointId,
    previousBlocks: previousBlocksRaw.map(prismaBlockToScheduler),
    subjects: input.subjects,
    locations: input.locations,
    fixedEvents: input.fixedEvents.filter((e) => e.date === today),
    settings: input.settings,
    travelTimeFn: input.travelTimeFn,
    recentlyUsedLocationIds: input.recentlyUsedLocationIds,
    isRainy,
  });

  await prisma.$transaction([
    prisma.scheduleBlock.deleteMany({ where: { userId, date: dateStringToDate(today) } }),
    prisma.scheduleBlock.createMany({
      data: rerollOutput.blocks.map((b) => schedulerBlockToPrismaCreate(userId, b)),
    }),
    prisma.dayState.update({ where: { id: dayState.id }, data: { rerollUsed: true } }),
  ]);

  try {
    await deleteCalendarEventsByIds(
      userId,
      previousBlocksRaw.map((b) => b.gcalEventId),
    );

    const newBlocks = await prisma.scheduleBlock.findMany({ where: { userId, date: dateStringToDate(today) } });
    const syncable = await buildSyncableBlocks(userId, newBlocks);
    // reroll は開封済みの当日にしか使えないので、新しいブロックは最初から実名で作成する
    const revealedIds = new Set(syncable.map((b) => b.id));
    const eventIdByBlockId = await createCalendarEventsForBlocks(userId, syncable, revealedIds);

    await Promise.all(
      Array.from(eventIdByBlockId.entries()).map(([blockId, gcalEventId]) =>
        prisma.scheduleBlock.update({ where: { id: blockId }, data: { gcalEventId } }),
      ),
    );
  } catch (e) {
    console.error("[rerollToday] Googleカレンダーの同期に失敗しました", e);
  }

  const result = await buildRevealResult(userId, today, true, rerollOutput.rainRuleApplied);

  revalidatePath("/");
  return result;
}

/**
 * 開封前の今日の出発地点を変更し、その出発地点を基準に今日のブロックを再生成する。
 * リロールとは異なりrerollUsedは消費せず、天気はまだ取得しない（開封時にはじめて取得するため）。
 * 開封後（revealedAt/gaveUp）は変更できない。
 */
export async function setStartPointForToday(startPointId: string): Promise<void> {
  const userId = await getCurrentUserId();
  const today = todayDateString();

  const dayState = await prisma.dayState.findUnique({
    where: { userId_date: { userId, date: dateStringToDate(today) } },
  });
  if (!dayState || dayState.revealedAt || dayState.gaveUp) {
    throw new Error("開封後は出発地点を変更できません");
  }

  const startPoint = await prisma.startPoint.findFirst({ where: { id: startPointId, userId } });
  if (!startPoint) {
    throw new Error("出発地点が見つかりません");
  }

  const weekStartDate = currentWeekStart(today);
  const input = await buildSchedulerInput(userId, weekStartDate, startPointId);

  const previousBlocksRaw = await prisma.scheduleBlock.findMany({
    where: { userId, date: dateStringToDate(today) },
  });

  const rerollOutput = reroll({
    date: today,
    startLocationId: startPointId,
    previousBlocks: previousBlocksRaw.map(prismaBlockToScheduler),
    subjects: input.subjects,
    locations: input.locations,
    fixedEvents: input.fixedEvents.filter((e) => e.date === today),
    settings: input.settings,
    travelTimeFn: input.travelTimeFn,
    recentlyUsedLocationIds: input.recentlyUsedLocationIds,
  });

  await prisma.$transaction([
    prisma.scheduleBlock.deleteMany({ where: { userId, date: dateStringToDate(today) } }),
    prisma.scheduleBlock.createMany({
      data: rerollOutput.blocks.map((b) => schedulerBlockToPrismaCreate(userId, b)),
    }),
    prisma.dayState.update({ where: { id: dayState.id }, data: { startPointId } }),
  ]);

  try {
    await deleteCalendarEventsByIds(
      userId,
      previousBlocksRaw.map((b) => b.gcalEventId),
    );

    const newBlocks = await prisma.scheduleBlock.findMany({ where: { userId, date: dateStringToDate(today) } });
    const syncable = await buildSyncableBlocks(userId, newBlocks);
    // 開封前なのでマスクイベントとして作り直す
    const eventIdByBlockId = await createCalendarEventsForBlocks(userId, syncable, new Set());

    await Promise.all(
      Array.from(eventIdByBlockId.entries()).map(([blockId, gcalEventId]) =>
        prisma.scheduleBlock.update({ where: { id: blockId }, data: { gcalEventId } }),
      ),
    );
  } catch (e) {
    console.error("[setStartPointForToday] Googleカレンダーの同期に失敗しました", e);
  }

  revalidatePath("/");
}

export async function reschedulePlan(): Promise<void> {
  const userId = await getCurrentUserId();
  const today = todayDateString();
  const weekStartDate = currentWeekStart(today);
  const weekEndDate = addDaysToDate(weekStartDate, 6);

  const todaysBlocks = await prisma.scheduleBlock.findMany({
    where: { userId, date: dateStringToDate(today) },
  });
  const todayHasProgress = todaysBlocks.some((b) => b.status === "done" || b.status === "partial");
  const fromDate = todayHasProgress ? addDaysToDate(today, 1) : today;

  if (fromDate > weekEndDate) {
    revalidatePath("/");
    return;
  }

  const completedRows = await prisma.scheduleBlock.findMany({
    where: {
      userId,
      date: { gte: dateStringToDate(weekStartDate), lte: combineDateAndTime(weekEndDate, "23:59") },
      status: { in: ["done", "partial"] },
    },
  });

  const startPointId = await getDefaultStartPointId(userId);
  const input = await buildSchedulerInput(userId, weekStartDate, startPointId);
  const result = reschedule({
    ...input,
    fromDate,
    completedBlocks: completedRows.map(prismaBlockToScheduler),
  });

  const rangeStart = dateStringToDate(fromDate);
  const rangeEnd = combineDateAndTime(weekEndDate, "23:59");

  const oldBlocks = await prisma.scheduleBlock.findMany({
    where: { userId, date: { gte: rangeStart, lte: rangeEnd } },
    select: { gcalEventId: true },
  });

  await prisma.$transaction([
    prisma.scheduleBlock.deleteMany({ where: { userId, date: { gte: rangeStart, lte: rangeEnd } } }),
    prisma.dayState.deleteMany({ where: { userId, date: { gte: rangeStart, lte: rangeEnd } } }),
    prisma.scheduleBlock.createMany({
      data: result.blocks.map((b) => schedulerBlockToPrismaCreate(userId, b)),
    }),
    prisma.dayState.createMany({
      data: datesBetween(fromDate, weekEndDate).map((d) => ({
        userId,
        date: dateStringToDate(d),
        rerollUsed: false,
        gaveUp: false,
      })),
    }),
  ]);

  try {
    await deleteCalendarEventsByIds(
      userId,
      oldBlocks.map((b) => b.gcalEventId),
    );

    const newBlocks = await prisma.scheduleBlock.findMany({
      where: { userId, date: { gte: rangeStart, lte: rangeEnd } },
    });
    const syncable = await buildSyncableBlocks(userId, newBlocks);
    // fromDate が今日の場合、今日はすでに開封済み（ボタンは開封後のみ表示）なので実名で作成する
    const revealedIds = new Set(syncable.filter((b) => dateToDateString(b.startsAt) === today).map((b) => b.id));
    const eventIdByBlockId = await createCalendarEventsForBlocks(userId, syncable, revealedIds);

    await Promise.all(
      Array.from(eventIdByBlockId.entries()).map(([blockId, gcalEventId]) =>
        prisma.scheduleBlock.update({ where: { id: blockId }, data: { gcalEventId } }),
      ),
    );
  } catch (e) {
    console.error("[reschedulePlan] Googleカレンダーの同期に失敗しました", e);
  }

  revalidatePath("/");
}

export async function updateBlockStatus(
  blockId: string,
  status: "done" | "partial" | "skipped",
  actualMin: number,
): Promise<void> {
  const userId = await getCurrentUserId();
  await prisma.scheduleBlock.updateMany({
    where: { id: blockId, userId },
    data: { status, actualMin },
  });

  if (status === "done" || status === "partial") {
    await updateStreakForToday(userId);
  }

  revalidatePath("/");
}

/** その日に1件以上の完了/一部完了があったことをストリークに反映する。同日内の再呼び出しは冪等。 */
async function updateStreakForToday(userId: string): Promise<void> {
  const today = todayDateString();
  const streak = await prisma.streak.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });

  const result = applyDailyResult(
    {
      currentCount: streak.currentCount,
      longestCount: streak.longestCount,
      lastQualifiedDate: streak.lastQualifiedDate ? dateToDateString(streak.lastQualifiedDate) : null,
      freezeUsedInWeek: streak.freezeUsedInWeek,
    },
    { date: today, hasProgress: true },
  );

  await prisma.streak.update({
    where: { userId },
    data: {
      currentCount: result.currentCount,
      longestCount: result.longestCount,
      lastQualifiedDate: dateStringToDate(result.lastQualifiedDate ?? today),
      freezeUsedInWeek: result.freezeUsedInWeek,
    },
  });
}

export async function updateBlockManual(blockId: string, formData: FormData): Promise<void> {
  const userId = await getCurrentUserId();
  const block = await prisma.scheduleBlock.findFirst({ where: { id: blockId, userId } });
  if (!block) return;

  const dateStr = todayDateString();
  const startsAt = String(formData.get("startsAt") ?? "");
  const endsAt = String(formData.get("endsAt") ?? "");
  const locationId = String(formData.get("locationId") ?? "") || null;

  await prisma.scheduleBlock.update({
    where: { id: blockId },
    data: {
      startsAt: combineDateAndTime(dateStr, startsAt),
      endsAt: combineDateAndTime(dateStr, endsAt),
      locationId,
    },
  });

  if (block.gcalEventId) {
    try {
      const updatedBlock = await prisma.scheduleBlock.findUniqueOrThrow({ where: { id: blockId } });
      const [syncable] = await buildSyncableBlocks(userId, [updatedBlock]);
      await revealCalendarEventsForBlocks(userId, [syncable]);
    } catch (e) {
      console.error("[updateBlockManual] Googleカレンダーの更新に失敗しました", e);
    }
  }

  revalidatePath("/");
}

export async function deleteBlockManual(blockId: string): Promise<void> {
  const userId = await getCurrentUserId();
  const block = await prisma.scheduleBlock.findFirst({ where: { id: blockId, userId } });
  if (!block) return;

  await prisma.scheduleBlock.deleteMany({ where: { id: blockId, userId } });

  if (block.gcalEventId) {
    try {
      await deleteCalendarEventsByIds(userId, [block.gcalEventId]);
    } catch (e) {
      console.error("[deleteBlockManual] Googleカレンダーの削除に失敗しました", e);
    }
  }

  revalidatePath("/");
}

/** 勉強ブロックに紐づく参考書のページ実績を記録する。未入力でも完了記録・ストリークには影響しない任意機能。 */
export async function recordReadingLog(blockId: string, bookId: string, fromPage: number, toPage: number): Promise<void> {
  const userId = await getCurrentUserId();

  const [block, book] = await Promise.all([
    prisma.scheduleBlock.findFirst({ where: { id: blockId, userId } }),
    prisma.book.findFirst({ where: { id: bookId, userId } }),
  ]);
  if (!block || !book) return;

  await prisma.readingLog.create({
    data: { userId, bookId, scheduleBlockId: blockId, fromPage, toPage, date: block.date },
  });

  if (!book.completedAt) {
    const maxPageRead = await prisma.readingLog.aggregate({ where: { bookId }, _max: { toPage: true } });
    const { completed } = calcBookProgress(book.totalPages, maxPageRead._max.toPage ?? 0);
    if (completed) {
      await prisma.book.update({ where: { id: bookId }, data: { completedAt: new Date() } });
    }
  }

  revalidatePath("/");
}
