import type { PrismaClient } from "@prisma/client";

/** 場所プールとして許容する最低件数（1箇所だとガチャにならないため）。 */
export const MIN_LOCATION_POOL_SIZE = 2;

/**
 * 場所プール(IDの配列)で場所一覧をフィルタする純粋関数。
 * poolIdsが空なら「全場所」を意味する（後方互換のデフォルト）。
 */
export function filterLocationPool<T extends { id: string }>(locations: T[], poolIds: string[]): T[] {
  return poolIds.length > 0 ? locations.filter((l) => poolIds.includes(l.id)) : locations;
}

/**
 * 場所プールのサイズを検証する。登録場所が2件以上あるのにプールが2件未満なら例外を投げる
 * （登録場所が1件しかない等、そもそも選びようがない場合は検証しない）。
 */
export function validateLocationPoolSize(totalLocationCount: number, poolSize: number): void {
  if (totalLocationCount >= MIN_LOCATION_POOL_SIZE && poolSize < MIN_LOCATION_POOL_SIZE) {
    throw new Error(`今週の場所プールは最低${MIN_LOCATION_POOL_SIZE}箇所選んでください（1箇所だとガチャになりません）`);
  }
}

/**
 * その週のWeeklyPlan.locationPoolJsonでフィルタした場所一覧を返す。
 * プール未設定・空配列なら全場所（後方互換のデフォルト）。
 */
export async function filterLocationsByWeeklyPool<T extends { id: string }>(
  prisma: PrismaClient,
  userId: string,
  weekStartDate: Date,
  locations: T[],
): Promise<T[]> {
  const weeklyPlan = await prisma.weeklyPlan.findUnique({
    where: { userId_weekStartDate: { userId, weekStartDate } },
  });
  const pool = Array.isArray(weeklyPlan?.locationPoolJson) ? (weeklyPlan.locationPoolJson as string[]) : [];
  return filterLocationPool(locations, pool);
}
