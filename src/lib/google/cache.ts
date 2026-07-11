import type { PlacesWeeklyHours } from "./places";

export const CACHE_TTL_DAYS = 30;

export function isFresh(fetchedAt: Date, now: Date = new Date()): boolean {
  const ageMs = now.getTime() - fetchedAt.getTime();
  return ageMs < CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
}

export interface TravelCacheStore {
  find(userId: string, fromKey: string, toKey: string): Promise<{ minutes: number; fetchedAt: Date } | null>;
  upsert(userId: string, fromKey: string, toKey: string, minutes: number): Promise<void>;
}

export type TravelSource = "cache" | "api" | "stale-cache" | "manual";

export interface TravelResult {
  minutes: number;
  source: TravelSource;
}

/**
 * 移動時間をキャッシュ経由で取得する。
 * 優先順位: 有効なキャッシュ → Routes API（成功したらキャッシュ更新） → 期限切れキャッシュ → 手動入力値 → null
 */
export async function getTravelMinutes(params: {
  store: TravelCacheStore;
  userId: string;
  fromKey: string;
  toKey: string;
  fetchFn: () => Promise<number>;
  manualFallbackMin?: number;
  now?: Date;
}): Promise<TravelResult | null> {
  const { store, userId, fromKey, toKey, fetchFn, manualFallbackMin, now = new Date() } = params;

  const cached = await store.find(userId, fromKey, toKey);
  if (cached && isFresh(cached.fetchedAt, now)) {
    return { minutes: cached.minutes, source: "cache" };
  }

  try {
    const minutes = await fetchFn();
    await store.upsert(userId, fromKey, toKey, minutes);
    return { minutes, source: "api" };
  } catch {
    if (cached) return { minutes: cached.minutes, source: "stale-cache" };
    if (manualFallbackMin !== undefined) return { minutes: manualFallbackMin, source: "manual" };
    return null;
  }
}

export interface OpeningHoursStore {
  find(userId: string, locationId: string): Promise<{ hours: PlacesWeeklyHours; fetchedAt: Date } | null>;
  save(userId: string, locationId: string, hours: PlacesWeeklyHours): Promise<void>;
}

export type OpeningHoursSource = "cache" | "api" | "stale-cache" | "manual";

export interface OpeningHoursResult {
  hours: PlacesWeeklyHours;
  source: OpeningHoursSource;
}

/**
 * 営業時間をキャッシュ経由で取得する。
 * 優先順位: 有効なキャッシュ → Places API（成功したらキャッシュ更新） → 期限切れキャッシュ → manualHoursJson → null
 */
export async function getOpeningHours(params: {
  store: OpeningHoursStore;
  userId: string;
  locationId: string;
  fetchFn: () => Promise<PlacesWeeklyHours | null>;
  manualFallback?: PlacesWeeklyHours;
  now?: Date;
}): Promise<OpeningHoursResult | null> {
  const { store, userId, locationId, fetchFn, manualFallback, now = new Date() } = params;

  const cached = await store.find(userId, locationId);
  if (cached && isFresh(cached.fetchedAt, now)) {
    return { hours: cached.hours, source: "cache" };
  }

  try {
    const hours = await fetchFn();
    if (!hours) throw new Error("営業時間を取得できませんでした");
    await store.save(userId, locationId, hours);
    return { hours, source: "api" };
  } catch {
    if (cached) return { hours: cached.hours, source: "stale-cache" };
    if (manualFallback) return { hours: manualFallback, source: "manual" };
    return null;
  }
}
