"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toMinutes } from "@/lib/scheduler/time";

export interface HistoryBlock {
  id: string;
  date: string;
  startsAt: string;
  endsAt: string;
  subjectName: string;
  locationName: string | null;
  status: "planned" | "done" | "partial" | "skipped";
}

const STATUS_LABEL: Record<HistoryBlock["status"], string> = {
  planned: "未記録",
  done: "完了",
  partial: "一部完了",
  skipped: "未実施",
};

export function HistoryClient({
  blocksByDate,
  updateBlockStatusAction,
}: {
  blocksByDate: Array<{ date: string; blocks: HistoryBlock[] }>;
  updateBlockStatusAction: (blockId: string, status: "done" | "partial" | "skipped", actualMin: number) => Promise<void>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [partialInputId, setPartialInputId] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<void>) {
    setPending(key);
    try {
      await fn();
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  if (blocksByDate.length === 0) {
    return <p className="muted">記録できる過去の日がまだありません。</p>;
  }

  return (
    <div className="card-list">
      {blocksByDate.map(({ date, blocks }) => (
        <div key={date} className="card">
          <h2>{date}</h2>
          <div className="timeline">
            {blocks.map((b) => {
              const fullDuration = toMinutes(b.endsAt) - toMinutes(b.startsAt);
              return (
                <div key={b.id} className="timeline-block" data-type="study">
                  <span className="timeline-time">
                    {b.startsAt}
                    <br />
                    {b.endsAt}
                  </span>
                  <div className="timeline-body">
                    <div className="timeline-title">
                      {b.subjectName}
                      {b.locationName ? ` @ ${b.locationName}` : ""}
                    </div>
                    <div className="timeline-sub">状態: {STATUS_LABEL[b.status]}</div>

                    <div className="actions-row" style={{ marginTop: "0.4rem" }}>
                      <button
                        type="button"
                        disabled={pending !== null}
                        onClick={() => run(`status-${b.id}`, () => updateBlockStatusAction(b.id, "done", fullDuration))}
                      >
                        完了
                      </button>
                      <button
                        type="button"
                        disabled={pending !== null}
                        onClick={() => setPartialInputId(partialInputId === b.id ? null : b.id)}
                      >
                        一部完了
                      </button>
                      <button
                        type="button"
                        disabled={pending !== null}
                        onClick={() => run(`status-${b.id}`, () => updateBlockStatusAction(b.id, "skipped", 0))}
                      >
                        未実施
                      </button>
                    </div>

                    {partialInputId === b.id && (
                      <form
                        className="row"
                        style={{ marginTop: "0.4rem" }}
                        onSubmit={(e) => {
                          e.preventDefault();
                          const value = Number(new FormData(e.currentTarget).get("actualMin"));
                          run(`status-${b.id}`, () => updateBlockStatusAction(b.id, "partial", value)).then(() =>
                            setPartialInputId(null),
                          );
                        }}
                      >
                        <input
                          type="number"
                          name="actualMin"
                          min={0}
                          max={fullDuration}
                          defaultValue={Math.round(fullDuration / 2)}
                          style={{ width: "5rem" }}
                        />
                        <span className="muted">分 実施</span>
                        <button type="submit" className="button-primary">
                          記録
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
