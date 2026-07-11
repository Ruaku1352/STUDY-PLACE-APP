"use server";

import { revalidatePath } from "next/cache";
import { combineDateAndTime, dateStringToDate } from "@/lib/date";
import { getCurrentUserId } from "@/lib/currentUser";
import { buildSchedulerInput } from "@/lib/google/buildSchedulerInput";
import { createCalendarEventsForBlocks, deleteCalendarEventsByIds } from "@/lib/google/calendarSync";
import { buildSyncableBlocks } from "@/lib/google/syncableBlocks";
import { prisma } from "@/lib/prisma";
import { schedulerBlockToPrismaCreate } from "@/lib/scheduleBlocks";
import { generateWeek } from "@/lib/scheduler/generateWeek";
import { addDaysToDate } from "@/lib/scheduler/time";
import type { QuotaWarning } from "@/lib/scheduler/types";

export interface GeneratePlanResult {
  warnings: QuotaWarning[];
}

/**
 * 週の優先順位を保存し、そのままプランを生成する。
 * 生成した ScheduleBlock は DB に保存するのみで、呼び出し元には warnings しか返さない
 * （未開封日の場所・時間割をクライアントに一切送らないため）。
 * Googleカレンダーには全ブロックをマスクイベントとして書き出す。
 */
export async function generatePlan(weekStartDate: string, orderedSubjectIds: string[]): Promise<GeneratePlanResult> {
  const userId = await getCurrentUserId();

  await prisma.weeklyPlan.upsert({
    where: { userId_weekStartDate: { userId, weekStartDate: dateStringToDate(weekStartDate) } },
    create: { userId, weekStartDate: dateStringToDate(weekStartDate), priorities: orderedSubjectIds },
    update: { priorities: orderedSubjectIds },
  });

  const input = await buildSchedulerInput(userId, weekStartDate);
  const result = generateWeek(input);

  const weekEndDate = addDaysToDate(weekStartDate, 6);
  const rangeStart = dateStringToDate(weekStartDate);
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
      data: Array.from({ length: 7 }, (_, i) => ({
        userId,
        date: dateStringToDate(addDaysToDate(weekStartDate, i)),
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
    // 生成直後はすべて未開封 = 全ブロックをマスクイベントとして作成する
    const eventIdByBlockId = await createCalendarEventsForBlocks(userId, syncable, new Set());

    await Promise.all(
      Array.from(eventIdByBlockId.entries()).map(([blockId, gcalEventId]) =>
        prisma.scheduleBlock.update({ where: { id: blockId }, data: { gcalEventId } }),
      ),
    );
  } catch (e) {
    console.error("[generatePlan] Googleカレンダーへの同期に失敗しました", e);
  }

  revalidatePath("/");
  revalidatePath("/weekly-plan");

  return { warnings: result.warnings };
}
