import { isMockGoogleApiEnabled, MOCK_TRAVEL_MINUTES } from "./mock";

export interface RouteEndpoint {
  placeId?: string;
  address?: string;
}

type TravelMode = "TRANSIT" | "WALK";

function toWaypoint(endpoint: RouteEndpoint) {
  if (endpoint.placeId) return { placeId: endpoint.placeId };
  if (endpoint.address) return { address: endpoint.address };
  throw new Error("origin/destination には placeId か address のいずれかが必要です");
}

async function computeRouteMinutes(
  origin: RouteEndpoint,
  destination: RouteEndpoint,
  travelMode: TravelMode,
  apiKey: string,
): Promise<number | null> {
  const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.duration",
    },
    body: JSON.stringify({
      origin: toWaypoint(origin),
      destination: toWaypoint(destination),
      travelMode,
    }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as { routes?: Array<{ duration?: string }> };
  const duration = data.routes?.[0]?.duration;
  if (!duration) return null;

  const seconds = Number.parseInt(duration.replace("s", ""), 10);
  if (Number.isNaN(seconds)) return null;
  return Math.ceil(seconds / 60);
}

/**
 * 2地点間の移動時間（分）を取得する。transit を優先し、取得できなければ walking にフォールバックする。
 * どちらも取得できない場合は例外を投げる（呼び出し側で TravelCache 等へのフォールバックを行う）。
 */
export async function fetchTravelMinutes(
  origin: RouteEndpoint,
  destination: RouteEndpoint,
  apiKey: string | undefined = process.env.GOOGLE_MAPS_API_KEY,
): Promise<number> {
  if (isMockGoogleApiEnabled()) return MOCK_TRAVEL_MINUTES;

  if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY が設定されていません");

  const transit = await computeRouteMinutes(origin, destination, "TRANSIT", apiKey);
  if (transit !== null) return transit;

  const walking = await computeRouteMinutes(origin, destination, "WALK", apiKey);
  if (walking !== null) return walking;

  throw new Error("Routes API からルートを取得できませんでした");
}
