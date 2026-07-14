/**
 * ガチャマシンの論理座標系とMatter.js物理定数。
 * Canvas/SVGとも同じ論理サイズ（STAGE_WIDTH x STAGE_HEIGHT）のviewBox/解像度で描画し、
 * CSSで実画面幅に拡大縮小する（物理演算は常にこの論理座標系で行う）。
 */

// 論理ステージ全体のサイズ（縦長）
export const STAGE_WIDTH = 300;
export const STAGE_HEIGHT = 520;

// ドーム（透明ケース）。台（筐体）より少し横長になるよう、筐体幅(260)より広めの楕円にしてある。
export const DOME_CENTER_X = STAGE_WIDTH / 2;
export const DOME_CENTER_Y = 150;
export const DOME_RADIUS_X = 138;
export const DOME_RADIUS_Y = 104;
export const DOME_WALL_SEGMENTS = 22; // 楕円を近似する静的セグメント数
// カプセル半径(26)より薄いとまれにトンネリングしうるため、カプセル半径以上の厚みを持たせる
export const DOME_WALL_THICKNESS = 28;

// ドーム最下部中央の壁の隙間（ゲート用）の半幅。DOME_RADIUS_Xが変わっても
// ゲート/シュートの幅より確実に広い隙間になるよう、角度ではなく実寸で管理する。
export const DOME_BOTTOM_GAP_HALF_WIDTH = 56;

// 排出ゲート（ドーム最下部の堰き止め）。壁の隙間を確実に覆えるよう少し広めに取る。
export const GATE_WIDTH = 70;
export const GATE_HEIGHT = 8;
export const GATE_Y = DOME_CENTER_Y + DOME_RADIUS_Y - 6;

// ドーム上部の銀色の蓋（瓶の蓋を横から見た形）。
// ドームの楕円の上部を蓋の高さぶんだけ「平らに切った」形にし、蓋と一体化させる
// （蓋の両端がそのまま楕円の側面につながるので、継ぎ目のない1つの輪郭になる）。
export const LID_CUT_RATIO = 0.78; // 楕円の上端からどのくらいの高さで切るか（1に近いほど頂点に近い）
export const LID_CUT_Y = DOME_CENTER_Y - DOME_RADIUS_Y * LID_CUT_RATIO;
export const LID_BAND_HEIGHT = 24; // 蓋自体の高さ（切り口から上に伸びる分）

// 排出シュート（ゲートの下から排出口窓まで、左右の傾斜壁）。カプセル直径(52)が
// 余裕を持って通れるよう、ゲートより広めに取る。
export const CHUTE_TOP_Y = GATE_Y + 4;
export const CHUTE_BOTTOM_Y = 372;
export const CHUTE_TOP_HALF_WIDTH = 38;
export const CHUTE_BOTTOM_HALF_WIDTH = 46;
export const CHUTE_WALL_THICKNESS = 28;

// 排出完了とみなすY座標（このYを超えたカプセルは物理的に排出口へ着地したとみなす）
export const WINDOW_LANDED_Y = CHUTE_BOTTOM_Y + 14;

// Matter.js Canvasの高さ（ドーム〜シュート〜排出口窓まで。筐体本体より下はSVGのみで描画する）
export const CANVAS_HEIGHT = 420;

// カプセル（メダルと同じ大きさ感になるよう大きめに設定）
export const CAPSULE_RADIUS = 26;
export const CAPSULE_COUNT = 12;

// 筐体（SVG）レイアウト。MachineBody.tsx / GachaMachine.tsx 双方から参照する共有座標。
export const CABINET_TOP = 258;
export const CABINET_HEIGHT = 250;
export const CABINET_X = 20;
export const CABINET_WIDTH = STAGE_WIDTH - CABINET_X * 2;
export const CABINET_RX = 18;

// ドームと筐体をつなぐ首（リング状の土台）。筐体の開始位置(CABINET_TOP)まで
// 隙間なく届く高さにして、ドームが筐体に接着して見えるようにする。
export const COLLAR_HALF_WIDTH = 70;
export const COLLAR_TOP = DOME_CENTER_Y + DOME_RADIUS_Y - 20;
export const COLLAR_HEIGHT = CABINET_TOP - COLLAR_TOP + 10;

export const WINDOW_X = 95;
export const WINDOW_Y = 345;
export const WINDOW_WIDTH = 110;
export const WINDOW_HEIGHT = 63;
export const WINDOW_RX = 10;

export const KNOB_CX = STAGE_WIDTH / 2;
export const KNOB_CY = 312;
export const KNOB_R = 26;

export const COIN_SLOT_CX = KNOB_CX;
export const COIN_SLOT_CY = KNOB_CY - 34 + 11; // スリット中心

// パーセント座標（レスポンシブなDOMアニメーションで使う。ステージのwidth/heightに対する割合）
export const COIN_SLOT_PERCENT = { x: (COIN_SLOT_CX / STAGE_WIDTH) * 100, y: (COIN_SLOT_CY / STAGE_HEIGHT) * 100 };
export const MEDAL_DOCK_PERCENT = { x: 50, y: 90 }; // タップ前のメダル待機位置
export const WINDOW_CENTER_PERCENT = {
  x: ((WINDOW_X + WINDOW_WIDTH / 2) / STAGE_WIDTH) * 100,
  y: ((WINDOW_Y + WINDOW_HEIGHT / 2) / STAGE_HEIGHT) * 100,
};

// Matter.js物理パラメータ（チューニング用に外出し）
export const RESTITUTION = 0.55; // 反発係数
export const FRICTION = 0.05;
export const FRICTION_AIR = 0.012;
export const GRAVITY_Y = 1.0; // 通常時の重力スケール
export const STIR_FORCE_MIN = 0.012;
export const STIR_FORCE_MAX = 0.028;

// Canvasの物理更新レート
export const PHYSICS_FPS = 60;
