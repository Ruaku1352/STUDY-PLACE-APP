"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toMinutes } from "@/lib/scheduler/time";
import { GachaMachine } from "./gacha/GachaMachine";
import type { RevealResult, RevealWeather } from "./gacha/types";
import { WeatherPanel } from "./gacha/WeatherPanel";

export interface TodayBlock {
  id: string;
  type: "study" | "move" | "break" | "lunch" | "event";
  startsAt: string;
  endsAt: string;
  title: string;
  locationId: string | null;
  locationName: string | null;
  status: "planned" | "done" | "partial" | "skipped";
  actualMin: number | null;
  subjectId: string | null;
}

export interface LocationOption {
  id: string;
  name: string;
}

export interface BookOption {
  id: string;
  title: string;
  subjectId: string;
}

const TYPE_LABEL: Record<TodayBlock["type"], string> = {
  move: "移動",
  study: "勉強",
  break: "休憩",
  lunch: "昼食",
  event: "予定",
};

const STATUS_LABEL: Record<TodayBlock["status"], string> = {
  planned: "未記録",
  done: "完了",
  partial: "一部完了",
  skipped: "未実施",
};

export function TodayClient({
  blocks,
  locationOptions,
  bookOptions,
  streakDays,
  weather,
  rerollUsed,
  gaveUp,
  rerollAction,
  giveUpAction,
  reschedulePlanAction,
  updateBlockStatusAction,
  updateBlockManualAction,
  deleteBlockManualAction,
  recordReadingLogAction,
}: {
  blocks: TodayBlock[];
  locationOptions: LocationOption[];
  bookOptions: BookOption[];
  streakDays: number;
  weather: RevealWeather | null;
  rerollUsed: boolean;
  gaveUp: boolean;
  rerollAction: () => Promise<RevealResult>;
  giveUpAction: () => Promise<void>;
  reschedulePlanAction: () => Promise<void>;
  updateBlockStatusAction: (blockId: string, status: "done" | "partial" | "skipped", actualMin: number) => Promise<void>;
  updateBlockManualAction: (blockId: string, formData: FormData) => Promise<void>;
  deleteBlockManualAction: (blockId: string) => Promise<void>;
  recordReadingLogAction: (blockId: string, bookId: string, fromPage: number, toPage: number) => Promise<void>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [partialInputId, setPartialInputId] = useState<string | null>(null);
  const [readingLogId, setReadingLogId] = useState<string | null>(null);
  const [showRerollMachine, setShowRerollMachine] = useState(false);

  async function run(key: string, fn: () => Promise<void>) {
    setPending(key);
    try {
      await fn();
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      <p className="muted" style={{ marginBottom: "0.75rem" }}>
        🔥 {streakDays}日目
      </p>
      {weather && (
        <div className="card">
          <WeatherPanel weather={weather} />
        </div>
      )}
      <div className="timeline" style={{ marginBottom: "1.25rem" }}>
        {blocks.map((b, i) => {
          const fullDuration = toMinutes(b.endsAt) - toMinutes(b.startsAt);
          const nextLocationName =
            b.type === "move" ? (blocks.slice(i + 1).find((n) => n.locationName)?.locationName ?? "") : "";
          const subjectBooks = bookOptions.filter((book) => book.subjectId === b.subjectId);

          return (
            <div key={b.id} className="timeline-block" data-type={b.type}>
              <span className="timeline-time">
                {b.startsAt}
                <br />
                {b.endsAt}
              </span>
              <div className="timeline-body">
                <div className="timeline-title">
                  <span className="badge" style={{ marginRight: "0.4rem" }}>
                    {TYPE_LABEL[b.type]}
                  </span>
                  {b.type === "move" ? `${nextLocationName || "次の場所"}へ移動` : b.title}
                </div>

                {b.type === "study" && (
                  <div className="timeline-sub">状態: {STATUS_LABEL[b.status]}</div>
                )}

                {b.type === "study" && !gaveUp && (
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
                )}

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

                {b.type === "study" && !gaveUp && subjectBooks.length > 0 && (
                  <div style={{ marginTop: "0.4rem" }}>
                    <button type="button" onClick={() => setReadingLogId(readingLogId === b.id ? null : b.id)}>
                      📖 ページを記録
                    </button>
                  </div>
                )}

                {readingLogId === b.id && (
                  <form
                    className="stack"
                    style={{ marginTop: "0.4rem" }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const bookId = String(formData.get("bookId") ?? "");
                      const fromPage = Number(formData.get("fromPage"));
                      const toPage = Number(formData.get("toPage"));
                      run(`reading-${b.id}`, () => recordReadingLogAction(b.id, bookId, fromPage, toPage)).then(() =>
                        setReadingLogId(null),
                      );
                    }}
                  >
                    <select name="bookId" required defaultValue="">
                      <option value="" disabled>
                        参考書を選択
                      </option>
                      {subjectBooks.map((book) => (
                        <option key={book.id} value={book.id}>
                          {book.title}
                        </option>
                      ))}
                    </select>
                    <div className="row">
                      <input type="number" name="fromPage" min={0} placeholder="開始ページ" required style={{ width: "6rem" }} />
                      <span>〜</span>
                      <input type="number" name="toPage" min={0} placeholder="終了ページ" required style={{ width: "6rem" }} />
                    </div>
                    <button type="submit" className="button-primary">
                      記録
                    </button>
                  </form>
                )}

                {gaveUp && b.type !== "event" && (
                  <div className="actions-row" style={{ marginTop: "0.4rem" }}>
                    <button type="button" onClick={() => setEditingId(editingId === b.id ? null : b.id)}>
                      編集
                    </button>
                    <button
                      type="button"
                      className="button-danger"
                      disabled={pending !== null}
                      onClick={() => run(`delete-${b.id}`, () => deleteBlockManualAction(b.id))}
                    >
                      削除
                    </button>
                  </div>
                )}

                {editingId === b.id && (
                  <form
                    className="stack"
                    style={{ marginTop: "0.5rem" }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      run(`edit-${b.id}`, () => updateBlockManualAction(b.id, formData)).then(() => setEditingId(null));
                    }}
                  >
                    <div className="row">
                      <input type="time" name="startsAt" defaultValue={b.startsAt} required />
                      <span>〜</span>
                      <input type="time" name="endsAt" defaultValue={b.endsAt} required />
                    </div>
                    {locationOptions.length > 0 && (
                      <select name="locationId" defaultValue={b.locationId ?? ""}>
                        <option value="">場所なし</option>
                        {locationOptions.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <button type="submit" className="button-primary">
                      保存
                    </button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="actions-row">
        <button
          type="button"
          className="button-block"
          disabled={rerollUsed || pending !== null}
          onClick={() => setShowRerollMachine(true)}
        >
          {rerollUsed ? "リロール済み" : "リロール（残り1回）"}
        </button>
      </div>
      <div className="actions-row" style={{ marginTop: "0.5rem" }}>
        <button type="button" className="button-block" disabled={gaveUp || pending !== null} onClick={() => run("giveup", giveUpAction)}>
          {gaveUp ? "ギブアップ済み（手動編集可）" : "ギブアップ（手動編集を解放）"}
        </button>
      </div>
      <div className="actions-row" style={{ marginTop: "0.5rem" }}>
        <button
          type="button"
          className="button-block"
          disabled={pending !== null}
          onClick={() => run("reschedule", reschedulePlanAction)}
        >
          今日以降を再計画
        </button>
      </div>

      {showRerollMachine && (
        <div className="gacha-reroll-overlay">
          <GachaMachine
            mode="reroll"
            medalsRemaining={1}
            streakDays={streakDays}
            action={rerollAction}
            onComplete={() => {
              setShowRerollMachine(false);
              router.refresh();
            }}
          />
        </div>
      )}
    </div>
  );
}
