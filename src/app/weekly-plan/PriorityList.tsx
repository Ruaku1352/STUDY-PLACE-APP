"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GeneratePlanResult } from "./actions";

export interface PrioritySubject {
  id: string;
  name: string;
  weeklyQuotaMin: number;
}

export function PriorityList({
  weekStartDate,
  initialSubjects,
  generatePlanAction,
}: {
  weekStartDate: string;
  initialSubjects: PrioritySubject[];
  generatePlanAction: (weekStartDate: string, orderedSubjectIds: string[]) => Promise<GeneratePlanResult>;
}) {
  const [order, setOrder] = useState(initialSubjects);
  const [status, setStatus] = useState<"idle" | "saving" | "done">("idle");
  const [warnings, setWarnings] = useState<GeneratePlanResult["warnings"] | null>(null);
  const router = useRouter();

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  }

  async function handleGenerate() {
    setStatus("saving");
    setWarnings(null);
    const result = await generatePlanAction(
      weekStartDate,
      order.map((s) => s.id),
    );
    setWarnings(result.warnings);
    setStatus("done");
    router.refresh();
  }

  if (order.length === 0) {
    return <p className="muted">先に科目管理画面で科目を登録してください。</p>;
  }

  return (
    <div>
      <div className="card-list" style={{ marginBottom: "1rem" }}>
        {order.map((s, i) => (
          <div key={s.id} className="list-item">
            <div className="list-item-main">
              <span className="list-item-title">
                {i + 1}. {s.name}
              </span>
              <span className="list-item-sub">週 {s.weeklyQuotaMin}分</span>
            </div>
            <div className="row">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="上へ">
                ▲
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label="下へ">
                ▼
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="button-primary button-block"
        onClick={handleGenerate}
        disabled={status === "saving"}
      >
        {status === "saving" ? "生成中..." : "今週のプランを生成"}
      </button>

      {status === "done" && (
        <div style={{ marginTop: "1rem" }}>
          {warnings && warnings.length > 0 ? (
            <div className="warning-box">
              <strong>ノルマ超過の警告</strong>
              <ul style={{ marginTop: "0.4rem", paddingLeft: "1.1rem" }}>
                {warnings.map((w) => (
                  <li key={w.subjectId}>{w.message}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="muted">プランを生成しました。場所・時間割は当日開封するまで表示されません。</p>
          )}
        </div>
      )}
    </div>
  );
}
