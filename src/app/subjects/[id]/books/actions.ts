"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { extractBookInfo, type BookInfoDraft, type SupportedImageMediaType } from "@/lib/ai/bookVision";

/**
 * 表紙画像をClaude API（vision）に解析させ、下書きを返す。
 * 失敗時は例外を投げず null を返す（呼び出し元でフォームを空のまま手動入力できるようにする）。
 */
export async function scanBookCover(
  imageBase64: string,
  mediaType: SupportedImageMediaType,
): Promise<BookInfoDraft | null> {
  const userId = await getCurrentUserId();
  const subjects = await prisma.subject.findMany({ where: { userId }, select: { id: true, name: true } });

  try {
    return await extractBookInfo(imageBase64, mediaType, subjects);
  } catch (e) {
    console.error("[scanBookCover] AI解析に失敗しました", e);
    return null;
  }
}

export async function createBook(subjectId: string, formData: FormData): Promise<void> {
  const userId = await getCurrentUserId();

  const subject = await prisma.subject.findFirst({ where: { id: subjectId, userId } });
  if (!subject) throw new Error("科目が見つかりません");

  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("タイトルを入力してください");

  const publisher = String(formData.get("publisher") ?? "").trim() || null;
  const totalPagesRaw = String(formData.get("totalPages") ?? "").trim();
  const totalPages = totalPagesRaw ? Number(totalPagesRaw) : null;
  const coverImageUrl = String(formData.get("coverImageUrl") ?? "").trim() || null;

  await prisma.book.create({
    data: {
      userId,
      subjectId,
      title,
      publisher,
      totalPages: totalPages && Number.isFinite(totalPages) ? totalPages : null,
      coverImageUrl,
    },
  });

  revalidatePath(`/subjects/${subjectId}/books`);
}

export async function deleteBook(bookId: string, subjectId: string): Promise<void> {
  const userId = await getCurrentUserId();
  await prisma.book.deleteMany({ where: { id: bookId, userId } });
  revalidatePath(`/subjects/${subjectId}/books`);
}
