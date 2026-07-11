import { notFound } from "next/navigation";
import { dateToDateString, dateToHHMM } from "@/lib/date";
import { getCurrentUserId } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { deleteEvent, updateEvent } from "../../actions";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const [event, locations] = await Promise.all([
    prisma.fixedEvent.findFirst({ where: { id, userId } }),
    prisma.location.findMany({ where: { userId }, orderBy: { name: "asc" } }),
  ]);
  if (!event) notFound();

  const updateWithId = updateEvent.bind(null, event.id);
  const deleteWithId = deleteEvent.bind(null, event.id);

  return (
    <div>
      <h1>予定を編集</h1>
      <form action={updateWithId} className="card stack">
        <div className="field">
          <label htmlFor="title">タイトル</label>
          <input id="title" name="title" required defaultValue={event.title} />
        </div>
        <div className="field">
          <label htmlFor="date">日付</label>
          <input id="date" name="date" type="date" required defaultValue={dateToDateString(event.startsAt)} />
        </div>
        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="startTime">開始時刻</label>
            <input id="startTime" name="startTime" type="time" required defaultValue={dateToHHMM(event.startsAt)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="endTime">終了時刻</label>
            <input id="endTime" name="endTime" type="time" required defaultValue={dateToHHMM(event.endsAt)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="kind">種別</label>
          <select id="kind" name="kind" defaultValue={event.kind}>
            <option value="school">学校</option>
            <option value="work">バイト</option>
            <option value="other">その他</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="locationId">場所（任意）</label>
          <select id="locationId" name="locationId" defaultValue={event.locationId ?? ""}>
            <option value="">指定なし（その場に留まる）</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
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
