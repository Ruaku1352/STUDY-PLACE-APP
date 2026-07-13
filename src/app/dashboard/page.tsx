import { combineDateAndTime, dateStringToDate, todayDateString } from "@/lib/date";
import { getCurrentUserId } from "@/lib/currentUser";
import { calcBookProgress } from "@/lib/books";
import { prisma } from "@/lib/prisma";
import { addDaysToDate, weekdayIndex } from "@/lib/scheduler/time";
import { ProgressChart, type SubjectProgress } from "./ProgressChart";

export default async function DashboardPage() {
  const userId = await getCurrentUserId();

  const today = todayDateString();
  const weekStartDate = addDaysToDate(today, -weekdayIndex(today));
  const weekEndDate = addDaysToDate(weekStartDate, 6);

  const [subjects, studyBlocks, books, streak] = await Promise.all([
    prisma.subject.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.scheduleBlock.findMany({
      where: {
        userId,
        type: "study",
        date: { gte: dateStringToDate(weekStartDate), lte: combineDateAndTime(weekEndDate, "23:59") },
      },
    }),
    prisma.book.findMany({ where: { userId }, include: { readingLogs: true }, orderBy: { createdAt: "asc" } }),
    prisma.streak.findUnique({ where: { userId } }),
  ]);

  const idealPacePercent = Math.round(((weekdayIndex(today) + 1) / 7) * 100);

  const data: SubjectProgress[] = subjects.map((s) => {
    const actualMin = studyBlocks
      .filter((b) => b.subjectId === s.id && (b.status === "done" || b.status === "partial"))
      .reduce((sum, b) => sum + (b.actualMin ?? 0), 0);
    const percent = s.weeklyQuotaMin > 0 ? Math.round((actualMin / s.weeklyQuotaMin) * 100) : 0;

    return {
      subjectId: s.id,
      name: s.name,
      quotaMin: s.weeklyQuotaMin,
      actualMin,
      percent,
      status: percent >= idealPacePercent ? "good" : "critical",
    };
  });

  return (
    <div>
      <h1>進捗ダッシュボード</h1>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        今週 {weekStartDate} 〜 {weekEndDate}（理想ペース: {idealPacePercent}%）
      </p>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        🔥 現在 {streak?.currentCount ?? 0}日 ・ 最長記録 {streak?.longestCount ?? 0}日
      </p>

      {data.length === 0 ? (
        <p className="muted">まだ科目が登録されていません。</p>
      ) : (
        <div className="card">
          <ProgressChart data={data} idealPacePercent={idealPacePercent} />
        </div>
      )}

      {books.length > 0 && (
        <div className="card" style={{ marginTop: "1.5rem" }}>
          <h2 style={{ marginTop: 0 }}>参考書の進捗</h2>
          <div className="card-list">
            {books
              .filter((b) => !b.completedAt)
              .map((b) => {
                const maxPageRead = b.readingLogs.reduce((max, l) => Math.max(max, l.toPage), 0);
                const { percent } = calcBookProgress(b.totalPages, maxPageRead);
                return (
                  <div key={b.id} className="list-item">
                    <div className="list-item-main">
                      <span className="list-item-title">{b.title}</span>
                      <span className="list-item-sub">
                        {b.totalPages ? `${maxPageRead}/${b.totalPages}ページ（${percent}%）` : "総ページ数未設定"}
                      </span>
                      <div style={{ background: "var(--border, #ddd)", borderRadius: "999px", height: "6px", marginTop: "0.3rem" }}>
                        <div style={{ width: `${percent}%`, background: "#3b6fd6", height: "100%", borderRadius: "999px" }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            {books.every((b) => b.completedAt) && <p className="muted">読書中の参考書はありません。</p>}
          </div>

          {books.some((b) => b.completedAt) && (
            <>
              <h2>📚 本棚（制覇した参考書）</h2>
              <div className="card-list">
                {books
                  .filter((b) => b.completedAt)
                  .map((b) => (
                    <div key={b.id} className="list-item">
                      <div className="list-item-main">
                        <span className="list-item-title">📕 {b.title}</span>
                        <span className="list-item-sub">{b.publisher ?? ""}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
