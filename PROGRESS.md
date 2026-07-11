# 進捗まとめ（Phase 0〜3 完了時点）

> 詳細仕様は SPEC.md、作業指示は tasks/phaseN.md、進行チェックは CLAUDE.md を参照。
> このファイルは「今どこまで動くか」のスナップショット。

## 全体状況

Phase 0〜3が完了。Next.js + Prisma(Neon) + Vitest + Google Maps Platform を使い、
科目・場所・予定の管理からデイリーガチャ形式のタイムライン表示・実績記録・
リロール・ギブアップ・再計画までブラウザで一通り動く状態。

認証は未実装（Phase 4予定）で、`CURRENT_USER_ID`固定の1ユーザーとして動作する。

---

## Phase 0: プロジェクト雛形

- Next.js 15（App Router / TypeScript / ESLint）を導入。Node 18.19系のため
  Next 15 / Prisma 6 / Vitest 3 系にバージョンを固定（最新版はNode 20+必須で動かないため）
- Prisma スキーマ初版（User / Subject / WeeklyPlan / Location / FixedEvent /
  Settings / TravelCache / ScheduleBlock / DayState）を作成し、Neon の実DBに
  `prisma migrate dev` を適用済み
- Vitest 導入、サンプルテスト成功
- `src/lib/scheduler/` `src/lib/google/` の空ディレクトリを用意

## Phase 1: スケジューリングロジック（純粋関数＋テスト）

外部API・DB非依存の純粋関数として実装（`src/lib/scheduler/`）:

- `types.ts` — 入出力の型定義
- `core.ts` — 1日分のタイムライン生成エンジン
  （移動→勉強→休憩・昼食の自動配置、60分最小ブロック、同一場所1日1回、
  cafeの最大滞在時間、morning枠優先配置、21:00制限、場所ローテーション）
- `generateWeek.ts` — 週間プラン生成、ノルマ超過時のwarning生成
- `reschedule.ts` — 完了実績を差し引いて残り日を再配分
- `reroll.ts` — 当日の場所構成だけ引き直し、科目ごとの分数配分は維持

テスト9件（`generateWeek.test.ts`7件、`reschedule.test.ts`・`reroll.test.ts`各1件）、
すべてVitestで通過。

## Phase 2: Google Maps/Places 連携＋キャッシュ

- `src/lib/google/routes.ts` — Routes API（transit優先→walkingフォールバック）
- `src/lib/google/places.ts` — Places API (New) でText Search（住所→Place ID）と
  Place Details（営業時間取得）
- `src/lib/google/cache.ts` — キャッシュ層の純粋ロジック
  （有効キャッシュ→API→期限切れキャッシュ→手動入力値→null、有効期限30日）
- `src/lib/google/prismaStores.ts` — TravelCache・Location.openingHoursJsonへの
  Prisma実装
- `src/lib/google/buildSchedulerInput.ts` — DB・Google APIから
  `GenerateWeekInput`を組み立てるサーバー関数。移動時間・営業時間はここで
  事前に全解決し、scheduler本体には同期関数として渡す
  （ループ内でのAPI直呼び出しを避けるため）

テスト9件（キャッシュのヒット/ミス/期限切れ/APIフォールバック/手動フォールバック）
通過。実際にRoutes APIとPlaces API (New) を呼び出し、2回目はキャッシュから
返ることを確認済み。

**Places API (New) は当初「有効化直後で未反映」の状態だったが、現在は
Text Search・Place Detailsとも実データで正常動作を確認済み**
（例: 「スターバックス 東京駅」でPlace ID解決→7日分の営業時間取得に成功）。

## Phase 3: タイムラインUI・管理画面

スマホ優先レスポンシブ、下部ナビ付きの画面一式（`src/app/`）:

| 画面 | パス | 内容 |
|---|---|---|
| 設定 | `/settings` | 自宅住所・起床時刻（平日/休日）・午前枠終了・外出終了時刻 |
| 科目管理 | `/subjects`, `/subjects/[id]/edit` | CRUD、週間ノルマ、timeSlotタグ |
| 勉強場所管理 | `/locations`, `/locations/[id]/edit` | CRUD、住所→Place ID解決＋営業時間自動取得ボタン、失敗時の手動営業時間グリッド、最大滞在時間・手動移動時間フォールバック |
| 個人予定 | `/events`, `/events/[id]/edit` | CRUD、場所紐付け（任意） |
| 週はじめ優先順位設定 | `/weekly-plan` | 科目の優先順位を上下ボタンで並べ替え→「今週のプランを生成」 |
| 今日のページ（デイリーガチャ） | `/`（トップ） | 未開封カード＋開封演出→タイムライン表示、実績記録、リロール（1日1回）、ギブアップ（手動編集解放）、今日以降を再計画 |

設計上のポイント:
- 認証は仮の固定ユーザー（`src/lib/currentUser.ts`の`CURRENT_USER_ID`）。
  Phase 4でGoogleログインに差し替え予定
- **未開封日の場所・時間割はサーバー側で「開封済みの場合のみ」クエリ・
  レンダリングし、開封操作自体は戻り値を持たないServer Action。
  クライアントに一切ブロックデータを送らない設計**
- 日付・時刻はサーバーのローカル時刻（Asia/Tokyo）で統一

検証: ブラウザ自動化ツールが使えないサンドボックス環境だったため、実際の
Server Actions・Prisma・Phase1/2ロジックを一時的なAPI Routeから直接呼び出す形で、
CRUD→週間プラン生成→開封→実績記録→リロール→ギブアップ→再計画の一連の流れを
実データで動作確認（検証後にテストデータ・一時ルートは削除済み）。

---

## 既知の制約・今後の課題

- 認証未実装（固定ユーザー、Phase 4でGoogleログインに差し替え）
- Googleカレンダー連携未実装（マスクイベント書き出し・開封時の実名更新はPhase 4）
- 進捗ダッシュボード（達成率グラフ）未実装（Phase 5）
- 週優先順位の並べ替えはドラッグではなく上下ボタン
  （スマホでのHTML5ネイティブドラッグ＆ドロップのタッチ対応が不安定なための判断）
- Vercelへの本番デプロイは未実施（Phase 5）

## 次のフェーズ

- Phase 4: Googleログイン（Auth.js）＋Google Calendar連携（マスクイベント発行・
  開封時の実名更新）
- Phase 5: 進捗ダッシュボード（達成率グラフ・理想ペース比較）、実績記録の
  可視化、Vercelへのデプロイ
