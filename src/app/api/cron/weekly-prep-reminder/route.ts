import { NextRequest, NextResponse } from "next/server";
import { combineDateAndTime, dateStringToDate, todayDateString } from "@/lib/date";
import { createCalendarEvent } from "@/lib/google/calendar";
import { getValidGoogleAccessToken } from "@/lib/google/googleTokens";
import { prisma } from "@/lib/prisma";
import { nextWeekStartDateFrom } from "@/lib/weeklyPrep";

export const maxDuration = 60;

const PREP_REMINDER_TITLE = "🎰 来週のガチャの準備をしよう";
const PREP_REMINDER_TIME = "18:00";

/**
 * 毎週日曜18:00（vercel.jsonのcronスケジュール、UTC 9:00）にVercel Cronから呼ばれる。
 * Google連携済みの全ユーザーについて、来週分の「準備リマインダー」イベントが
 * まだ無ければGoogleカレンダーに作成する（PrepReminderで冪等性を担保、重複作成しない）。
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = todayDateString();
  // 実行日から見て次の月曜日（実行日が月曜なら7日後、日曜なら翌日）を対象週とする
  const nextWeekStartDate = nextWeekStartDateFrom(today);

  const users = await prisma.user.findMany({ where: { googleRefreshToken: { not: null } } });

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
    const existing = await prisma.prepReminder.findUnique({
      where: { userId_weekStartDate: { userId: user.id, weekStartDate: dateStringToDate(nextWeekStartDate) } },
    });
    if (existing) {
      skipped++;
      continue;
    }

    try {
      const accessToken = await getValidGoogleAccessToken(user.id);
      const startsAt = combineDateAndTime(today, PREP_REMINDER_TIME);
      const endsAt = combineDateAndTime(today, "18:15");

      const gcalEventId = await createCalendarEvent(accessToken, {
        summary: PREP_REMINDER_TITLE,
        description: "週はじめ優先順位設定画面から、来週のノルマ・優先順位・場所プールを設定しましょう。",
        startIso: startsAt.toISOString(),
        endIso: endsAt.toISOString(),
        appBlockId: `prep-reminder-${user.id}-${nextWeekStartDate}`,
        reminderOverrides: [{ method: "popup", minutes: 0 }],
      });

      await prisma.prepReminder.create({
        data: { userId: user.id, weekStartDate: dateStringToDate(nextWeekStartDate), gcalEventId },
      });
      created++;
    } catch (e) {
      console.error(`[weekly-prep-reminder] user ${user.id} のリマインダー作成に失敗しました`, e);
      failed++;
    }
  }

  return NextResponse.json({ nextWeekStartDate, created, skipped, failed });
}
