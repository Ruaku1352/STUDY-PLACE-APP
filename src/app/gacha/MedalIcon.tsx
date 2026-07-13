"use client";

import { useId } from "react";
import { MEDAL_GOLD, MEDAL_GOLD_RIM } from "./colors";

/** 金貨メダルのSVGアイコン。sm=ステータスバー用、lg=投入演出用。 */
export function MedalIcon({ size = "sm", className }: { size?: "sm" | "lg"; className?: string }) {
  const clipId = useId();
  const px = size === "lg" ? 64 : 24;

  return (
    <svg viewBox="0 0 40 40" width={px} height={px} className={className} aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <circle cx="20" cy="20" r="15" />
        </clipPath>
      </defs>
      <circle cx="20" cy="20" r="18" fill={MEDAL_GOLD_RIM} />
      <circle cx="20" cy="20" r="15" fill={MEDAL_GOLD} />
      <g clipPath={`url(#${clipId})`}>
        <rect x="9" y="4" width="7" height="34" fill="rgba(255, 255, 255, 0.45)" transform="rotate(-25 20 20)" />
      </g>
      <circle cx="20" cy="20" r="15" fill="none" stroke="rgba(0, 0, 0, 0.18)" strokeWidth="1" />
    </svg>
  );
}
