"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RevealButton({
  revealAction,
  streakDays,
}: {
  revealAction: () => Promise<{ missionText: string }>;
  streakDays: number;
}) {
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<{ missionText: string } | null>(null);
  const router = useRouter();

  async function handleReveal() {
    setFlipping(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const revealResult = await revealAction();
    setResult(revealResult);
    await new Promise((resolve) => setTimeout(resolve, 1600));
    router.refresh();
  }

  return (
    <div className="gacha-card">
      <div className={`gacha-emoji${flipping ? " flipping" : ""}`}>🎁</div>
      {result ? (
        <div className="stack">
          <p>🔥 {streakDays}日目！</p>
          <p>{result.missionText}</p>
        </div>
      ) : (
        <p>今日のスケジュールはまだ開封されていません</p>
      )}
      <button type="button" className="button-primary" onClick={handleReveal} disabled={flipping}>
        {flipping ? "開封中..." : "開封する"}
      </button>
    </div>
  );
}
