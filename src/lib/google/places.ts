import { isMockGoogleApiEnabled, MOCK_CLOSE_TIME, MOCK_OPEN_TIME } from "./mock";

export interface OpeningHoursRange {
  open: string; // "HH:MM"
  close: string; // "HH:MM"
}

/** キー: 0=Mon..6=Sun（scheduler の WeeklyOpeningHours と同じ形） */
export type PlacesWeeklyHours = Partial<Record<number, OpeningHoursRange>>;

interface GooglePeriodPoint {
  day: number; // 0=Sun..6=Sat
  hour: number;
  minute: number;
}

interface GooglePeriod {
  open: GooglePeriodPoint;
  close?: GooglePeriodPoint;
}

function googleDayToOurs(googleDay: number): number {
  // Google: 0=Sun..6=Sat -> このアプリ: 0=Mon..6=Sun
  return (googleDay + 6) % 7;
}

function toHHMM(point: GooglePeriodPoint): string {
  return `${point.hour.toString().padStart(2, "0")}:${point.minute.toString().padStart(2, "0")}`;
}

function parsePeriods(periods: GooglePeriod[]): PlacesWeeklyHours {
  const hours: PlacesWeeklyHours = {};
  for (const p of periods) {
    if (!p.close) continue; // 24時間営業などは Phase 2 の対象外（手動入力で対応）
    hours[googleDayToOurs(p.open.day)] = {
      open: toHHMM(p.open),
      close: toHHMM(p.close),
    };
  }
  return hours;
}

/** 住所からGoogle Place IDを解決する（Places API (New): Text Search）。見つからなければ null。 */
export async function resolvePlaceId(
  address: string,
  apiKey: string | undefined = process.env.GOOGLE_MAPS_API_KEY,
): Promise<string | null> {
  if (isMockGoogleApiEnabled()) return `mock-place:${address}`;

  if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY が設定されていません");

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id",
    },
    body: JSON.stringify({ textQuery: address }),
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { places?: Array<{ id?: string }> };
  return data.places?.[0]?.id ?? null;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * 住所から緯度経度を解決する（Places API (New): Text Search）。
 * 天気予報(Open-Meteo)の取得地点を、ユーザーに緯度経度の入力を求めず住所から自動推測するために使う。
 * 見つからなければ null。
 */
export async function resolveAddressLocation(
  address: string,
  apiKey: string | undefined = process.env.GOOGLE_MAPS_API_KEY,
): Promise<LatLng | null> {
  if (isMockGoogleApiEnabled()) return { lat: 35.6595, lng: 139.7005 }; // mock: 東京駅付近

  if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY が設定されていません");

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.location",
    },
    body: JSON.stringify({ textQuery: address }),
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { places?: Array<{ location?: { latitude?: number; longitude?: number } }> };
  const location = data.places?.[0]?.location;
  if (location?.latitude === undefined || location?.longitude === undefined) return null;

  return { lat: location.latitude, lng: location.longitude };
}

/** placeId から営業時間を取得する（Places API (New): Place Details）。取得できなければ null。 */
export async function fetchOpeningHours(
  placeId: string,
  apiKey: string | undefined = process.env.GOOGLE_MAPS_API_KEY,
): Promise<PlacesWeeklyHours | null> {
  if (isMockGoogleApiEnabled()) {
    const hours: PlacesWeeklyHours = {};
    for (let day = 0; day <= 6; day++) hours[day] = { open: MOCK_OPEN_TIME, close: MOCK_CLOSE_TIME };
    return hours;
  }

  if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY が設定されていません");

  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "regularOpeningHours",
    },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { regularOpeningHours?: { periods?: GooglePeriod[] } };
  const periods = data.regularOpeningHours?.periods;
  if (!periods) return null;

  return parsePeriods(periods);
}
