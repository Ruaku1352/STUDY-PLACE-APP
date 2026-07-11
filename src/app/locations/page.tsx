import Link from "next/link";
import { getCurrentUserId } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { createLocation } from "./actions";

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

  return (
    <div>
      <h1>勉強場所管理</h1>

      <div className="card-list" style={{ marginBottom: "1.5rem" }}>
        {locations.length === 0 && <p className="muted">まだ場所が登録されていません。</p>}
        {locations.map((l) => (
          <Link key={l.id} href={`/locations/${l.id}/edit`} className="list-item">
            <div className="list-item-main">
              <span className="list-item-title">{l.name}</span>
              <span className="list-item-sub">
                {KIND_LABEL[l.kind]}
                {l.openingHoursJson ? " ・ 営業時間取得済み" : " ・ 営業時間未取得"}
              </span>
            </div>
            <span className="muted">編集 ›</span>
          </Link>
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
