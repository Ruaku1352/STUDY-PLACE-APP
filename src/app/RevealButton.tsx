"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RevealButton({ revealAction }: { revealAction: () => Promise<void> }) {
  const [flipping, setFlipping] = useState(false);
  const router = useRouter();

  async function handleReveal() {
    setFlipping(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    await revealAction();
    router.refresh();
  }

  return (
    <div className="gacha-card">
      <div className={`gacha-emoji${flipping ? " flipping" : ""}`}>🎁</div>
      <p>今日のスケジュールはまだ開封されていません</p>
      <button type="button" className="button-primary" onClick={handleReveal} disabled={flipping}>
        {flipping ? "開封中..." : "開封する"}
      </button>
    </div>
  );
}
