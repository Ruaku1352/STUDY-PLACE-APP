import Link from "next/link";
import { dateToDateString, dateToHHMM } from "@/lib/date";
import { getCurrentUserId } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { createEvent } from "./actions";

const KIND_LABEL: Record<string, string> = {
  school: "学校",
  work: "バイト",
  other: "その他",
};

export default async function EventsPage() {
  const userId = await getCurrentUserId();
  const [events, locations] = await Promise.all([
    prisma.fixedEvent.findMany({ where: { userId }, orderBy: { startsAt: "asc" } }),
    prisma.location.findMany({ where: { userId }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <h1>個人予定</h1>

      <div className="card-list" style={{ marginBottom: "1.5rem" }}>
        {events.length === 0 && <p className="muted">まだ予定が登録されていません。</p>}
        {events.map((e) => (
          <Link key={e.id} href={`/events/${e.id}/edit`} className="list-item">
            <div className="list-item-main">
              <span className="list-item-title">{e.title}</span>
              <span className="list-item-sub">
                {dateToDateString(e.startsAt)} {dateToHHMM(e.startsAt)}〜{dateToHHMM(e.endsAt)} ・ {KIND_LABEL[e.kind]}
              </span>
            </div>
            <span className="muted">編集 ›</span>
          </Link>
        ))}
      </div>

      <h2>予定を追加</h2>
      <form action={createEvent} className="card stack">
        <div className="field">
          <label htmlFor="title">タイトル</label>
          <input id="title" name="title" required placeholder="例: バイト" />
        </div>
        <div className="field">
          <label htmlFor="date">日付</label>
          <input id="date" name="date" type="date" required />
        </div>
        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="startTime">開始時刻</label>
            <input id="startTime" name="startTime" type="time" required />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="endTime">終了時刻</label>
            <input id="endTime" name="endTime" type="time" required />
          </div>
        </div>
        <div className="field">
          <label htmlFor="kind">種別</label>
          <select id="kind" name="kind" defaultValue="other">
            <option value="school">学校</option>
            <option value="work">バイト</option>
            <option value="other">その他</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="locationId">場所（任意・指定すると予定後の移動の起点になります）</label>
          <select id="locationId" name="locationId" defaultValue="">
            <option value="">指定なし（その場に留まる）</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="button-primary button-block">
          追加
        </button>
      </form>
    </div>
  );
}
