# コンポーネント仕様書

> UIコンポーネントの構成・役割・props をまとめたリファレンス。ドメイン仕様は SPEC.md、作業ルールは CLAUDE.md を参照。
> 実装が変わったらこのファイルも更新すること。

## 1. 構成の基本方針

- Next.js App Router。`src/app/<route>/page.tsx` はサーバーコンポーネント（DBから直接データ取得し、Server Actionsをpropsとして子コンポーネントへ渡す）。
- 対話状態（`useState`・イベントハンドラ）を持つコンポーネントは `"use client"` を付け、ファイル名は機能単位（例: `TodayClient.tsx`, `LocationCard.tsx`）。
- Server Action は各ディレクトリの `actions.ts`（`src/app/actions.ts`, `src/app/locations/actions.ts` 等）にまとめ、`page.tsx` から子コンポーネントへ関数そのものを渡す（`action.bind(null, id)` でID付きにする場面も多い）。
- スタイルは `src/app/globals.css` の1ファイルに集約（CSS Modulesやstyled-componentsは不使用）。クラス名は機能プレフィックス（`gacha-*`, `today-*`, `level-*` 等）で衝突を避ける。
- ライト/ダークは `prefers-color-scheme` ベースのCSS変数（`--surface`, `--accent`, `--muted` 等）で対応。新規コンポーネントも生の色コードではなくこれらの変数を使う。

---

## 2. レイアウト・ナビゲーション

### `src/app/layout.tsx`（RootLayout, サーバー）
全ページ共通の外枠。ヘッダー（ロゴ・ログインユーザーのメール・ログアウトボタン）と `<BottomNav>` を配置。`NAV_ITEMS` 配列がナビゲーションの唯一の定義元（今日・実績・進捗・週の優先順位・科目・場所・出発地点・予定・設定）。未ログイン時は `BottomNav` を出さない。

### `BottomNav.tsx`（クライアント）
モバイル向けの下部ナビゲーション。現在地のラベルを表示するトグルボタンを押すとシート状のメニューが開く。ページ遷移（`usePathname`の変化）で自動的に閉じる。
```ts
interface NavItem { href: string; label: string; }
function BottomNav({ items }: { items: NavItem[] })
```

---

## 3. 今日のページ（`/`）— デイリーガチャの中核

構成: `src/app/page.tsx`（サーバー、未開封/開封済みで分岐） → `StartPointSelector` / `GachaMachine` / `TodayClient`

### `StartPointSelector.tsx`（クライアント）
開封前のみ表示。出発地点が2件以上あるときだけレンダリングされる。カードリスト形式で、選択中の場所には「📍 ここを基準に予定を組みます」、他の場所には「この場所を基準にする」ボタンを表示（「デフォルト」という語は使わない）。
```ts
interface StartPointOption { id: string; name: string; }
function StartPointSelector({
  startPoints: StartPointOption[];
  currentStartPointId: string;
  setStartPointAction: (startPointId: string) => Promise<void>;
})
```

### `gacha/GachaMachine.tsx`（クライアント）— ガチャガチャ演出のオーケストレーター
カプセルトイ風の開封演出全体を管理するステートマシン（`idle → coin-flying → knob-turning → ejecting → blackout → opening → card-shown`）。`mode="reveal"`（today ページ本体、メダル2枚）と `mode="reroll"`（TodayClient内のオーバーレイ、メダル1枚）の両方で使う共通コンポーネント。
```ts
type GachaMode = "reveal" | "reroll";
interface GachaMachineProps {
  mode: GachaMode;
  medalsRemaining: number;   // reveal=2, reroll=1
  streakDays: number;
  level: number;              // ステータスバーに小さく "Lv.N" 表示
  action: () => Promise<RevealResult>;
  fetchMissionTextAction: () => Promise<string>;   // 演出をブロックしないよう別枠で並行取得
  fetchWeatherAction: () => Promise<RevealWeather | null>;
  giveUpAction?: () => Promise<void>;               // reveal時のみ
  onComplete?: () => void;
}
```
設計上のポイント:
- `action()`（スケジュール本体）と `fetchMissionTextAction()`/`fetchWeatherAction()`（AI生成・外部API）を分離し、後者2つは「ノブ回転中」の時点で先行して呼び始める（`ensureXStarted` + `useRef<Promise<T>>` パターン）。カード表示はミッション文・天気の到着を待たず即座に行い、届き次第スケルトンから差し替える。
- カプセルが割れる瞬間（`.gacha-ejected-capsule-open`）に `.gacha-capsule-glow` が白〜金のradial-gradientで一瞬光る（派手な演出は禁止のため単一の光の玉のみ）。
- 内部で `RevealCard` を描画する。

