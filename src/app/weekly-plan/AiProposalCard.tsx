"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { WeeklyProposal } from "@/lib/ai/weeklyProposal";

const TIME_SLOT_LABEL: Record<string, string> = {
  morning: "午前中心",
  anytime: "いつでも",
  no_change: "変更なし",
};

export interface AiProposalSubjectMeta {
  id: string;
  name: string;
  weeklyQuotaMin: number;
}

export function AiProposalCard({
  weekStartDate,
  initialProposal,
  subjects,
  orderedSubjectIds,
  generateAiProposalAction,
  applyAiProposalAction,
}: {
  weekStartDate: string;
  initialProposal: WeeklyProposal | null;
  subjects: AiProposalSubjectMeta[];
  orderedSubjectIds: string[];
  generateAiProposalAction: (weekStartDate: string) => Promise<{ proposal: WeeklyProposal | null; error?: string }>;
  applyAiProposalAction: (weekStartDate: string, orderedSubjectIds: string[]) => Promise<{ warnings: unknown[] }>;
}) {
  const [proposal, setProposal] = useState(initialProposal);
  const [status, setStatus] = useState<"idle" | "loading" | "failed" | "applying" | "applied">("idle");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const router = useRouter();

  const subjectById = new Map(subjects.map((s) => [s.id, s]));

  async function handleGenerate() {
    setStatus("loading");
    setErrorDetail(null);
    const result = await generateAiProposalAction(weekStartDate);
    if (result.proposal) {
      setProposal(result.proposal);
      setStatus("idle");
    } else {
      setErrorDetail(result.error ?? null);
      setStatus("failed");
    }
  }

  async function handleApply() {
    setStatus("applying");
    await applyAiProposalAction(weekStartDate, orderedSubjectIds);
    setStatus("applied");
    router.refresh();
  }

  if (subjects.length === 0 || dismissed) return null;

  if (!proposal) {
    return (
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginTop: 0 }}>週次AI提案</h2>
        {status === "failed" ? (
          <div>
            <p className="muted">AI提案の生成に失敗しました。下の手動設定をご利用ください。</p>
            {errorDetail && (
              <p className="muted" style={{ fontSize: "0.75rem", wordBreak: "break-all" }}>
                詳細: {errorDetail}
              </p>
            )}
          </div>
        ) : (
          <button type="button" className="button-primary button-block" onClick={handleGenerate} disabled={status === "loading"}>
            {status === "loading" ? "生成中..." : "AI提案を生成"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: "1.5rem" }}>
      <h2 style={{ marginTop: 0 }}>週次AI提案</h2>
      <p>{proposal.overallComment}</p>

      {proposal.confidence === "provisional" && (
        <div className="warning-box" style={{ marginBottom: "0.75rem" }}>
          ⚠️ まだ実績データが少ないため暫定的な提案です。精度は使うほど上がります。
        </div>
      )}

      <div className="card-list" style={{ marginBottom: "1rem" }}>
        {proposal.subjects.map((s) => {
          const meta = subjectById.get(s.subjectId);
          if (!meta) return null;
          return (
            <div key={s.subjectId} className="list-item">
              <div className="list-item-main">
                <span className="list-item-title">{meta.name}</span>
                <span className="list-item-sub">
                  週 {meta.weeklyQuotaMin}分 → {s.proposedQuotaMin}分
                  {s.timeSlotChange !== "no_change" && ` ／ ${TIME_SLOT_LABEL[s.timeSlotChange]}へ変更`}
                </span>
                <span className="list-item-sub">{s.reason}</span>
              </div>
            </div>
          );
        })}
      </div>

      {status === "applied" ? (
        <p className="muted">提案を反映してプランを生成しました。</p>
      ) : (
        <div className="actions-row">
          <button type="button" className="button-primary" onClick={handleApply} disabled={status === "applying"}>
            {status === "applying" ? "生成中..." : "この提案で生成"}
          </button>
          <button type="button" onClick={() => setDismissed(true)} disabled={status === "applying"}>
            自分で決める
          </button>
        </div>
      )}
    </div>
  );
}
