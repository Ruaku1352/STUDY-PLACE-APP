import { todayDateString, dateStringToDate } from "@/lib/date";
import { getCurrentUserId } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { addDaysToDate, weekdayIndex } from "@/lib/scheduler/time";
import type { WeeklyProposal } from "@/lib/ai/weeklyProposal";
import { applyAiProposal, generateAiProposal, generatePlan } from "./actions";
import { AiProposalCard } from "./AiProposalCard";
import { WeeklyPlanForm } from "./WeeklyPlanForm";

// 週次AIノルマ提案（Claude API呼び出し）がVercelのデフォルト実行時間上限（10秒）を
// 超えてタイムアウトすることがあるため、上限を延長する（Hobbyプランの上限=60秒）。
export const maxDuration = 60;

function currentWeekStart(): string {
  const today = todayDateString();
  return addDaysToDate(today, -weekdayIndex(today));
}

export default async function WeeklyPlanPage() {
  const userId = await getCurrentUserId();

  const weekStartDate = currentWeekStart();
  const [subjects, weeklyPlan, locations] = await Promise.all([
    prisma.subject.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.weeklyPlan.findUnique({
      where: { userId_weekStartDate: { userId, weekStartDate: dateStringToDate(weekStartDate) } },
    }),
    prisma.location.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
  ]);

  const savedOrder = Array.isArray(weeklyPlan?.priorities) ? (weeklyPlan.priorities as string[]) : [];
  const byId = new Map(subjects.map((s) => [s.id, s]));
  const ordered = [
    ...savedOrder.map((id) => byId.get(id)).filter((s): s is (typeof subjects)[number] => Boolean(s)),
    ...subjects.filter((s) => !savedOrder.includes(s.id)),
  ];

  const savedLocationPool = Array.isArray(weeklyPlan?.locationPoolJson) ? (weeklyPlan.locationPoolJson as string[]) : [];

  const today = todayDateString();
  const remainingDays = 7 - weekdayIndex(today);
  const isMidWeek = remainingDays < 7;

  return (
    <div>
      <h1>週はじめ優先順位設定</h1>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        対象週: {weekStartDate} 〜 {addDaysToDate(weekStartDate, 6)}
      </p>
      {isMidWeek && (
        <div className="warning-box" style={{ marginBottom: "1rem" }}>
          今週は残り{remainingDays}日です。この日数でノルマを設定してください。
        </div>
      )}
      <AiProposalCard
        weekStartDate={weekStartDate}
        initialProposal={weeklyPlan?.aiProposalJson ? (weeklyPlan.aiProposalJson as unknown as WeeklyProposal) : null}
        subjects={ordered.map((s) => ({ id: s.id, name: s.name, weeklyQuotaMin: s.weeklyQuotaMin }))}
        orderedSubjectIds={ordered.map((s) => s.id)}
        locationPoolIds={savedLocationPool}
        generateAiProposalAction={generateAiProposal}
        applyAiProposalAction={applyAiProposal}
      />
      <WeeklyPlanForm
        weekStartDate={weekStartDate}
        initialSubjects={ordered.map((s) => ({ id: s.id, name: s.name, weeklyQuotaMin: s.weeklyQuotaMin }))}
        locationOptions={locations.map((l) => ({ id: l.id, name: l.name }))}
        initialLocationPoolIds={savedLocationPool}
        generatePlanAction={generatePlan}
      />
    </div>
  );
}
