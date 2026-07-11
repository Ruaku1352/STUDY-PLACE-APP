import { isMockGoogleApiEnabled } from "./mock";

const CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export interface ReminderOverride {
  method: "popup";
  minutes: number;
}

export interface CalendarEventInput {
  summary: string;
  description?: string;
  location?: string;
  /** ISO 8601 (例: startsAt.toISOString()) */
  startIso: string;
  endIso: string;
  appBlockId: string;
  reminderOverrides: ReminderOverride[];
}

function toGoogleEventBody(event: CalendarEventInput) {
  return {
    summary: event.summary,
    description: event.description,
    location: event.location,
    start: { dateTime: event.startIso },
    end: { dateTime: event.endIso },
    extendedProperties: { private: { appBlockId: event.appBlockId } },
    reminders: { useDefault: false, overrides: event.reminderOverrides },
  };
}

export async function createCalendarEvent(accessToken: string, event: CalendarEventInput): Promise<string> {
  if (isMockGoogleApiEnabled()) {
    return `mock-event-${event.appBlockId}`;
  }

  const res = await fetch(CALENDAR_EVENTS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(toGoogleEventBody(event)),
  });
  if (!res.ok) {
    throw new Error(`Googleカレンダーへのイベント作成に失敗しました: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  event: CalendarEventInput,
): Promise<void> {
  if (isMockGoogleApiEnabled()) return;

  const res = await fetch(`${CALENDAR_EVENTS_URL}/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(toGoogleEventBody(event)),
  });
  if (!res.ok) {
    throw new Error(`Googleカレンダーのイベント更新に失敗しました: ${res.status} ${await res.text()}`);
  }
}

export async function deleteCalendarEvent(accessToken: string, eventId: string): Promise<void> {
  if (isMockGoogleApiEnabled()) return;

  const res = await fetch(`${CALENDAR_EVENTS_URL}/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  // 404/410 はすでに削除済み・存在しない場合なので成功扱い（ゴミイベントの二重削除を許容する）
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Googleカレンダーのイベント削除に失敗しました: ${res.status} ${await res.text()}`);
  }
}
