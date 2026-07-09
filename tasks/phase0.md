# Phase 0: プロジェクト雛形

## ゴール
Next.js + TypeScript + Prisma + Vitest のプロジェクトが起動し、空のトップページが表示される。

## やること
1. Next.js (App Router, TypeScript, ESLint) のプロジェクトを作成
2. Prisma を導入し、Postgres（開発時はローカル or Neon）への接続を `.env.local` で設定（`.env.example` も作る）
3. Vitest を導入し、サンプルテスト1本が通ることを確認
4. CLAUDE.md のディレクトリ方針どおりに `src/lib/scheduler/` `src/lib/google/` の空ディレクトリを作成
5. Prisma スキーマの初版を作成（この時点ではマイグレーションまで）：
   - User(id, email, name)
   - Subject(id, userId, name, weeklyQuotaMin, timeSlot: "morning"|"anytime")
   - WeeklyPlan(id, userId, weekStartDate)  // 週ごとの優先順位はここに priorities: subjectId[] (JSON) で保持
   - Location(id, userId, name, address, placeId?, kind: "library"|"cafe"|"other", maxStayMin?, openingHoursJson?, manualHoursJson?)
   - FixedEvent(id, userId, title, startsAt, endsAt, locationId?, kind)
   - Settings(userId, homeAddress, wakeWeekday, wakeWeekend, morningEnd="12:00", outsideEnd="21:00")
   - TravelCache(id, userId, fromKey, toKey, minutes, fetchedAt)  // fromKey/toKeyは "home" または placeId
   - ScheduleBlock(id, userId, date, type: "study"|"move"|"break"|"lunch"|"event", startsAt, endsAt, subjectId?, locationId?, status: "planned"|"done"|"partial"|"skipped", actualMin?, gcalEventId?)
   - DayState(id, userId, date, revealedAt?: DateTime, rerollUsed: Boolean, gaveUp: Boolean)  // デイリーガチャの開封状態管理

## 完了条件
- `npm run dev` でトップページ表示
- `npm run test` でサンプルテスト成功
- `npx prisma migrate dev` が成功
- CLAUDE.md の Phase 0 にチェックを入れる
