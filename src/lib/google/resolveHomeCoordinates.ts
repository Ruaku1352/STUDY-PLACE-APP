import type { PrismaClient } from "@prisma/client";
import { resolveAddressLocation, type LatLng } from "./places";

/**
 * Settings.homeLat/homeLngが未解決なら、住所から自動推測してDBに保存する（次回以降はAPIを呼ばない）。
 * 既に解決済みならそのまま返す。住所未設定・解決失敗時はnullを返し、呼び出し側は
 * 天気なしの通常フローで続行する。
 *
 * homeAddress保存時（settings/actions.ts）だけでなく、開封時にもここを通すことで、
 * この機能追加より前から住所を設定済みだったユーザーでも、設定画面を開き直さずに
 * 次の開封から自動で天気が使えるようになる。
 */
export async function resolveHomeCoordinates(params: {
  prisma: PrismaClient;
  userId: string;
  homeAddress: string;
  homeLat: number | null;
  homeLng: number | null;
}): Promise<LatLng | null> {
  const { prisma, userId, homeAddress, homeLat, homeLng } = params;
  if (homeLat !== null && homeLng !== null) return { lat: homeLat, lng: homeLng };
  if (!homeAddress) return null;

  try {
    const location = await resolveAddressLocation(homeAddress);
    if (!location) return null;
    await prisma.settings.update({ where: { userId }, data: { homeLat: location.lat, homeLng: location.lng } });
    return location;
  } catch (e) {
    console.error("[resolveHomeCoordinates] 自宅住所からの座標推測に失敗しました", e);
    return null;
  }
}
