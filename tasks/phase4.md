# Phase 4: Googleログイン＋Calendar連携

## ゴール
Googleアカウントでログインでき、確定したプランがGoogleカレンダーに書き出され、勉強開始10分前通知が付く。

## やること
1. Auth.js (NextAuth) で Googleログイン導入
   - スコープ: openid, email, profile, https://www.googleapis.com/auth/calendar.events
   - 許可リスト方式：環境変数 `ALLOWED_EMAILS` にあるメールのみログイン可（当面自分だけ）
   - Phase 3 の仮ユーザーを実ユーザー(userId)に差し替え
2. `src/lib/google/calendar.ts`（ネタバレ防止同期）：
   - プラン確定時、全ブロックを**マスクイベント**として作成（タイトル「🎁 スタディミッション」等、場所・科目名を含めない。時間帯は正しい）
   - **開封時に当日分のイベントを実名（場所・科目入り）に更新**
   - **勉強ブロックには reminders: popup 10分前** を設定（マスク状態でも有効）
   - 1日の最初のイベントに開封忘れ防止の通知を付ける
   - 作成イベントに extendedProperties.private.appBlockId = ScheduleBlock.id を付与し、gcalEventId を保存
3. 同期ロジック（リロール・再計画にも対応）：
   - リスケ・再計画時は appBlockId で突合し、変更されたものは更新、消えたものは削除、新規は作成（二重登録防止）
4. トークンの refresh 対応（长期間使うため refresh_token を保存・更新）

## 完了条件
- 自分のGoogleカレンダーに1週間分の予定が入り、スマホで10分前通知が来る
- 再計画後、カレンダーが正しく更新される（重複・ゴミイベントなし）
- CLAUDE.md の Phase 4 にチェック