### `gacha/GachaDome.tsx`（クライアント, `forwardRef`）
Matter.js による物理演算で、ガチャドーム内のカプセル group をシミュレートするCanvas。
```ts
interface GachaDomeHandle {
  stir: () => void;                       // ノブ回転と同時に呼ぶ（かき混ぜ）
  eject: () => Promise<CapsuleColorPair>; // ゲートを開け、排出された1個の色を返す
}
```
`GachaMachine` が `ref` 経由でこの2メソッドを呼び出す。パラメータ（重力・反発係数・ドームの寸法等）は `gacha/physics.ts` に集約。

### `gacha/MachineBody.tsx`（クライアント）
筐体のSVG装飾（背面レイヤー `MachineBackLayer` / 前面ガラス・ノブ・排出口 `MachineFrontLayer`）。`knobRotating`/`ejecting` フラグでアニメーションクラスを切り替える。

### `gacha/MedalIcon.tsx`（クライアント）
メダルのSVGアイコン。`size: "sm" | "lg"` の2サイズ。

### `gacha/RevealCard.tsx`（クライアント）
開封結果のポップアップカード本体。
```ts
function RevealCard({
  result: RevealResult;
  missionText: string | null;      // nullの間はスケルトン表示
  weather: RevealWeather | null;
  weatherLoaded: boolean;          // trueになるまでweatherの有無に関わらずスケルトン
  streakDays: number;
  onClose: () => void;
})
```
ストリーク数を大きく強調（`.gacha-reveal-streak`）。天気セクションは `WeatherPanel` を内包し、空色トーンの背景で本文（ミッション文・スケジュール概要）と視覚的に区別する。

### `gacha/WeatherPanel.tsx`
天気サマリー＋3時間ごとの内訳を表示する純粋な表示コンポーネント（クライアント/サーバーどちらの親からも使える）。`RevealCard` と `TodayClient`（開封後の常時表示）の両方から呼ばれる共有部品。
```ts
function WeatherPanel({ weather: RevealWeather })
```

### `TodayClient.tsx`（クライアント）— 開封後の常時表示ビュー
今日のタイムライン全体（勉強/移動/休憩/昼食/予定ブロック）と、完了操作・リロール・ギブアップ・再計画をまとめて扱う最大のクライアントコンポーネント。
```ts
interface TodayBlock { id, type, startsAt, endsAt, title, locationId, locationName, status, actualMin, subjectId }
interface LocationOption { id: string; name: string; }
interface BookOption { id: string; title: string; subjectId: string; }

function TodayClient({
  blocks: TodayBlock[];
  locationOptions: LocationOption[];
  bookOptions: BookOption[];
  streakDays: number;
  levelInfo: LevelInfo;             // レベル・XPバー用
  weather: RevealWeather | null;
  rerollUsed: boolean;
  gaveUp: boolean;
  rerollAction: () => Promise<RevealResult>;
  fetchMissionTextAction: () => Promise<string>;
  fetchWeatherAction: () => Promise<RevealWeather | null>;
  giveUpAction: () => Promise<void>;
  reschedulePlanAction: () => Promise<void>;
  updateBlockStatusAction: (blockId, status, actualMin) => Promise<XpUpdateResult>;
  updateBlockManualAction: (blockId, formData) => Promise<void>;
  deleteBlockManualAction: (blockId) => Promise<void>;
  recordReadingLogAction: (blockId, bookId, fromPage, toPage) => Promise<void>;
})
```
内部の主な状態と演出:
- `run<T>(key, fn)`: 汎用の「pending管理→実行→`router.refresh()`」ヘルパー。ジェネリック化してあり、戻り値ありのアクション（完了系）・void のアクション（ギブアップ等）の両方に使える。
- ステータス行（`.today-status-row`）: `Lv.N` ＋ 細いXPバー（`.today-xp-bar`）＋ 🔥ストリーク。完了/一部完了ボタンで `XpUpdateResult` を受け取り、`xpGained > 0` なら「+N XP」がバー上に浮かぶトースト（`.xp-gain-toast`）、`leveledUp` なら中央に「⬆️ LEVEL UP!」オーバーレイ（`.level-up-overlay`、タップ or 2.5秒で自動的に閉じる）を表示する。
- `gaveUp` 時のみブロックの手動編集（時刻・場所の変更）・削除が可能になる。
- 完了系ボタンは常にクリック可能（`disabled`で封じない）で、状態遷移そのものはサーバー側の検証に委ねる設計。
- リロールは `showRerollMachine` フラグで `GachaMachine mode="reroll"` をオーバーレイ表示。

