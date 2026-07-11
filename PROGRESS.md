# 進捗まとめ（Phase 0〜5 完了・ハッカソン前成果物完成）

> 詳細仕様は SPEC.md、作業指示は tasks/phaseN.md、進行チェックは CLAUDE.md を参照。
> このファイルは「今どこまで動くか」のスナップショット。

## 全体状況

Phase 0〜5がすべて完了。Next.js + Prisma(Neon) + Vitest + Google Maps Platform +
Auth.js(Google) + Google Calendar + Recharts を使い、科目・場所・予定の管理から
デイリーガチャ形式のタイムライン表示・実績記録・進捗ダッシュボード・
Googleカレンダー同期までを実データ・実アカウントで動作確認済み。

**本番URL**: https://study-place-app-p243.vercel.app
（GitHubリポジトリ: https://github.com/Ruaku1352/STUDY-PLACE-APP、`main`へのpushで自動デプロイ）

---

## Phase 0: プロジェクト雛形

- Next.js 15（App Router / TypeScript / ESLint）を導入。Node 18.19系のため
  Next 15 / Prisma 6 / Vitest 3 系にバージョンを固定（最新版はNode 20+必須で動かないため）
- Prisma スキーマ初版（User / Subject / WeeklyPlan / Location / FixedEvent /
  Settings / TravelCache / ScheduleBlock / DayState）を作成し、Neon の実DBに
  `prisma migrate dev` を適用済み
- Vitest 導入、サンプルテスト成功

## Phase 1: スケジューリングロジック（純粋関数＋テスト）

外部API・DB非依存の純粋関数として実装（`src/lib/scheduler/`）:

- `types.ts` — 入出力の型定義
- `core.ts` — 1日分のタイムライン生成エンジン
- `dailyBudget.ts` — 週内の日数へノルマを均等配分（Bresenham風）。
  「週の前半だけでノルマを使い切り後半が0件になる」バグをPhase 5中に発見・修正
- `generateWeek.ts` / `reschedule.ts` / `reroll.ts`

テスト19件、すべてVitestで通過。

## Phase 2: Google Maps/Places 連携＋キャッシュ

- `src/lib/google/routes.ts`（Routes API）/ `places.ts`（Places API New: Text Search・Place Details）
- `src/lib/google/cache.ts` — キャッシュ層の純粋ロジック（有効キャッシュ→API→期限切れキャッシュ→手動入力値→null）
- `src/lib/google/buildSchedulerInput.ts` — DB・Google APIから`GenerateWeekInput`を組み立て
- 開発用 `MOCK_GOOGLE_API` フラグ（Routes/Places/Calendarをモック化）と `prisma/seed.ts`

## Phase 3: タイムラインUI・管理画面

スマホ優先レスポンシブの画面一式：設定・科目・場所・予定・週優先順位設定・今日のページ（デイリーガチャ）。
未開封日のブロックはサーバー側で「開封済みの場合のみ」クエリ・レンダリングし、クライアントに一切送らない設計。

## Phase 4: Googleログイン＋Calendar連携

- Auth.js (NextAuth v5) + Googleログイン（`ALLOWED_EMAILS`許可リスト方式）
- `src/auth.config.ts`（Edge Runtime対応の最小構成）と `src/auth.ts`（Prisma使用の本体）に分離
  （middlewareがPrisma経由でNode専用APIを読み込みクラッシュする問題を解消）
- `src/lib/google/calendar.ts` / `calendarSync.ts` — マスクイベント作成、開封時の実名更新、
  リロール・再計画時の旧イベント削除＋新規作成（重複・ゴミイベント防止）
- 実アカウントで検証済み：ログイン→マスクイベント作成→開封→実名更新→リロール/再計画後の
  カレンダー整合性（重複なし）

## Phase 5: 実績記録・進捗ダッシュボード・デプロイ

- `/dashboard` — Recharts製の科目別達成率バー＋理想ペース参照線（dataviz skillの
  色設計手順に従い、status色をvalidate_palette.jsで検証）
- `/history` — 今週すでに開封済みの過去日について実績（完了/一部完了/未実施）を記録・修正
- `src/lib/scheduler/dailyBudget.ts` によるアルゴリズム修正（週内均等配分）
- reschedule が実績（actualMin）を正しく残ノルマ計算に反映することを実データで確認
- **Vercel本番デプロイ**：GitHub連携で自動デプロイ。実際に発生した問題と対処：
  1. `postinstall`だけでは不十分（Vercelのビルドキャッシュで`npm install`の
     実質ステップがスキップされ得るため）→ `build`スクリプト自体で`prisma generate`を実行
  2. カスタム出力先（`prisma-client`ジェネレータ＋`src/generated/prisma`）は、
     生成コードにビルド時の絶対パスが埋め込まれ、Vercelのビルド環境
     （`/vercel/path0/...`）と実行環境（`/var/task/...`）でパスが一致せず
     クエリエンジンが見つからない問題が発生 → `prisma-client-js`＋デフォルト出力先
     （`node_modules/.prisma/client`）という実績のある構成に変更して解消
  3. Google OAuthの`redirect_uri`を本番ドメイン向けに追加、`NEXTAUTH_URL`を設定
- 本番URLで実際にログイン→ダッシュボード表示→実績記録→反映まで確認済み

---

## 既知の制約・今後の課題

- 週優先順位の並べ替えはドラッグではなく上下ボタン
  （スマホでのHTML5ネイティブドラッグ＆ドロップのタッチ対応が不安定なための判断）
- 過去数週間の達成率推移の折れ線グラフは未実装（SPEC.mdで「余裕があれば」の任意項目）
- 開発DBと本番DBは同一のNeonインスタンスを共用（個人利用のみのため分離していない）
