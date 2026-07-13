import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { calcBookProgress } from "@/lib/books";
import { createBook, deleteBook, scanBookCover } from "./actions";
import { AddBookForm } from "./AddBookForm";

// 表紙vision解析（Claude API呼び出し）がVercelのデフォルト実行時間上限（10秒）を
// 超えてタイムアウトすることがあるため、上限を延長する（Hobbyプランの上限=60秒）。
export const maxDuration = 60;

export default async function SubjectBooksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();

  const subject = await prisma.subject.findFirst({ where: { id, userId } });
  if (!subject) notFound();

  const books = await prisma.book.findMany({
    where: { subjectId: subject.id, userId },
    include: { readingLogs: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <h1>{subject.name}の参考書</h1>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        <Link href={`/subjects/${subject.id}/edit`}>← 科目編集に戻る</Link>
      </p>

      <div className="card-list" style={{ marginBottom: "1.5rem" }}>
        {books.length === 0 && <p className="muted">まだ参考書が登録されていません。</p>}
        {books.map((b) => {
          const maxPageRead = b.readingLogs.reduce((max, l) => Math.max(max, l.toPage), 0);
          const { percent, completed } = calcBookProgress(b.totalPages, maxPageRead);
          return (
            <div key={b.id} className="list-item">
              <div className="list-item-main">
                <span className="list-item-title">
                  {completed ? "📕 " : ""}
                  {b.title}
                </span>
                <span className="list-item-sub">
                  {b.publisher ?? "出版社不明"} ・ {b.totalPages ? `${maxPageRead}/${b.totalPages}ページ（${percent}%）` : "総ページ数未設定"}
                </span>
                <div style={{ background: "var(--border, #ddd)", borderRadius: "999px", height: "6px", marginTop: "0.3rem" }}>
                  <div
                    style={{
                      width: `${percent}%`,
                      background: completed ? "#2e7d32" : "#3b6fd6",
                      height: "100%",
                      borderRadius: "999px",
                    }}
                  />
                </div>
              </div>
              <form action={deleteBook.bind(null, b.id, subject.id)}>
                <button type="submit" className="button-danger">
                  削除
                </button>
              </form>
            </div>
          );
        })}
      </div>

      <h2>参考書を追加</h2>
      <AddBookForm subjectId={subject.id} scanBookCoverAction={scanBookCover} createBookAction={createBook} />
    </div>
  );
}
