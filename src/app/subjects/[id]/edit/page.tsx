import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { deleteSubject, updateSubject } from "../../actions";

export default async function EditSubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const subject = await prisma.subject.findFirst({ where: { id, userId } });
  if (!subject) notFound();

  const updateWithId = updateSubject.bind(null, subject.id);
  const deleteWithId = deleteSubject.bind(null, subject.id);
  const weeklyQuotaHours = Math.floor(subject.weeklyQuotaMin / 60);
  const weeklyQuotaMinutesPart = subject.weeklyQuotaMin % 60;

  return (
    <div>
      <h1>科目を編集</h1>
      <form action={updateWithId} className="card stack">
        <div className="field">
          <label htmlFor="name">科目名</label>
          <input id="name" name="name" required defaultValue={subject.name} />
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
              defaultValue={weeklyQuotaHours}
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
              defaultValue={weeklyQuotaMinutesPart}
              style={{ width: "5rem" }}
              aria-label="分"
            />
            <span>分</span>
          </div>
        </div>
        <div className="field">
          <label htmlFor="timeSlot">時間帯タグ</label>
          <select id="timeSlot" name="timeSlot" defaultValue={subject.timeSlot}>
            <option value="anytime">いつでも</option>
            <option value="morning">午前中心（数学・アルゴリズム系など）</option>
          </select>
        </div>
        <button type="submit" className="button-primary button-block">
          保存
        </button>
      </form>

      <p style={{ marginTop: "0.75rem" }}>
        <Link href={`/subjects/${subject.id}/books`}>📷 参考書を管理</Link>
      </p>

      <form action={deleteWithId} style={{ marginTop: "0.75rem" }}>
        <button type="submit" className="button-danger button-block">
          削除
        </button>
      </form>
    </div>
  );
}
