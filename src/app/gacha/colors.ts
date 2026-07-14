/**
 * カプセルの配色パレット。既存テーマ（globals.cssの --block-* 系統）から流用し、
 * アプリ全体の配色トーンと統一感を持たせる。
 */
export const CAPSULE_HUES = [
  "#4f46e5", // --block-study (indigo)
  "#10b981", // --block-break (green)
  "#f59e0b", // --block-lunch (amber)
  "#ec4899", // --block-event (pink)
  "#9ca3af", // --block-move (gray)
] as const;

export interface CapsuleColorPair {
  top: string;
  bottom: string;
}

/** 上下2色ハーフの組み合わせをランダムに決める。同じ色2つは避け、毎回2色になるようにする。 */
export function randomCapsuleColorPair(randomFn: () => number = Math.random): CapsuleColorPair {
  const maxIndex = CAPSULE_HUES.length - 1;
  const i = Math.min(Math.floor(randomFn() * CAPSULE_HUES.length), maxIndex);
  let j = Math.min(Math.floor(randomFn() * CAPSULE_HUES.length), maxIndex);
  if (j === i) j = (j + 1) % CAPSULE_HUES.length;
  return { top: CAPSULE_HUES[i], bottom: CAPSULE_HUES[j] };
}

// 筐体・ドーム周りの固定配色（テーマのaccent/warning系に準拠）
export const MACHINE_BODY_COLOR = "#4338ca"; // 筐体本体（濃いaccent）
export const MACHINE_BODY_DARK_COLOR = "#3730a3"; // 影・立体感
export const DOME_GLASS_HIGHLIGHT = "rgba(255, 255, 255, 0.55)";
export const KNOB_COLOR = "#fbbf24"; // 金色ノブ（--warning-border系の暖色）
export const KNOB_GROOVE_COLOR = "#b45309";
export const MEDAL_GOLD = "#fbbf24";
export const MEDAL_GOLD_RIM = "#b45309";
export const WINDOW_INTERIOR_COLOR = "#1f1f2e"; // 排出口窓の暗い内側

// ドーム上部の銀色の蓋
export const LID_SILVER = "#d4d7dd";
export const LID_SILVER_DARK = "#9aa0ab";
export const LID_SILVER_HIGHLIGHT = "rgba(255, 255, 255, 0.7)";
