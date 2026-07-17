"use server";

import { revalidatePath } from "next/cache";
import { combineDateAndTime, dateStringToDate } from "@/lib/date";
import { getCurrentUserId } from "@/lib/currentUser";
import { buildWeeklyReviewInput } from "@/lib/ai/buildWeeklyReviewInput";
import { generateRandomInitialProposal, generateWeeklyProposal, type WeeklyProposal } from "@/lib/ai/weeklyProposal";
import { buildSchedulerInput } from "@/lib/google/buildSchedulerInput";
import { createCalendarEventsForBlocks, deleteCalendarEventsByIds } from "@/lib/google/calendarSync";
import { buildSyncableBlocks } from "@/lib/google/syncableBlocks";
import { prisma } from "@/lib/prisma";
import { schedulerBlockToPrismaCreate } from "@/lib/scheduleBlocks";
import { getDefaultStartPointId } from "@/lib/startPoints";
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

  const startPointId = await getDefaultStartPointId(userId);
  const input = await buildSchedulerInput(userId, weekStartDate, startPointId);
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

function describeError(e: unknown): string {
  if (e instanceof Error) {
    const status = (e as { status?: number }).status;
    const type = (e as { type?: string }).type;
    return [e.message, status ? `status=${status}` : null, type ? `type=${type}` : null].filter(Boolean).join(" / ");
  }
  return String(e);
}

/**
 * 週次AIノルマ提案を取得する。既にキャッシュ済みならそれを返し、無ければ実績を集計してClaude APIに提案を生成させる。
 * AI呼び出しに失敗しても例外は投げず、呼び出し元が手動UIに自然にフォールバックできるよう null を返す。
 * error にはデバッグ用の失敗理由（メッセージ）を入れる。
 */
export async function generateAiProposal(weekStartDate: string): Promise<{ proposal: WeeklyProposal | null; error?: string }> {
  const userId = await getCurrentUserId();

  const existing = await prisma.weeklyPlan.findUnique({
    where: { userId_weekStartDate: { userId, weekStartDate: dateStringToDate(weekStartDate) } },
  });
  if (existing?.aiProposalJson) {
    return { proposal: existing.aiProposalJson as unknown as WeeklyProposal };
  }

  try {
    const subjects = await prisma.subject.findMany({ where: { userId } });
    if (subjects.length === 0) return { proposal: null };

    const subjectsMeta = subjects.map((s) => ({ id: s.id, name: s.name, weeklyQuotaMin: s.weeklyQuotaMin, timeSlot: s.timeSlot }));
    const reviewInput = await buildWeeklyReviewInput(userId, weekStartDate);
    // 実績データが1週間も無い初回はAIに判断材料が無いため、AIを呼ばずランダムに初期提案を作成する
    const proposal =
      reviewInput.weeksObserved === 0
        ? generateRandomInitialProposal(subjectsMeta)
        : await generateWeeklyProposal(reviewInput, subjectsMeta);

    await prisma.weeklyPlan.upsert({
      where: { userId_weekStartDate: { userId, weekStartDate: dateStringToDate(weekStartDate) } },
      create: {
        userId,
        weekStartDate: dateStringToDate(weekStartDate),
        priorities: subjects.map((s) => s.id),
        aiProposalJson: proposal as unknown as object,
        aiProposalAt: new Date(),
      },
      update: { aiProposalJson: proposal as unknown as object, aiProposalAt: new Date() },
    });

    revalidatePath("/weekly-plan");
    return { proposal };
  } catch (e) {
    console.error("[generateAiProposal] AI提案の生成に失敗しました", e);
    return { proposal: null, error: describeError(e) };
  }
}

/** AI提案の値をSubjectに反映してから、通常のプラン生成を行う。 */
export async function applyAiProposal(weekStartDate: string, orderedSubjectIds: string[]): Promise<GeneratePlanResult> {
  const userId = await getCurrentUserId();

  const weeklyPlan = await prisma.weeklyPlan.findUnique({
    where: { userId_weekStartDate: { userId, weekStartDate: dateStringToDate(weekStartDate) } },
  });
  const proposal = weeklyPlan?.aiProposalJson as unknown as WeeklyProposal | undefined;

  if (proposal) {
    await Promise.all(
      proposal.subjects.map((s) =>
        prisma.subject.updateMany({
          where: { id: s.subjectId, userId },
          data: {
            weeklyQuotaMin: s.proposedQuotaMin,
            ...(s.timeSlotChange !== "no_change" ? { timeSlot: s.timeSlotChange } : {}),
          },
        }),
      ),
    );
  }

  return generatePlan(weekStartDate, orderedSubjectIds);
}
