/** 場所プールとして許容する最低件数（1箇所だとガチャにならないため）。 */
export const MIN_LOCATION_POOL_SIZE = 2;

/** Location.isEnabled が true の場所だけを返す純粋関数。 */
export function filterEnabledLocations<T extends { isEnabled: boolean }>(locations: T[]): T[] {
  return locations.filter((l) => l.isEnabled);
}

/**
 * 有効な場所の件数を検証する。登録場所が2件以上あるのに有効な場所が2件未満なら例外を投げる
 * （登録場所が1件しかない等、そもそも選びようがない場合は検証しない）。
 */
export function validateLocationPoolSize(totalLocationCount: number, enabledLocationCount: number): void {
  if (totalLocationCount >= MIN_LOCATION_POOL_SIZE && enabledLocationCount < MIN_LOCATION_POOL_SIZE) {
    throw new Error(`有効な場所は最低${MIN_LOCATION_POOL_SIZE}箇所にしてください（1箇所だとガチャになりません）`);
  }
}
