import Link from "next/link";
import { combineDateAndTime, dateStringToDate, dateToHHMM, todayDateString } from "@/lib/date";
import { getCurrentUserId } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { resolveTodayWeatherForUser } from "@/lib/weather/resolveTodayWeather";
import { isWeeklyPrepWindow, nextWeekStartDateFrom } from "@/lib/weeklyPrep";
import {
  deleteBlockManual,
  fetchMissionTextForToday,
  fetchWeatherForToday,
  giveUpToday,
  recordReadingLog,
  rerollToday,
  reschedulePlan,
  revealToday,
  setStartPointForToday,
  updateBlockManual,
  updateBlockStatus,
} from "./actions";
import { levelInfoFromTotalXp } from "@/lib/xp/level";
import { GachaMachine } from "./gacha/GachaMachine";
import { StartPointSelector } from "./StartPointSelector";
import { TodayClient, type BookOption, type TodayBlock } from "./TodayClient";

// 開封時のミッション文生成（Claude API呼び出し）がVercelのデフォルト実行時間上限（10秒）を
// 超えてタイムアウトすることがあるため、上限を延長する（Hobbyプランの上限=60秒）。
export const maxDuration = 60;

export default async function TodayPage() {
  const userId = await getCurrentUserId();
  const today = todayDateString();

  const [dayState, nextWeekPlan] = await Promise.all([
    prisma.dayState.findUnique({ where: { userId_date: { userId, date: dateStringToDate(today) } } }),
    prisma.weeklyPlan.findUnique({
      where: { userId_weekStartDate: { userId, weekStartDate: dateStringToDate(nextWeekStartDateFrom(today)) } },
    }),
  ]);

  const showPrepBanner = isWeeklyPrepWindow() && !nextWeekPlan;
  const prepBanner = showPrepBanner && (
    <Link href="/weekly-plan" className="card" style={{ display: "block", marginBottom: "1rem" }}>
      🎰 来週のガチャの準備をしよう
    </Link>
  );

  if (!dayState) {
    return (
      <div>
        {prepBanner}
        <div className="card" style={{ textAlign: "center" }}>
          <p style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }} aria-hidden="true">
            🎰
          </p>
          <h1>準備中</h1>
          <p className="muted" style={{ marginBottom: "1rem" }}>
            今週のプランがまだ生成されていません。ノルマ・優先順位を設定すると、ガチャが引けるようになります。
          </p>
          <Link href="/weekly-plan" className="button-primary button-block">
            週はじめ設定へ
          </Link>
        </div>
      </div>
    );
  }

  const isRevealed = Boolean(dayState.revealedAt) || dayState.gaveUp;
  const [streak, userProgress] = await Promise.all([
    prisma.streak.findUnique({ where: { userId } }),
    prisma.userProgress.findUnique({ where: { userId } }),
  ]);
  const streakDays = streak?.currentCount ?? 0;
  const levelInfo = levelInfoFromTotalXp(userProgress?.totalXp ?? 0);

  if (!isRevealed) {
    const startPoints = await prisma.startPoint.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
    const defaultStartPoint = startPoints.find((sp) => sp.isDefault) ?? startPoints[0];
    const currentStartPointId = dayState.startPointId ?? defaultStartPoint?.id ?? "";

    return (
      <div>
        {prepBanner}
        {startPoints.length > 0 && (
          <StartPointSelector
            startPoints={startPoints.map((sp) => ({ id: sp.id, name: sp.name }))}
            currentStartPointId={currentStartPointId}
            setStartPointAction={setStartPointForToday}
          />
        )}
        <GachaMachine
          mode="reveal"
          medalsRemaining={2}
          streakDays={streakDays}
          level={levelInfo.level}
          action={revealToday}
          fetchMissionTextAction={fetchMissionTextForToday.bind(null, false)}
          fetchWeatherAction={fetchWeatherForToday}
          giveUpAction={giveUpToday}
        />
      </div>
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
      {prepBanner}
      <h1>今日のスケジュール</h1>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        {today}
      </p>
      <TodayClient
        blocks={blocks}
        locationOptions={locations.map((l) => ({ id: l.id, name: l.name }))}
        bookOptions={bookOptions}
        streakDays={streakDays}
        levelInfo={levelInfo}
        weather={weather}
        rerollUsed={dayState.rerollUsed}
        gaveUp={dayState.gaveUp}
        rerollAction={rerollToday}
        fetchMissionTextAction={fetchMissionTextForToday.bind(null, true)}
        fetchWeatherAction={fetchWeatherForToday}
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
