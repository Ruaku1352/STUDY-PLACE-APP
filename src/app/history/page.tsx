import { combineDateAndTime, dateStringToDate, dateToDateString, dateToHHMM, todayDateString } from "@/lib/date";
import { getCurrentUserId } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { addDaysToDate, weekdayIndex } from "@/lib/scheduler/time";
import { updateBlockStatus } from "@/app/actions";
import { HistoryClient, type HistoryBlock } from "./HistoryClient";

export default async function HistoryPage() {
  const userId = await getCurrentUserId();

  const today = todayDateString();
  const weekStartDate = addDaysToDate(today, -weekdayIndex(today));
  const weekEndDate = addDaysToDate(weekStartDate, 6);

  const pastDayStates = await prisma.dayState.findMany({
    where: {
      userId,
      date: { gte: dateStringToDate(weekStartDate), lt: dateStringToDate(today) },
      OR: [{ revealedAt: { not: null } }, { gaveUp: true }],
    },
    orderBy: { date: "desc" },
  });

  const pastDates = pastDayStates.map((d) => dateToDateString(d.date));

  const [studyBlocks, subjects, locations] = await Promise.all([
    prisma.scheduleBlock.findMany({
      where: {
        userId,
        type: "study",
        date: { gte: dateStringToDate(weekStartDate), lte: combineDateAndTime(weekEndDate, "23:59") },
      },
      orderBy: { startsAt: "asc" },
    }),
    prisma.subject.findMany({ where: { userId } }),
    prisma.location.findMany({ where: { userId } }),
  ]);

  const subjectNameById = new Map(subjects.map((s) => [s.id, s.name]));
  const locationNameById = new Map(locations.map((l) => [l.id, l.name]));

  const blocksByDate = pastDates.map((date) => ({
    date,
    blocks: studyBlocks
      .filter((b) => dateToDateString(b.date) === date)
      .map((b): HistoryBlock => ({
        id: b.id,
        date,
        startsAt: dateToHHMM(b.startsAt),
        endsAt: dateToHHMM(b.endsAt),
        subjectName: b.subjectId ? (subjectNameById.get(b.subjectId) ?? "") : "",
        locationName: b.locationId ? (locationNameById.get(b.locationId) ?? null) : null,
        status: b.status as HistoryBlock["status"],
      })),
  }));

  return (
    <div>
      <h1>実績記録</h1>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        今週すでに開封済みの過去の日について、勉強実績を記録・修正できます。
      </p>
      <HistoryClient blocksByDate={blocksByDate} updateBlockStatusAction={updateBlockStatus} />
    </div>
  );
}
