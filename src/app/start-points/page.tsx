import Link from "next/link";
import { getCurrentUserId } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { createStartPoint } from "./actions";

export default async function StartPointsPage() {
  const userId = await getCurrentUserId();
  const startPoints = await prisma.startPoint.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <h1>出発地点管理</h1>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        1日の始まり・移動時間計算の起点になる場所です。デフォルトの出発地点は、日ごとに変更しない限り毎日使われます。
      </p>

      <div className="card-list" style={{ marginBottom: "1.5rem" }}>
        {startPoints.length === 0 && <p className="muted">まだ出発地点が登録されていません。</p>}
        {startPoints.map((sp) => (
          <Link key={sp.id} href={`/start-points/${sp.id}/edit`} className="list-item">
            <div className="list-item-main">
              <span className="list-item-title">
                {sp.name}
                {sp.isDefault && " ・ デフォルト"}
              </span>
              <span className="list-item-sub">
                {sp.address}
                {sp.lat === null || sp.lng === null ? " ・ 座標未解決" : ""}
              </span>
            </div>
            <span className="muted">編集 ›</span>
          </Link>
        ))}
      </div>

      <h2>出発地点を追加</h2>
      <form action={createStartPoint} className="card stack">
        <div className="field">
          <label htmlFor="name">名前</label>
          <input id="name" name="name" required placeholder="例: 自宅, 実家" />
        </div>
        <div className="field">
          <label htmlFor="address">住所</label>
          <input id="address" name="address" required placeholder="例: 東京都渋谷区..." />
        </div>
        <button type="submit" className="button-primary button-block">
          追加
        </button>
      </form>
      <p className="muted" style={{ marginTop: "0.5rem" }}>
        座標は住所から自動で推測されます（移動時間・天気予報の計算に使います）。
      </p>
    </div>
  );
}
