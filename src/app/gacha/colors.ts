/**
 * ガチャマシンUI全体で共有するデザイントークン（配色・線幅・角丸）。
 * 手描き風のポップなタッチに統一するため、色は「ベース／ハイライト／縁（濃色）」の
 * 3段（PastelTriad）で定義し、全パーツがここを参照する。個別のパーツで色や線幅を
 * 決め打ちしないことで、トーンのブレを防ぐ。
 */

export interface PastelTriad {
  base: string;
  highlight: string;
  edge: string;
}

/** カプセルの配色パレット。手描き風のポップな質感を保ちつつ、実物のカプセルトイらしい
 * 明るくビビッドな色にしている（筐体等の落ち着いたパステルとは別トーン）。 */
export const CAPSULE_PALETTE: PastelTriad[] = [
  { base: "#8b96fa", highlight: "#e2e6ff", edge: "#4f56c9" }, // ブルー
  { base: "#5fe0a0", highlight: "#d8fbe9", edge: "#1f9d63" }, // グリーン
  { base: "#ffcf4d", highlight: "#fff3cf", edge: "#e0940a" }, // イエロー
  { base: "#ff85c2", highlight: "#ffe0f0", edge: "#d63d8f" }, // ピンク
  { base: "#ff9d52", highlight: "#ffe3cc", edge: "#d9650f" }, // オレンジ
];

/** 後方互換用（カプセルのベース色のみの配列）。 */
export const CAPSULE_HUES = CAPSULE_PALETTE.map((c) => c.base);

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

// 筐体（パステルなインディゴ）
export const MACHINE_BODY: PastelTriad = { base: "#c7cdf9", highlight: "#f1f2ff", edge: "#6d72d6" };
// 後方互換の単色エイリアス
export const MACHINE_BODY_COLOR = MACHINE_BODY.base;
export const MACHINE_BODY_DARK_COLOR = MACHINE_BODY.edge;

export const DOME_GLASS_HIGHLIGHT = "rgba(255, 255, 255, 0.65)";

// ノブ・メダル（パステルゴールド）
export const KNOB_PASTEL: PastelTriad = { base: "#fbe1a0", highlight: "#fff6df", edge: "#d99a2b" };
export const KNOB_COLOR = KNOB_PASTEL.base;
export const KNOB_GROOVE_COLOR = KNOB_PASTEL.edge;
export const MEDAL_GOLD = KNOB_PASTEL.base;
export const MEDAL_GOLD_RIM = KNOB_PASTEL.edge;

export const WINDOW_INTERIOR_COLOR = "#332f4a"; // 排出口窓の暗い内側（パステル基調に馴染む紫がかった濃紺）

// ドーム上部の銀色の蓋
export const LID_PASTEL: PastelTriad = { base: "#e6e9f0", highlight: "#fbfcfd", edge: "#9aa3b5" };
export const LID_SILVER = LID_PASTEL.base;
export const LID_SILVER_DARK = LID_PASTEL.edge;
export const LID_SILVER_HIGHLIGHT = "rgba(255, 255, 255, 0.8)";

/** 角丸の共通トークン。パーツごとにバラバラなrxを決め打ちしないための一元値。 */
export const RADIUS = { sm: 6, md: 12, lg: 18, xl: 24 } as const;

/**
 * 手描き風の太い縁取り線幅を、要素サイズ（直径・幅など代表寸法）の比率で返す。
 * 目安は要素サイズの3〜5%（デフォルト4%）。小さすぎる要素でも視認できるよう下限を設ける。
 */
export function outlineWidth(size: number, ratio = 0.04): number {
  return Math.max(2, size * ratio);
}
