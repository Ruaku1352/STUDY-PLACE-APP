"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RevealButton({
  revealAction,
  streakDays,
}: {
  revealAction: () => Promise<void>;
  streakDays: number;
}) {
  const [flipping, setFlipping] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const router = useRouter();

  async function handleReveal() {
    setFlipping(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    await revealAction();
    setRevealed(true);
    await new Promise((resolve) => setTimeout(resolve, 900));
    router.refresh();
  }

  return (
    <div className="gacha-card">
      <div className={`gacha-emoji${flipping ? " flipping" : ""}`}>🎁</div>
      {revealed ? <p>🔥 {streakDays}日目！</p> : <p>今日のスケジュールはまだ開封されていません</p>}
      <button type="button" className="button-primary" onClick={handleReveal} disabled={flipping}>
        {flipping ? "開封中..." : "開封する"}
      </button>
    </div>
  );
}