---

## 4. ダッシュボード（`/dashboard`）

### `dashboard/GrowthCard.tsx`（サーバー、静的表示）
ページ最上部の「成長カード」。円形のレベルバッジ（大きな数字を主役に）＋直下のXPバー＋同カード内にストリークをまとめる。演出は無し（アニメーションは今日のページ側が担当）。
```ts
function GrowthCard({
  levelInfo: LevelInfo;       // src/lib/xp/level.ts
  currentStreak: number;
  longestStreak: number;
})
```

### `dashboard/ProgressChart.tsx`（クライアント、Recharts）
科目別の週間ノルマ達成率を横棒グラフで表示。理想ペースを破線の `ReferenceLine` で重ね、達成率が理想ペース以上なら緑（`good`）、未満なら赤（`critical`）に色分け。グラフの下にアクセシビリティ用の同内容テーブルも表示する。
```ts
interface SubjectProgress { subjectId, name, quotaMin, actualMin, percent, status: "good" | "critical" }
function ProgressChart({ data: SubjectProgress[]; idealPacePercent: number })
```

---

## 5. 週はじめ優先順位設定（`/weekly-plan`）

`weekly-plan/page.tsx` は `AiProposalCard` → `WeeklyPlanForm` の順に縦に並べる（場所プールのチェックボックスはこの画面から撤去済み。場所単位の有効/無効は `/locations` に移動）。

### `weekly-plan/AiProposalCard.tsx`（クライアント）
週次AIノルマ提案（Claude API）のカード。手動設定カードと混同しないよう「🤖 AIからの提案」ヘッダー＋アクセントカラーの左ボーダー・淡い背景色で明示的に区別する（`.ai-proposal-card`）。
```ts
interface AiProposalSubjectMeta { id: string; name: string; weeklyQuotaMin: number; }
function AiProposalCard({
  weekStartDate: string;
  initialProposal: WeeklyProposal | null;
  subjects: AiProposalSubjectMeta[];
  orderedSubjectIds: string[];
  generateAiProposalAction: (weekStartDate) => Promise<{ proposal: WeeklyProposal | null; error?: string }>;
  applyAiProposalAction: (weekStartDate, orderedSubjectIds) => Promise<{ warnings: unknown[] }>;
})
```
状態: `idle | loading | failed | applying | applied`。「自分で決める」ボタンでカード自体を非表示にできる（`dismissed`）。

### `weekly-plan/WeeklyPlanForm.tsx`（クライアント）
科目の優先順位（▲▼で並べ替え）と、プラン生成ボタン。有効な場所（`Location.isEnabled`）が2件未満の場合は警告＋`/locations`へのリンクを表示し、生成ボタンを無効化する。
```ts
interface PrioritySubject { id: string; name: string; weeklyQuotaMin: number; }
function WeeklyPlanForm({
  weekStartDate: string;
  initialSubjects: PrioritySubject[];
  totalLocationCount: number;
  enabledLocationCount: number;
  generatePlanAction: (weekStartDate, orderedSubjectIds) => Promise<GeneratePlanResult>;
})
```

---

## 6. 場所・出発地点管理

### `locations/LocationCard.tsx`（クライアント）
`/locations` の一覧で場所ごとに使う行コンポーネント。名前・種別・営業時間取得状況の表示に加え、今週のガチャの抽選対象に含めるかどうかのトグルスイッチ（`.toggle-switch`）を持つ。無効化すると行全体がグレーアウトする（`.location-card-disabled`）。楽観的更新（クリック直後にローカルstateを切り替え、裏でServer Actionを`useTransition`で実行）。
```ts
function LocationCard({
  id: string;
  name: string;
  subLabel: string;
  isEnabled: boolean;
  setLocationEnabledAction: (locationId, isEnabled) => Promise<void>;
})
```
最低2件は有効にする必要がある旨の警告・件数表示は `locations/page.tsx` 側（サーバー）で行う。

