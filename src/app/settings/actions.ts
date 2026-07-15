"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/currentUser";
import { resolveAddressLocation } from "@/lib/google/places";
import { prisma } from "@/lib/prisma";

export async function saveSettings(formData: FormData): Promise<void> {
  const userId = await getCurrentUserId();

  const homeAddress = String(formData.get("homeAddress") ?? "").trim();
  const wakeWeekday = String(formData.get("wakeWeekday") ?? "08:00");
  const wakeWeekend = String(formData.get("wakeWeekend") ?? "09:00");
  const morningEnd = String(formData.get("morningEnd") ?? "12:00");
  const outsideEnd = String(formData.get("outsideEnd") ?? "21:00");

  const existing = await prisma.settings.findUnique({ where: { userId } });

  // 緯度経度は住所から自動推測する（ユーザーに厳密な数値入力を求めない）。
  // 住所が変わっていない、かつ既に解決済みならAPIを呼び直さない。
  let homeLat = existing?.homeLat ?? null;
  let homeLng = existing?.homeLng ?? null;

  if (!homeAddress) {
    homeLat = null;
    homeLng = null;
  } else if (homeAddress !== existing?.homeAddress || homeLat === null || homeLng === null) {
    try {
      const location = await resolveAddressLocation(homeAddress);
      homeLat = location?.lat ?? null;
      homeLng = location?.lng ?? null;
    } catch (e) {
      console.error("[saveSettings] 自宅住所からの座標推測に失敗しました。天気機能は無効のまま保存します", e);
      homeLat = null;
      homeLng = null;
    }
  }

  await prisma.settings.upsert({
    where: { userId },
    create: { userId, homeAddress, homeLat, homeLng, wakeWeekday, wakeWeekend, morningEnd, outsideEnd },
    update: { homeAddress, homeLat, homeLng, wakeWeekday, wakeWeekend, morningEnd, outsideEnd },
  });

  revalidatePath("/settings");
}
