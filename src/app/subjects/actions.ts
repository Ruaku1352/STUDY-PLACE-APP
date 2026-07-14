"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

function parseTimeSlot(value: FormDataEntryValue | null): "morning" | "anytime" {
  return value === "morning" ? "morning" : "anytime";
}

function parseWeeklyQuotaMin(formData: FormData): number {
  const hours = Number(formData.get("weeklyQuotaHours") ?? 0);
  const minutes = Number(formData.get("weeklyQuotaMinutes") ?? 0);
  return hours * 60 + minutes;
}

export async function createSubject(formData: FormData): Promise<void> {
  const userId = await getCurrentUserId();

  const name = String(formData.get("name") ?? "").trim();
  const weeklyQuotaMin = parseWeeklyQuotaMin(formData);
  const timeSlot = parseTimeSlot(formData.get("timeSlot"));

  if (!name || !Number.isFinite(weeklyQuotaMin) || weeklyQuotaMin <= 0) {
    throw new Error("科目名と正しい週間ノルマ（時間・分）を入力してください");
  }

  await prisma.subject.create({
    data: { userId, name, weeklyQuotaMin, timeSlot },
  });

  revalidatePath("/subjects");
}

export async function updateSubject(subjectId: string, formData: FormData): Promise<void> {
  const userId = await getCurrentUserId();

  const name = String(formData.get("name") ?? "").trim();
  const weeklyQuotaMin = parseWeeklyQuotaMin(formData);
  const timeSlot = parseTimeSlot(formData.get("timeSlot"));

  if (!name || !Number.isFinite(weeklyQuotaMin) || weeklyQuotaMin <= 0) {
    throw new Error("科目名と正しい週間ノルマ（時間・分）を入力してください");
  }

  await prisma.subject.updateMany({
    where: { id: subjectId, userId },
    data: { name, weeklyQuotaMin, timeSlot },
  });

  revalidatePath("/subjects");
  redirect("/subjects");
}

export async function deleteSubject(subjectId: string): Promise<void> {
  const userId = await getCurrentUserId();
  await prisma.subject.deleteMany({ where: { id: subjectId, userId } });
  revalidatePath("/subjects");
  redirect("/subjects");
}
