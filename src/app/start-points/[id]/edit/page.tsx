import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { deleteStartPoint, setDefaultStartPoint, updateStartPoint } from "../../actions";

export default async function EditStartPointPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const startPoint = await prisma.startPoint.findFirst({ where: { id, userId } });
  if (!startPoint) notFound();

  const updateWithId = updateStartPoint.bind(null, startPoint.id);
  const setDefaultWithId = setDefaultStartPoint.bind(null, startPoint.id);
  const deleteWithId = deleteStartPoint.bind(null, startPoint.id);

  return (
    <div>
      <h1>出発地点を編集</h1>

      <form action={updateWithId} className="card stack">
        <div className="field">
          <label htmlFor="name">名前</label>
          <input id="name" name="name" required defaultValue={startPoint.name} />
        </div>
        <div className="field">
          <label htmlFor="address">住所</label>
          <input id="address" name="address" required defaultValue={startPoint.address} />
        </div>
        <p className="muted" style={{ fontSize: "0.75rem", marginTop: "-0.5rem" }}>
          {startPoint.lat !== null && startPoint.lng !== null
            ? `現在の推定座標: ${startPoint.lat.toFixed(3)}, ${startPoint.lng.toFixed(3)}`
            : "座標未解決です（保存すると住所から再推測します）"}
        </p>
        <button type="submit" className="button-primary button-block">
          保存
        </button>
      </form>

      {startPoint.isDefault ? (
        <p className="muted" style={{ marginTop: "0.75rem" }}>
          📍 ここを基準に予定を組みます
        </p>
      ) : (
        <form action={setDefaultWithId} style={{ marginTop: "0.75rem" }}>
          <button type="submit" className="button-block">
            この場所を基準にする
          </button>
        </form>
      )}

      <form action={deleteWithId} style={{ marginTop: "0.75rem" }}>
        <button type="submit" className="button-danger button-block" disabled={startPoint.isDefault}>
          削除
        </button>
      </form>
      {startPoint.isDefault && (
        <p className="muted" style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
          基準の出発地点は削除できません。先に他の出発地点を基準にしてください。
        </p>
      )}

      <p style={{ marginTop: "1rem" }}>
        <Link href="/start-points">‹ 出発地点一覧へ戻る</Link>
      </p>
    </div>
  );
}
