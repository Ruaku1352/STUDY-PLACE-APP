# Phase 2: Google Maps/Places 連携＋キャッシュ

## ゴール
移動時間（Routes API: transit+walking）と営業時間（Places API）が実データで取得でき、DBキャッシュ経由でスケジューラに供給される。

## やること
1. `src/lib/google/routes.ts`：2地点間の所要時間取得（transitを優先、取得不可なら walking）。入出力は分単位。
2. `src/lib/google/places.ts`：placeId から opening_hours を取得。住所→placeId の解決（Find Place）も実装。
3. `src/lib/google/cache.ts`：TravelCache テーブルを介したキャッシュ層
   - キー: (userId, fromKey, toKey)。有効期限30日。ヒット時はAPIを呼ばない。
   - 営業時間は Location.openingHoursJson に保存し、同じく30日で再取得。
4. フォールバック実装：
   - Routes API失敗 → 期限切れキャッシュ値 → 手動入力値（Locationに manualTravelMin? を追加）の順
   - Places失敗 → manualHoursJson を使用
5. スケジューラとの接続：travelTimeFn / 営業時間をこの層から供給する server-side 関数 `buildSchedulerInput(userId, weekStart)` を作成
6. テスト：API層はモックで、キャッシュのヒット/ミス/期限切れ/フォールバック順序を検証

## 注意
- APIキーはサーバー側環境変数のみ（`GOOGLE_MAPS_API_KEY`）
- 週間プラン生成1回あたりのAPI呼び出し数をログ出力し、キャッシュが効いていることを確認する

## 完了条件
- 実在の2地点で移動時間が取得でき、2回目はキャッシュから返る
- CLAUDE.md の Phase 2 にチェック
