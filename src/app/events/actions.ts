"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { combineDateAndTime } from "@/lib/date";
import { getCurrentUserId } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

function parseKind(value: FormDataEntryValue | null): "school" | "work" | "other" {
  if (value === "school" || value === "work") return value;
  return "other";
}

function readEventFields(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");
  const locationId = String(formData.get("locationId") ?? "") || null;
  const kind = parseKind(formData.get("kind"));

  if (!title || !date || !startTime || !endTime) {
    throw new Error("タイトル・日付・開始/終了時刻を入力してください");
  }

  return {
    title,
    startsAt: combineDateAndTime(date, startTime),
    endsAt: combineDateAndTime(date, endTime),
    locationId,
    kind,
  };
}

export async function createEvent(formData: FormData): Promise<void> {
  const userId = await getCurrentUserId();
  const fields = readEventFields(formData);

  await prisma.fixedEvent.create({
    data: { userId, ...fields },
  });

  revalidatePath("/events");
}

export async function updateEvent(eventId: string, formData: FormData): Promise<void> {
  const userId = await getCurrentUserId();
  const fields = readEventFields(formData);

  await prisma.fixedEvent.updateMany({
    where: { id: eventId, userId },
    data: fields,
  });

  revalidatePath("/events");
  redirect("/events");
}

export async function deleteEvent(eventId: string): Promise<void> {
  const userId = await getCurrentUserId();
  await prisma.fixedEvent.deleteMany({ where: { id: eventId, userId } });
  revalidatePath("/events");
  redirect("/events");
}
