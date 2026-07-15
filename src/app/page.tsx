import Link from "next/link";
import { combineDateAndTime, dateStringToDate, dateToHHMM, todayDateString } from "@/lib/date";
import { getCurrentUserId } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { resolveTodayWeatherForUser } from "@/lib/weather/resolveTodayWeather";
import {
  deleteBlockManual,
  giveUpToday,
  recordReadingLog,
  rerollToday,
  reschedulePlan,
  revealToday,
  updateBlockManual,
  updateBlockStatus,
} from "./actions";
import { GachaMachine } from "./gacha/GachaMachine";
import { TodayClient, type BookOption, type TodayBlock } from "./TodayClient";

// 開封時のミッション文生成（Claude API呼び出し）がVercelのデフォルト実行時間上限（10秒）を
// 超えてタイムアウトすることがあるため、上限を延長する（Hobbyプランの上限=60秒）。
export const maxDuration = 60;

export default async function TodayPage() {
  const userId = await getCurrentUserId();
  const today = todayDateString();

  const dayState = await prisma.dayState.findUnique({
    where: { userId_date: { userId, date: dateStringToDate(today) } },
  });

  if (!dayState) {
    return (
      <div className="card">
        <h1>今日のスケジュール</h1>
        <p>今週のプランがまだ生成されていません。</p>
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          <Link href="/weekly-plan">週はじめ優先順位設定</Link> から今週のプランを生成してください。
        </p>
      </div>
    );
  }

  const isRevealed = Boolean(dayState.revealedAt) || dayState.gaveUp;
  const streak = await prisma.streak.findUnique({ where: { userId } });
  const streakDays = streak?.currentCount ?? 0;

  if (!isRevealed) {
    return (
      <GachaMachine
        mode="reveal"
        medalsRemaining={2}
        streakDays={streakDays}
        action={revealToday}
        giveUpAction={giveUpToday}
      />
    );
  }

  const [blocksRaw, subjects, locations, fixedEventsToday, books] = await Promise.all([
    prisma.scheduleBlock.findMany({
      where: { userId, date: dateStringToDate(today) },
      orderBy: { startsAt: "asc" },
    }),
    prisma.subject.findMany({ where: { userId } }),
    prisma.location.findMany({ where: { userId } }),
    prisma.fixedEvent.findMany({
      where: { userId, startsAt: { gte: dateStringToDate(today), lte: combineDateAndTime(today, "23:59") } },
    }),
    prisma.book.findMany({ where: { userId, completedAt: null } }),
  ]);

  const subjectNameById = new Map(subjects.map((s) => [s.id, s.name]));
  const locationNameById = new Map(locations.map((l) => [l.id, l.name]));
  const eventTitleByTimeRange = new Map(fixedEventsToday.map((e) => [`${dateToHHMM(e.startsAt)}-${dateToHHMM(e.endsAt)}`, e.title]));

  const blocks: TodayBlock[] = blocksRaw.map((b) => {
    const startsAt = dateToHHMM(b.startsAt);
    const endsAt = dateToHHMM(b.endsAt);
    let title = "";
    if (b.type === "study" && b.subjectId) title = subjectNameById.get(b.subjectId) ?? "";
    else if (b.type === "event") title = eventTitleByTimeRange.get(`${startsAt}-${endsAt}`) ?? "予定";
    else if (b.type === "break") title = "休憩";
    else if (b.type === "lunch") title = "昼食";

    return {
      id: b.id,
      type: b.type as TodayBlock["type"],
      startsAt,
      endsAt,
      title,
      locationId: b.locationId,
      locationName: b.locationId ? (locationNameById.get(b.locationId) ?? null) : null,
      status: b.status as TodayBlock["status"],
      actualMin: b.actualMin,
      subjectId: b.subjectId,
    };
  });

  const bookOptions: BookOption[] = books.map((b) => ({ id: b.id, title: b.title, subjectId: b.subjectId }));

  const resolvedWeather = await resolveTodayWeatherForUser({ prisma, userId, date: today });
  const weather = resolvedWeather ? { ...resolvedWeather.summary, blocks: resolvedWeather.blocks } : null;

  return (
    <div>
      <h1>今日のスケジュール</h1>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        {today}
      </p>
      <TodayClient
        blocks={blocks}
        locationOptions={locations.map((l) => ({ id: l.id, name: l.name }))}
        bookOptions={bookOptions}
        streakDays={streakDays}
        weather={weather}
        rerollUsed={dayState.rerollUsed}
        gaveUp={dayState.gaveUp}
        rerollAction={rerollToday}
        giveUpAction={giveUpToday}
        reschedulePlanAction={reschedulePlan}
        updateBlockStatusAction={updateBlockStatus}
        updateBlockManualAction={updateBlockManual}
        deleteBlockManualAction={deleteBlockManual}
        recordReadingLogAction={recordReadingLog}
      />
    </div>
  );
}
