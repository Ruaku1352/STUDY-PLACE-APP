"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMinutesAsHM } from "@/lib/formatMinutes";
import type { GeneratePlanResult } from "./actions";

export interface PrioritySubject {
  id: string;
  name: string;
  weeklyQuotaMin: number;
}

export interface LocationOption {
  id: string;
  name: string;
}

const MIN_POOL_SIZE = 2;

export function WeeklyPlanForm({
  weekStartDate,
  initialSubjects,
  locationOptions,
  initialLocationPoolIds,
  generatePlanAction,
}: {
  weekStartDate: string;
  initialSubjects: PrioritySubject[];
  locationOptions: LocationOption[];
  /** 空配列なら「全場所」を意味する（デフォルトは全チェック済みで表示する）。 */
  initialLocationPoolIds: string[];
  generatePlanAction: (
    weekStartDate: string,
    orderedSubjectIds: string[],
    locationPoolIds: string[],
  ) => Promise<GeneratePlanResult>;
}) {
  const [order, setOrder] = useState(initialSubjects);
  const [pool, setPool] = useState<Set<string>>(
    new Set(initialLocationPoolIds.length > 0 ? initialLocationPoolIds : locationOptions.map((l) => l.id)),
  );
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

  function togglePool(id: string) {
    setPool((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const poolTooSmall = locationOptions.length >= MIN_POOL_SIZE && pool.size < MIN_POOL_SIZE;

  async function handleGenerate() {
    setStatus("saving");
    setWarnings(null);
    const result = await generatePlanAction(
      weekStartDate,
      order.map((s) => s.id),
      Array.from(pool),
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
      <h2>① ノルマ・優先順位</h2>
      <div className="card-list" style={{ marginBottom: "1.5rem" }}>
        {order.map((s, i) => (
          <div key={s.id} className="list-item">
            <div className="list-item-main">
              <span className="list-item-title">
                {i + 1}. {s.name}
              </span>
              <span className="list-item-sub">週 {formatMinutesAsHM(s.weeklyQuotaMin)}</span>
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

      {locationOptions.length > 0 && (
        <>
          <h2>② 今週の場所プール</h2>
          <p className="muted" style={{ marginBottom: "0.75rem" }}>
            チェックした場所だけが今週のガチャの抽選対象になります。どの場所がどの日に出るかは開封まで分かりません。
          </p>
          <div className="card-list" style={{ marginBottom: "0.5rem" }}>
            {locationOptions.map((loc) => (
              <label key={loc.id} className="list-item" style={{ cursor: "pointer" }}>
                <span className="list-item-main">
                  <span className="list-item-title">{loc.name}</span>
                </span>
                <input
                  type="checkbox"
                  checked={pool.has(loc.id)}
                  onChange={() => togglePool(loc.id)}
                  aria-label={`${loc.name}を今週の場所プールに含める`}
                />
              </label>
            ))}
          </div>
          {poolTooSmall && (
            <p className="warning-box" style={{ marginBottom: "1rem" }}>
              最低{MIN_POOL_SIZE}箇所を選んでください（1箇所だとガチャになりません）。
            </p>
          )}
        </>
      )}

      <h2>③ 生成</h2>
      <button
        type="button"
        className="button-primary button-block"
        onClick={handleGenerate}
        disabled={status === "saving" || poolTooSmall}
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
