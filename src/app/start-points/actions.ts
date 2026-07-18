"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/currentUser";
import { resolveAddressLocation } from "@/lib/google/places";
import { prisma } from "@/lib/prisma";

async function geocodeOrNull(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    return await resolveAddressLocation(address);
  } catch (e) {
    console.error("[start-points] 住所からの座標推測に失敗しました", e);
    return null;
  }
}

export async function createStartPoint(formData: FormData): Promise<void> {
  const userId = await getCurrentUserId();

  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  if (!name || !address) {
    throw new Error("名前と住所を入力してください");
  }

  const location = await geocodeOrNull(address);
  const existingCount = await prisma.startPoint.count({ where: { userId } });

  await prisma.startPoint.create({
    data: {
      userId,
      name,
      address,
      lat: location?.lat ?? null,
      lng: location?.lng ?? null,
      // 最初の1件は自動的にデフォルトにする（未登録ユーザーが必ず1件は持てるようにする）
      isDefault: existingCount === 0,
    },
  });

  revalidatePath("/start-points");
}

export async function updateStartPoint(startPointId: string, formData: FormData): Promise<void> {
  const userId = await getCurrentUserId();
  const existing = await prisma.startPoint.findFirst({ where: { id: startPointId, userId } });
  if (!existing) return;

  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  if (!name || !address) {
    throw new Error("名前と住所を入力してください");
  }

  let lat = existing.lat;
  let lng = existing.lng;
  // 住所が変わっていない、かつ既に解決済みならAPIを呼び直さない
  if (address !== existing.address || lat === null || lng === null) {
    const location = await geocodeOrNull(address);
    lat = location?.lat ?? null;
    lng = location?.lng ?? null;
  }

  await prisma.startPoint.updateMany({
    where: { id: startPointId, userId },
    data: { name, address, lat, lng },
  });

  revalidatePath("/start-points");
  redirect(`/start-points/${startPointId}/edit`);
}

export async function setDefaultStartPoint(startPointId: string): Promise<void> {
  const userId = await getCurrentUserId();
  const target = await prisma.startPoint.findFirst({ where: { id: startPointId, userId } });
  if (!target) return;

  await prisma.$transaction([
    prisma.startPoint.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } }),
    prisma.startPoint.update({ where: { id: startPointId }, data: { isDefault: true } }),
  ]);

  revalidatePath("/start-points");
  redirect(`/start-points/${startPointId}/edit`);
}

export async function deleteStartPoint(startPointId: string): Promise<void> {
  const userId = await getCurrentUserId();
  const target = await prisma.startPoint.findFirst({ where: { id: startPointId, userId } });
  if (!target) return;
  if (target.isDefault) {
    redirect(
      `/start-points/${startPointId}/edit?deleteError=${encodeURIComponent(
        "基準の出発地点は削除できません。先に他の出発地点を基準にしてください。",
      )}`,
    );
  }

  await prisma.startPoint.deleteMany({ where: { id: startPointId, userId } });
  revalidatePath("/start-points");
  redirect("/start-points");
}
