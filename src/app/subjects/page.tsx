import Link from "next/link";
import { getCurrentUserId } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { createSubject } from "./actions";

const TIME_SLOT_LABEL: Record<string, string> = {
  morning: "午前中心",
  anytime: "いつでも",
};

export default async function SubjectsPage() {
  const userId = await getCurrentUserId();
  const subjects = await prisma.subject.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <h1>科目管理</h1>

      <div className="card-list" style={{ marginBottom: "1.5rem" }}>
        {subjects.length === 0 && <p className="muted">まだ科目が登録されていません。</p>}
        {subjects.map((s) => (
          <Link key={s.id} href={`/subjects/${s.id}/edit`} className="list-item">
            <div className="list-item-main">
              <span className="list-item-title">{s.name}</span>
              <span className="list-item-sub">
                週 {s.weeklyQuotaMin}分 ・ {TIME_SLOT_LABEL[s.timeSlot]}
              </span>
            </div>
            <span className="muted">編集 ›</span>
          </Link>
        ))}
      </div>

      <h2>科目を追加</h2>
      <form action={createSubject} className="card stack">
        <div className="field">
          <label htmlFor="name">科目名</label>
          <input id="name" name="name" required placeholder="例: 数学" />
        </div>
        <div className="field">
          <label htmlFor="weeklyQuotaHours">週間ノルマ</label>
          <div className="row">
            <input
              id="weeklyQuotaHours"
              name="weeklyQuotaHours"
              type="number"
              min={0}
              step={1}
              defaultValue={0}
              style={{ width: "5rem" }}
              aria-label="時間"
            />
            <span>時間</span>
            <input
              id="weeklyQuotaMinutes"
              name="weeklyQuotaMinutes"
              type="number"
              min={0}
              max={59}
              step={1}
              defaultValue={0}
              style={{ width: "5rem" }}
              aria-label="分"
            />
            <span>分</span>
          </div>
        </div>
        <div className="field">
          <label htmlFor="timeSlot">時間帯タグ</label>
          <select id="timeSlot" name="timeSlot" defaultValue="anytime">
            <option value="anytime">いつでも</option>
            <option value="morning">午前中心（数学・アルゴリズム系など）</option>
          </select>
        </div>
        <button type="submit" className="button-primary button-block">
          追加
        </button>
      </form>
    </div>
  );
}
