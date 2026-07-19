import type { Prisma, PrismaClient } from "@prisma/client";
import { computeBlockXp, isDayFullyComplete, XP_ALL_BLOCKS_COMPLETE_BONUS } from "./block";
import { levelInfoFromTotalXp } from "./level";

export interface XpUpdateResult {
  xpGained: number;
  totalXp: number;
  leveledUp: boolean;
  newLevel: number;
}

type Tx = Prisma.TransactionClient;

async function upsertTotalXp(tx: Tx, userId: string, delta: number): Promise<number> {
  const updated = await tx.userProgress.upsert({
    where: { userId },
    create: { userId, totalXp: Math.max(0, delta) },
    update: { totalXp: { increment: delta } },
  });
  return updated.totalXp;
}

/**
 * その日の「全ブロック完了」ボーナス（+50）を再判定し、必要なら付与・取り消しする。差分を返す。
 * excludeBlockIdを渡すと、そのブロックを集計対象から除外して判定する（削除処理の直前に使う）。
 */
async function reconcileDayCompletionBonus(tx: Tx, userId: string, date: Date, excludeBlockId?: string): Promise<number> {
  const dayState = await tx.dayState.findUnique({ where: { userId_date: { userId, date } } });
  if (!dayState) return 0;

  const studyBlocks = await tx.scheduleBlock.findMany({
    where: { userId, date, type: "study", ...(excludeBlockId ? { id: { not: excludeBlockId } } : {}) },
    select: { status: true },
  });
  const allComplete = isDayFullyComplete(studyBlocks.map((b) => b.status));

  if (allComplete && !dayState.allBlocksBonusGranted) {
    await tx.dayState.update({ where: { id: dayState.id }, data: { allBlocksBonusGranted: true } });
    return XP_ALL_BLOCKS_COMPLETE_BONUS;
  }
  if (!allComplete && dayState.allBlocksBonusGranted) {
    await tx.dayState.update({ where: { id: dayState.id }, data: { allBlocksBonusGranted: false } });
    return -XP_ALL_BLOCKS_COMPLETE_BONUS;
  }
  return 0;
}

function noChangeResult(totalXp: number): XpUpdateResult {
  const info = levelInfoFromTotalXp(totalXp);
  return { xpGained: 0, totalXp, leveledUp: false, newLevel: info.level };
}

/**
 * ブロックの実績記録（完了/一部完了/未実施）に応じてXPを付与・減算する。
 * ブロック自身のXP（分数+完了ボーナス+初めての場所ボーナス）と、その日の全ブロック完了ボーナスを
 * 単一のインタラクティブトランザクション内で再計算し、差分だけをUserProgress.totalXpに反映する。
 */
export async function applyXpForBlockStatusUpdate(
  prisma: PrismaClient,
  userId: string,
  blockId: string,
  newStatus: "done" | "partial" | "skipped",
  newActualMin: number,
): Promise<XpUpdateResult> {
  return prisma.$transaction(async (tx) => {
    const block = await tx.scheduleBlock.findFirst({ where: { id: blockId, userId } });
    if (!block) {
      const current = await tx.userProgress.findUnique({ where: { userId } });
      return noChangeResult(current?.totalXp ?? 0);
    }

    const isFirstAtLocation =
      (newStatus === "done" || newStatus === "partial") && block.locationId
        ? !(await tx.scheduleBlock.findFirst({
            where: {
              userId,
              locationId: block.locationId,
              id: { not: block.id },
              status: { in: ["done", "partial"] },
            },
            select: { id: true },
          }))
        : false;

    const newXpAwarded = computeBlockXp({ status: newStatus, actualMin: newActualMin, isFirstAtLocation });
    const blockDelta = newXpAwarded - block.xpAwarded;

    await tx.scheduleBlock.update({
      where: { id: blockId },
      data: { status: newStatus, actualMin: newActualMin, xpAwarded: newXpAwarded },
    });

    const dayBonusDelta = await reconcileDayCompletionBonus(tx, userId, block.date);

    const before = await tx.userProgress.findUnique({ where: { userId } });
    const oldTotalXp = before?.totalXp ?? 0;
    const totalDelta = blockDelta + dayBonusDelta;
    const newTotalXp = await upsertTotalXp(tx, userId, totalDelta);

    const oldLevel = levelInfoFromTotalXp(oldTotalXp).level;
    const newLevel = levelInfoFromTotalXp(newTotalXp).level;

    return { xpGained: totalDelta, totalXp: newTotalXp, leveledUp: newLevel > oldLevel, newLevel };
  });
}

/** 手動編集モードでブロックを削除する際、そのブロックに付与済みのXPを取り消す。日の完了ボーナスも再判定する。 */
export async function reverseXpForBlockDeletion(
  prisma: PrismaClient,
  userId: string,
  block: { id: string; date: Date; xpAwarded: number },
): Promise<void> {
  if (block.xpAwarded === 0) return;

  await prisma.$transaction(async (tx) => {
    // 削除処理自体はこの後に呼び出し元が行うため、ここでは削除対象を明示的に除いて判定する。
    const dayBonusDelta = await reconcileDayCompletionBonus(tx, userId, block.date, block.id);
    await upsertTotalXp(tx, userId, -block.xpAwarded + dayBonusDelta);
  });
}
