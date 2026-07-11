import { combineDateAndTime, dateStringToDate, todayDateString } from "@/lib/date";
import { getCurrentUserId } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { addDaysToDate, weekdayIndex } from "@/lib/scheduler/time";
import { ProgressChart, type SubjectProgress } from "./ProgressChart";

export default async function DashboardPage() {
  const userId = await getCurrentUserId();

  const today = todayDateString();
  const weekStartDate = addDaysToDate(today, -weekdayIndex(today));
  const weekEndDate = addDaysToDate(weekStartDate, 6);

  const [subjects, studyBlocks] = await Promise.all([
    prisma.subject.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.scheduleBlock.findMany({
      where: {
        userId,
        type: "study",
        date: { gte: dateStringToDate(weekStartDate), lte: combineDateAndTime(weekEndDate, "23:59") },
      },
    }),
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

      {data.length === 0 ? (
        <p className="muted">まだ科目が登録されていません。</p>
      ) : (
        <div className="card">
          <ProgressChart data={data} idealPacePercent={idealPacePercent} />
        </div>
      )}
    </div>
  );
}