### `start-points/page.tsx` / `start-points/[id]/edit/page.tsx`（サーバー）
出発地点のCRUD。`locations/` と同構成。「デフォルト」という語は使わず、選択中の地点には「📍 基準」バッジ、切替は「この場所を基準にする」ボタン。基準の出発地点を削除しようとするとサーバー側でリダイレクト＋クエリパラメータ経由のエラーメッセージを表示する（`?deleteError=`、`locations`編集画面の`hoursError`と同じパターン）。

---

## 7. 実績記録（`/history`）

### `history/HistoryClient.tsx`（クライアント）
今週すでに開封済みの過去日について、完了/一部完了/未実施を事後的に記録・修正するための画面。`TodayClient`のブロック操作部分を簡略化した独立コンポーネント（タイムライン全体の表示や出発地点選択は持たない）。
```ts
interface HistoryBlock { id, date, startsAt, endsAt, subjectName, locationName, status }
function HistoryClient({
  blocksByDate: Array<{ date: string; blocks: HistoryBlock[] }>;
  updateBlockStatusAction: (blockId, status, actualMin) => Promise<XpUpdateResult>;
})
```
`TodayClient`と同じ `run<T>` ジェネリックパターンを使うが、XP演出（トースト・レベルアップ）はこの画面では表示しない（今日のページに限定した演出のため）。

---

## 8. 参考書（`/subjects/[id]/books`）

### `subjects/[id]/books/AddBookForm.tsx`（クライアント）
参考書の追加フォーム。表紙画像をアップロードすると Claude Vision（`scanBookCoverAction`）でタイトル・出版社・総ページ数を自動抽出し、フォームへプリフィルする（失敗時は手動入力にフォールバック）。
```ts
function AddBookForm({
  subjectId: string;
  scanBookCoverAction: (base64, mediaType) => Promise<BookInfoDraft | null>;
  createBookAction: (subjectId, formData) => Promise<void>;
})
```

---

## 9. ページ（ルート）一覧

| ルート | ファイル | 概要 |
|---|---|---|
| `/` | `src/app/page.tsx` | 今日のページ。`!dayState`＝準備中、未開封＝`GachaMachine`、開封済み＝`TodayClient` |
| `/history` | `history/page.tsx` | 過去の実績記録・修正（`HistoryClient`） |
| `/dashboard` | `dashboard/page.tsx` | 進捗ダッシュボード（`GrowthCard` + `ProgressChart` + 参考書進捗・本棚） |
| `/weekly-plan` | `weekly-plan/page.tsx` | 週はじめ優先順位設定（`AiProposalCard` + `WeeklyPlanForm`） |
| `/subjects`, `/subjects/[id]/edit` | `subjects/page.tsx` 等 | 科目のCRUD |
| `/subjects/[id]/books` | `subjects/[id]/books/page.tsx` | 参考書の追加・一覧（`AddBookForm`） |
| `/locations`, `/locations/[id]/edit` | `locations/page.tsx` 等 | 場所のCRUD・有効/無効トグル（`LocationCard`） |
| `/start-points`, `/start-points/[id]/edit` | `start-points/page.tsx` 等 | 出発地点のCRUD・基準の切替 |
| `/events`, `/events/[id]/edit` | `events/page.tsx` 等 | 個人の固定予定のCRUD |
| `/settings` | `settings/page.tsx` | 起床時刻・営業時間外区切り等の設定 |
| `/login` | `login/page.tsx` | Googleログイン |
| `/api/cron/weekly-prep-reminder` | `api/cron/weekly-prep-reminder/route.ts` | Vercel Cronから呼ばれる週準備リマインダー（画面なし、CRON_SECRET認証） |

---

## 10. 関連する非UIモジュール（コンポーネントのpropsの型元）

UIコンポーネント自体ではないが、propsの型・演出のトリガーとなるロジック:

- `src/app/gacha/types.ts` — `RevealResult` / `RevealWeather` の型定義
- `src/lib/xp/level.ts` — `LevelInfo`（レベル・XPバーの表示元）、`levelInfoFromTotalXp()`
- `src/lib/xp/applyXp.ts` — `XpUpdateResult`（完了操作の戻り値、TodayClient/HistoryClientの演出トリガー）
- `src/app/gacha/colors.ts` / `src/app/gacha/physics.ts` — カプセルの配色・ガチャドームの物理パラメータ
