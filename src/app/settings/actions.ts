"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

export async function saveSettings(formData: FormData): Promise<void> {
  const userId = await getCurrentUserId();

  const wakeWeekday = String(formData.get("wakeWeekday") ?? "08:00");
  const wakeWeekend = String(formData.get("wakeWeekend") ?? "09:00");
  const morningEnd = String(formData.get("morningEnd") ?? "12:00");
  const outsideEnd = String(formData.get("outsideEnd") ?? "21:00");

  await prisma.settings.upsert({
    where: { userId },
    create: { userId, wakeWeekday, wakeWeekend, morningEnd, outsideEnd },
    update: { wakeWeekday, wakeWeekend, morningEnd, outsideEnd },
  });

  revalidatePath("/settings");
}
