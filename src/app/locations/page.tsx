import { getCurrentUserId } from "@/lib/currentUser";
import { MIN_LOCATION_POOL_SIZE } from "@/lib/locationPool";
import { prisma } from "@/lib/prisma";
import { createLocation, setLocationEnabled } from "./actions";
import { LocationCard } from "./LocationCard";

const KIND_LABEL: Record<string, string> = {
  library: "図書館（滞在時間制限なし）",
  cafe: "カフェ（最大滞在時間あり）",
  other: "その他",
};

export default async function LocationsPage() {
  const userId = await getCurrentUserId();
  const locations = await prisma.location.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  const enabledCount = locations.filter((l) => l.isEnabled).length;
  const poolTooSmall = locations.length >= MIN_LOCATION_POOL_SIZE && enabledCount < MIN_LOCATION_POOL_SIZE;

  return (
    <div>
      <h1>勉強場所管理</h1>

      {locations.length > 0 && (
        <p className="muted" style={{ marginBottom: "0.75rem" }}>
          有効な場所（今週のガチャの抽選対象）: {enabledCount} / {locations.length}件
        </p>
      )}
      {poolTooSmall && (
        <p className="warning-box" style={{ marginBottom: "1rem" }}>
          最低{MIN_LOCATION_POOL_SIZE}箇所を有効にしてください（1箇所だとガチャになりません）。
        </p>
      )}

      <div className="card-list" style={{ marginBottom: "1.5rem" }}>
        {locations.length === 0 && <p className="muted">まだ場所が登録されていません。</p>}
        {locations.map((l) => (
          <LocationCard
            key={l.id}
            id={l.id}
            name={l.name}
            subLabel={`${KIND_LABEL[l.kind]}${l.openingHoursJson ? " ・ 営業時間取得済み" : " ・ 営業時間未取得"}`}
            isEnabled={l.isEnabled}
            setLocationEnabledAction={setLocationEnabled}
          />
        ))}
      </div>

      <h2>場所を追加</h2>
      <form action={createLocation} className="card stack">
        <div className="field">
          <label htmlFor="name">場所名</label>
          <input id="name" name="name" required placeholder="例: ○○図書館" />
        </div>
        <div className="field">
          <label htmlFor="address">住所</label>
          <input id="address" name="address" required placeholder="例: 東京都渋谷区..." />
        </div>
        <div className="field">
          <label htmlFor="kind">種別</label>
          <select id="kind" name="kind" defaultValue="library">
            <option value="library">図書館（滞在時間制限なし）</option>
            <option value="cafe">カフェ（最大滞在時間あり）</option>
            <option value="other">その他</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="maxStayMin">最大滞在時間（分・cafe等のみ、任意）</label>
          <input id="maxStayMin" name="maxStayMin" type="number" min={1} step={1} placeholder="例: 120" />
        </div>
        <div className="field">
          <label htmlFor="manualTravelMin">手動フォールバック移動時間（分・任意）</label>
          <input id="manualTravelMin" name="manualTravelMin" type="number" min={0} step={1} placeholder="API失敗時に使用" />
        </div>
        <button type="submit" className="button-primary button-block">
          追加
        </button>
      </form>
      <p className="muted" style={{ marginTop: "0.5rem" }}>
        追加後、編集画面から住所→営業時間の自動取得を行えます。
      </p>
    </div>
  );
}
