"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/currentUser";
import { fetchOpeningHours, resolvePlaceId, type PlacesWeeklyHours } from "@/lib/google/places";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const WEEKDAY_KEYS = [0, 1, 2, 3, 4, 5, 6] as const;

function parseKind(value: FormDataEntryValue | null): "library" | "cafe" | "other" {
  if (value === "library" || value === "cafe") return value;
  return "other";
}

function parseOptionalInt(value: FormDataEntryValue | null): number | undefined {
  if (value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseManualHours(formData: FormData): PlacesWeeklyHours | null {
  const hours: PlacesWeeklyHours = {};
  let any = false;
  for (const day of WEEKDAY_KEYS) {
    const open = String(formData.get(`manualOpen${day}`) ?? "").trim();
    const close = String(formData.get(`manualClose${day}`) ?? "").trim();
    if (open && close) {
      hours[day] = { open, close };
      any = true;
    }
  }
  return any ? hours : null;
}

export async function createLocation(formData: FormData): Promise<void> {
  const userId = await getCurrentUserId();

  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const kind = parseKind(formData.get("kind"));
  const maxStayMin = parseOptionalInt(formData.get("maxStayMin"));
  const manualTravelMin = parseOptionalInt(formData.get("manualTravelMin"));

  if (!name || !address) {
    throw new Error("場所名と住所を入力してください");
  }

  await prisma.location.create({
    data: { userId, name, address, kind, maxStayMin, manualTravelMin },
  });

  revalidatePath("/locations");
}

export async function updateLocation(locationId: string, formData: FormData): Promise<void> {
  const userId = await getCurrentUserId();

  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const kind = parseKind(formData.get("kind"));
  const maxStayMin = parseOptionalInt(formData.get("maxStayMin"));
  const manualTravelMin = parseOptionalInt(formData.get("manualTravelMin"));
  const manualHoursJson = parseManualHours(formData);

  if (!name || !address) {
    throw new Error("場所名と住所を入力してください");
  }

  await prisma.location.updateMany({
    where: { id: locationId, userId },
    data: {
      name,
      address,
      kind,
      maxStayMin,
      manualTravelMin,
      manualHoursJson: manualHoursJson === null ? Prisma.JsonNull : (manualHoursJson as Prisma.InputJsonValue),
    },
  });

  revalidatePath("/locations");
  redirect(`/locations/${locationId}/edit`);
}

export async function deleteLocation(locationId: string): Promise<void> {
  const userId = await getCurrentUserId();
  await prisma.location.deleteMany({ where: { id: locationId, userId } });
  revalidatePath("/locations");
  redirect("/locations");
}

/** 今週以降のガチャの抽選対象に含めるかどうかを切り替える。 */
export async function setLocationEnabled(locationId: string, isEnabled: boolean): Promise<void> {
  const userId = await getCurrentUserId();
  await prisma.location.updateMany({ where: { id: locationId, userId }, data: { isEnabled } });
  revalidatePath("/locations");
  revalidatePath("/weekly-plan");
}

export async function resolveLocationHours(locationId: string): Promise<void> {
  const userId = await getCurrentUserId();
  const loc = await prisma.location.findFirst({ where: { id: locationId, userId } });
  if (!loc) redirect("/locations");

  let placeId = loc.placeId;
  let errorMessage: string | null = null;

  if (!placeId) {
    try {
      placeId = await resolvePlaceId(loc.address);
    } catch {
      placeId = null;
    }
    if (!placeId) {
      errorMessage = "住所からPlace IDを解決できませんでした。手動で営業時間を入力してください。";
    }
  }

  if (placeId && !errorMessage) {
    let hours: PlacesWeeklyHours | null = null;
    try {
      hours = await fetchOpeningHours(placeId);
    } catch {
      hours = null;
    }
    if (hours) {
      await prisma.location.updateMany({
        where: { id: locationId, userId },
        data: { placeId, openingHoursJson: hours as Prisma.InputJsonValue, openingHoursFetchedAt: new Date() },
      });
    } else {
      await prisma.location.updateMany({ where: { id: locationId, userId }, data: { placeId } });
      errorMessage = "営業時間を取得できませんでした。手動で入力してください。";
    }
  }

  revalidatePath(`/locations/${locationId}/edit`);
  redirect(`/locations/${locationId}/edit${errorMessage ? `?hoursError=${encodeURIComponent(errorMessage)}` : ""}`);
}
