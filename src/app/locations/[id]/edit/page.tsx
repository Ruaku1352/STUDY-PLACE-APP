import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/currentUser";
import type { PlacesWeeklyHours } from "@/lib/google/places";
import { prisma } from "@/lib/prisma";
import { deleteLocation, resolveLocationHours, updateLocation } from "../../actions";

const WEEKDAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

export default async function EditLocationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ hoursError?: string }>;
}) {
  const { id } = await params;
  const { hoursError } = await searchParams;
  const userId = await getCurrentUserId();
  const location = await prisma.location.findFirst({ where: { id, userId } });
  if (!location) notFound();

  const updateWithId = updateLocation.bind(null, location.id);
  const deleteWithId = deleteLocation.bind(null, location.id);
  const resolveWithId = resolveLocationHours.bind(null, location.id);

  const autoHours = location.openingHoursJson as PlacesWeeklyHours | null;
  const manualHours = (location.manualHoursJson as PlacesWeeklyHours | null) ?? {};

  return (
    <div>
      <h1>場所を編集</h1>

      {hoursError && <div className="warning-box">{hoursError}</div>}

      <div className="card">
        <h2>営業時間（自動取得）</h2>
        {autoHours ? (
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            {WEEKDAY_LABELS.map((label, day) => (
              <li key={day} className="muted">
                {label}: {autoHours[day] ? `${autoHours[day]!.open} - ${autoHours[day]!.close}` : "休業"}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">未取得です。placeId: {location.placeId ?? "未解決"}</p>
        )}
        <form action={resolveWithId} style={{ marginTop: "0.75rem" }}>
          <button type="submit" className="button-primary button-block">
            住所から営業時間を自動取得
          </button>
        </form>
      </div>

      <form action={updateWithId} className="card stack">
        <div className="field">
          <label htmlFor="name">場所名</label>
          <input id="name" name="name" required defaultValue={location.name} />
        </div>
        <div className="field">
          <label htmlFor="address">住所</label>
          <input id="address" name="address" required defaultValue={location.address} />
        </div>
        <div className="field">
          <label htmlFor="kind">種別</label>
          <select id="kind" name="kind" defaultValue={location.kind}>
            <option value="library">図書館（滞在時間制限なし）</option>
            <option value="cafe">カフェ（最大滞在時間あり）</option>
            <option value="other">その他</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="maxStayMin">最大滞在時間（分・任意）</label>
          <input
            id="maxStayMin"
            name="maxStayMin"
            type="number"
            min={1}
            step={1}
            defaultValue={location.maxStayMin ?? undefined}
          />
        </div>
        <div className="field">
          <label htmlFor="manualTravelMin">手動フォールバック移動時間（分・任意）</label>
          <input
            id="manualTravelMin"
            name="manualTravelMin"
            type="number"
            min={0}
            step={1}
            defaultValue={location.manualTravelMin ?? undefined}
          />
        </div>

        <div>
          <label>手動営業時間（自動取得に失敗した場合のフォールバック。両方空欄なら休業扱い）</label>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.4rem" }}>
            {WEEKDAY_LABELS.map((label, day) => (
              <div key={day} className="row">
                <span style={{ width: "1.5rem" }}>{label}</span>
                <input type="time" name={`manualOpen${day}`} defaultValue={manualHours[day]?.open ?? ""} />
                <span>〜</span>
                <input type="time" name={`manualClose${day}`} defaultValue={manualHours[day]?.close ?? ""} />
              </div>
            ))}
          </div>
        </div>

        <button type="submit" className="button-primary button-block">
          保存
        </button>
      </form>

      <form action={deleteWithId} style={{ marginTop: "0.75rem" }}>
        <button type="submit" className="button-danger button-block">
          削除
        </button>
      </form>
    </div>
  );
}
