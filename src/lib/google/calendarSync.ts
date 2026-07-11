import { createCalendarEvent, deleteCalendarEvent, updateCalendarEvent, type ReminderOverride } from "./calendar";
import { getValidGoogleAccessToken } from "./googleTokens";

const MASK_TITLE = "🎁 スタディミッション";
const STUDY_REMINDER_MIN = 10;

export interface SyncableBlock {
  id: string;
  type: "study" | "move" | "break" | "lunch" | "event";
  startsAt: Date;
  endsAt: Date;
  subjectName?: string | null;
  locationName?: string | null;
  locationAddress?: string | null;
  eventTitle?: string | null;
  gcalEventId?: string | null;
}

/** move ブロックは移動時間そのものなので、カレンダーには同期しない（マスクする意味がないため）。 */
function isSyncable(block: SyncableBlock): boolean {
  return block.type !== "move";
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** 各日の最初のブロック（開封忘れ防止の通知を追加で付ける対象）のIDを求める */
function computeFirstOfDayIds(blocks: SyncableBlock[]): Set<string> {
  const firstByDate = new Map<string, SyncableBlock>();
  for (const b of blocks) {
    if (!isSyncable(b)) continue;
    const key = dateKey(b.startsAt);
    const current = firstByDate.get(key);
    if (!current || b.startsAt.getTime() < current.startsAt.getTime()) {
      firstByDate.set(key, b);
    }
  }
  return new Set(Array.from(firstByDate.values()).map((b) => b.id));
}

function buildReminders(block: SyncableBlock, isFirstOfDay: boolean): ReminderOverride[] {
  const overrides: ReminderOverride[] = [];
  if (block.type === "study") overrides.push({ method: "popup", minutes: STUDY_REMINDER_MIN });
  if (isFirstOfDay) overrides.push({ method: "popup", minutes: 0 });
  return overrides;
}

function buildRealSummary(block: SyncableBlock): string {
  switch (block.type) {
    case "study":
      return `📚 ${block.subjectName ?? "勉強"}${block.locationName ? ` @ ${block.locationName}` : ""}`;
    case "break":
      return "☕ 休憩";
    case "lunch":
      return `🍴 昼食${block.locationName ? ` @ ${block.locationName}` : ""}`;
    case "event":
      return `📅 ${block.eventTitle ?? "予定"}`;
    default:
      return MASK_TITLE;
  }
}

function buildRealLocation(block: SyncableBlock): string | undefined {
  if (block.type === "study" || block.type === "lunch") return block.locationAddress ?? undefined;
  return undefined;
}

/**
 * ブロック群をカレンダーイベントとして新規作成する。
 * revealed=false のブロックはマスクイベント（🎁 スタディミッション）、
 * revealed=true のブロックは実名（科目・場所入り）で作成する
 * （すでに開封済みの当日分を再生成するリロール等で使う）。
 *
 * 戻り値: ブロックID -> Google イベントID（呼び出し側で gcalEventId として保存する）
 */
export async function createCalendarEventsForBlocks(
  userId: string,
  blocks: SyncableBlock[],
  revealedIds: Set<string>,
): Promise<Map<string, string>> {
  const syncable = blocks.filter(isSyncable);
  if (syncable.length === 0) return new Map();

  const accessToken = await getValidGoogleAccessToken(userId);
  const firstOfDayIds = computeFirstOfDayIds(syncable);
  const result = new Map<string, string>();

  for (const block of syncable) {
    const revealed = revealedIds.has(block.id);
    const eventId = await createCalendarEvent(accessToken, {
      summary: revealed ? buildRealSummary(block) : MASK_TITLE,
      location: revealed ? buildRealLocation(block) : undefined,
      startIso: block.startsAt.toISOString(),
      endIso: block.endsAt.toISOString(),
      appBlockId: block.id,
      reminderOverrides: buildReminders(block, firstOfDayIds.has(block.id)),
    });
    result.set(block.id, eventId);
  }

  return result;
}

/**
 * 開封時：既存イベントをマスクから実名（場所・科目入り）に更新する。
 * gcalEventId を持たないブロックはスキップする。
 */
export async function revealCalendarEventsForBlocks(userId: string, blocks: SyncableBlock[]): Promise<void> {
  const syncable = blocks.filter((b) => isSyncable(b) && b.gcalEventId);
  if (syncable.length === 0) return;

  const accessToken = await getValidGoogleAccessToken(userId);
  const firstOfDayIds = computeFirstOfDayIds(blocks.filter(isSyncable));

  for (const block of syncable) {
    await updateCalendarEvent(accessToken, block.gcalEventId!, {
      summary: buildRealSummary(block),
      location: buildRealLocation(block),
      startIso: block.startsAt.toISOString(),
      endIso: block.endsAt.toISOString(),
      appBlockId: block.id,
      reminderOverrides: buildReminders(block, firstOfDayIds.has(block.id)),
    });
  }
}

/** リロール・再計画で不要になった旧イベントを削除する（重複・ゴミイベント防止）。 */
export async function deleteCalendarEventsByIds(userId: string, gcalEventIds: Array<string | null>): Promise<void> {
  const ids = gcalEventIds.filter((id): id is string => Boolean(id));
  if (ids.length === 0) return;

  const accessToken = await getValidGoogleAccessToken(userId);
  for (const id of ids) {
    await deleteCalendarEvent(accessToken, id);
  }
}
