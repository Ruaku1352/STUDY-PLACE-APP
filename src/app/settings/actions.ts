"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

function parseOptionalFloat(value: FormDataEntryValue | null): number | null {
  if (value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function saveSettings(formData: FormData): Promise<void> {
  const userId = await getCurrentUserId();

  const homeAddress = String(formData.get("homeAddress") ?? "").trim();
  const homeLat = parseOptionalFloat(formData.get("homeLat"));
  const homeLng = parseOptionalFloat(formData.get("homeLng"));
  const wakeWeekday = String(formData.get("wakeWeekday") ?? "08:00");
  const wakeWeekend = String(formData.get("wakeWeekend") ?? "09:00");
  const morningEnd = String(formData.get("morningEnd") ?? "12:00");
  const outsideEnd = String(formData.get("outsideEnd") ?? "21:00");

  await prisma.settings.upsert({
    where: { userId },
    create: { userId, homeAddress, homeLat, homeLng, wakeWeekday, wakeWeekend, morningEnd, outsideEnd },
    update: { homeAddress, homeLat, homeLng, wakeWeekday, wakeWeekend, morningEnd, outsideEnd },
  });

  revalidatePath("/settings");
}
