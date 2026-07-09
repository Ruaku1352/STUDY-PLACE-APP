# Phase 1: スケジューリングロジック（純粋関数＋テスト）

## ゴール
外部API・DBに依存しない純粋関数として週間スケジューラが動き、テストで検証済みになる。

## 前提
CLAUDE.md の「ドメインルール」をすべて実装対象とする。移動時間と営業時間は**引数で受け取る**（この段階ではダミーデータ。API接続はPhase 2）。

## やること
1. `src/lib/scheduler/types.ts`：入力・出力の型定義
   - 入力: subjects(ノルマ・優先順位・timeSlot), locations(種別・最大滞在・営業時間), fixedEvents, settings(起床時刻等), travelTimeFn(from, to) => minutes
   - 出力: 7日分の ScheduleBlock[]（date, type, start, end, subjectId?, locationId?）と warnings[]
2. `src/lib/scheduler/generateWeek.ts`：週間プラン生成
   - ドメインルール（60分最小ブロック、同一場所1日1回、cafe最大滞在、morning枠、21:00制限、場所ローテーション、休憩・昼食の自動配置、移動ブロック挿入）をすべて反映
   - ノルマ超過判定と warning 生成（超過分数・割り当て不能科目を含む）
3. `src/lib/scheduler/reschedule.ts`：「今日以降を再生成」
   - 完了済みブロックの実績を差し引いた残ノルマで残り日を再割り当て
4. `src/lib/scheduler/reroll.ts`：当日分のリロール
   - ノルマ配分（科目と分数）は維持し、場所の組み合わせと移動時間だけ引き直す
   - 直前の結果と同じ場所構成にならないようにする
5. Vitest テスト（最低限このケース）：
   - 通常の1週間が破綻なく生成される（移動→勉強→休憩の整合、時刻の重複なし）
   - morning科目が午前に配置される
   - cafeの最大滞在時間を超えない／同じ場所が1日2回現れない
   - 個人予定と重複しない／予定の場所が次の移動の起点になる
   - 21:00以降にブロックがない
   - ノルマ超過時に warning が出て、優先順位順に割り当てられる
   - 60分未満の隙間に勉強が入らない
   - reschedule が完了実績を保持して残ノルマを再配分する
   - reroll がノルマ配分を維持しつつ場所構成を変える

## 完了条件
- `npm run test` 全通過
- CLAUDE.md の Phase 1 にチェック
