"use client";

import { useId } from "react";
import {
  DOME_GLASS_HIGHLIGHT,
  KNOB_COLOR,
  KNOB_GROOVE_COLOR,
  LID_SILVER,
  LID_SILVER_DARK,
  LID_SILVER_HIGHLIGHT,
  MACHINE_BODY_COLOR,
  MACHINE_BODY_DARK_COLOR,
  WINDOW_INTERIOR_COLOR,
} from "./colors";
import {
  CABINET_HEIGHT,
  CABINET_RX,
  CABINET_TOP,
  CABINET_WIDTH,
  CABINET_X,
  COLLAR_HALF_WIDTH,
  COLLAR_HEIGHT,
  COLLAR_TOP,
  DOME_CENTER_X,
  DOME_CENTER_Y,
  DOME_RADIUS_X,
  DOME_RADIUS_Y,
  KNOB_CX,
  KNOB_CY,
  KNOB_R,
  LID_BAND_HEIGHT,
  LID_CUT_Y,
  STAGE_HEIGHT,
  STAGE_WIDTH,
  WINDOW_HEIGHT,
  WINDOW_RX,
  WINDOW_WIDTH,
  WINDOW_X,
  WINDOW_Y,
} from "./physics";

/**
 * 上部を高さflatYで水平に切り落とした楕円の輪郭パスを返す。
 * 蓋（横から見た平らな上面）と楕円（ドームの側面）を継ぎ目なく1つの輪郭として繋げるために使う。
 * flatYの位置でのx方向の交点をそのまま直線の両端に使うため、直線と弧が同じ点でつながる。
 */
function flatTopEllipsePath(cx: number, cy: number, rx: number, ry: number, flatY: number): string {
  const sinT = Math.max(-1, Math.min(1, (flatY - cy) / ry));
  const cosT = Math.sqrt(Math.max(0, 1 - sinT * sinT));
  const halfWidth = rx * cosT;
  const leftX = cx - halfWidth;
  const rightX = cx + halfWidth;
  return `M ${leftX} ${flatY} L ${rightX} ${flatY} A ${rx} ${ry} 0 1 1 ${leftX} ${flatY} Z`;
}

/**
 * ドーム背景・排出口窓の暗い内側など、Matter.js Canvasの「後ろ」に置くレイヤー。
 * 背景は独立コンポーネントなので、後から差し替え可能。
 */
export function MachineBackLayer({ className }: { className?: string }) {
  const gradId = useId();
  return (
    <svg
      viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`}
      className={className}
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      <defs>
        <radialGradient id={gradId} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="var(--surface)" />
          <stop offset="100%" stopColor="var(--background)" />
        </radialGradient>
      </defs>
      {/* ドーム越しにうっすら透ける背景（差し替え可能なプレースホルダ） */}
      <ellipse cx={DOME_CENTER_X} cy={DOME_CENTER_Y} rx={DOME_RADIUS_X - 2} ry={DOME_RADIUS_Y - 2} fill={`url(#${gradId})`} />
      {/* 排出口窓の暗い内側 */}
      <rect x={WINDOW_X} y={WINDOW_Y} width={WINDOW_WIDTH} height={WINDOW_HEIGHT} rx={WINDOW_RX} fill={WINDOW_INTERIOR_COLOR} />
    </svg>
  );
}

export function MachineFrontLayer({
  knobRotating,
  ejecting,
  className,
}: {
  knobRotating: boolean;
  ejecting: boolean;
  className?: string;
}) {
  const maskId = useId();
  const glassGradId = useId();

  // 蓋（帯）の幅は、ドーム外周の楕円をLID_CUT_Yで切った幅に合わせ、継ぎ目なく繋がって見えるようにする
  const lidSinT = Math.max(-1, Math.min(1, (LID_CUT_Y - DOME_CENTER_Y) / DOME_RADIUS_Y));
  const lidBandHalfWidth = DOME_RADIUS_X * Math.sqrt(Math.max(0, 1 - lidSinT * lidSinT));

  return (
    <svg
      viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`}
      className={className}
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <defs>
        <mask id={maskId}>
          <rect x={CABINET_X} y={CABINET_TOP} width={CABINET_WIDTH} height={CABINET_HEIGHT} rx={CABINET_RX} fill="white" />
          <rect x={WINDOW_X - 4} y={WINDOW_Y - 4} width={WINDOW_WIDTH + 8} height={WINDOW_HEIGHT + 8} rx={WINDOW_RX} fill="black" />
        </mask>
        <radialGradient id={glassGradId} cx="32%" cy="26%" r="85%">
          <stop offset="0%" stopColor="rgba(255, 255, 255, 0.16)" />
          <stop offset="55%" stopColor="rgba(255, 255, 255, 0.04)" />
          <stop offset="100%" stopColor="rgba(67, 56, 202, 0.10)" />
        </radialGradient>
      </defs>

      {/* ドームと筐体をつなぐ首（リング状の土台）。筐体まで隙間なく届く高さにして接着させる。 */}
      <rect
        x={DOME_CENTER_X - COLLAR_HALF_WIDTH}
        y={COLLAR_TOP}
        width={COLLAR_HALF_WIDTH * 2}
        height={COLLAR_HEIGHT}
        rx={17}
        fill={MACHINE_BODY_DARK_COLOR}
      />
      <rect
        x={DOME_CENTER_X - COLLAR_HALF_WIDTH}
        y={COLLAR_TOP}
        width={COLLAR_HALF_WIDTH * 2}
        height={10}
        rx={5}
        fill={MACHINE_BODY_COLOR}
        opacity={0.5}
      />

      {/* ドームのガラス表現（台に合わせて楕円形に、上部は蓋の高さぶん平らに切って蓋と一体化させる）:
          筐体と同系色の太い縁取り＋内側ベゼル＋グラデーションの光沢 */}
      <path d={flatTopEllipsePath(DOME_CENTER_X, DOME_CENTER_Y, DOME_RADIUS_X - 4, DOME_RADIUS_Y - 4, LID_CUT_Y)} fill={`url(#${glassGradId})`} />
      <path
        d={flatTopEllipsePath(DOME_CENTER_X, DOME_CENTER_Y, DOME_RADIUS_X, DOME_RADIUS_Y, LID_CUT_Y)}
        fill="none"
        stroke={MACHINE_BODY_DARK_COLOR}
        strokeWidth={11}
        strokeLinejoin="round"
      />
      <path
        d={flatTopEllipsePath(DOME_CENTER_X, DOME_CENTER_Y, DOME_RADIUS_X - 7, DOME_RADIUS_Y - 7, LID_CUT_Y)}
        fill="none"
        stroke="rgba(255, 255, 255, 0.4)"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <path
        d={flatTopEllipsePath(DOME_CENTER_X, DOME_CENTER_Y, DOME_RADIUS_X - 4.5, DOME_RADIUS_Y - 4.5, LID_CUT_Y)}
        fill="none"
        stroke={MACHINE_BODY_COLOR}
        strokeWidth={3}
        strokeLinejoin="round"
        opacity={0.9}
      />

      {/* ガラスのハイライト（大きめの弧＋小さな輝き） */}
      <path
        d={`M ${DOME_CENTER_X - DOME_RADIUS_X * 0.6} ${DOME_CENTER_Y - DOME_RADIUS_Y * 0.5}
            A ${DOME_RADIUS_X * 0.82} ${DOME_RADIUS_Y * 0.82} 0 0 1 ${DOME_CENTER_X + DOME_RADIUS_X * 0.05} ${DOME_CENTER_Y - DOME_RADIUS_Y * 0.78}`}
        fill="none"
        stroke={DOME_GLASS_HIGHLIGHT}
        strokeWidth={12}
        strokeLinecap="round"
      />
      <ellipse
        cx={DOME_CENTER_X - DOME_RADIUS_X * 0.42}
        cy={DOME_CENTER_Y - DOME_RADIUS_Y * 0.32}
        rx={7}
        ry={11}
        fill="rgba(255, 255, 255, 0.55)"
        transform={`rotate(-25 ${DOME_CENTER_X - DOME_RADIUS_X * 0.42} ${DOME_CENTER_Y - DOME_RADIUS_Y * 0.32})`}
      />

      {/* ドーム上部の銀色の蓋。瓶の蓋を横から見た形（上面は描かず、側面の帯として表現する）。
          帯の幅は、ドーム楕円をLID_CUT_Yで切った幅にぴったり合わせ、継ぎ目なく繋がって見えるようにする。 */}
      <rect
        x={DOME_CENTER_X - lidBandHalfWidth}
        y={LID_CUT_Y - LID_BAND_HEIGHT}
        width={lidBandHalfWidth * 2}
        height={LID_BAND_HEIGHT + 4}
        rx={6}
        fill={LID_SILVER}
      />
      <rect
        x={DOME_CENTER_X - lidBandHalfWidth}
        y={LID_CUT_Y - LID_BAND_HEIGHT}
        width={lidBandHalfWidth * 2}
        height={7}
        rx={6}
        fill={LID_SILVER_HIGHLIGHT}
      />
      <rect
        x={DOME_CENTER_X - lidBandHalfWidth}
        y={LID_CUT_Y - 5}
        width={lidBandHalfWidth * 2}
        height={5}
        fill={LID_SILVER_DARK}
        opacity={0.7}
      />
      {/* 瓶の蓋らしいクリンプ（縁のギザギザ）を側面の縦線で表現 */}
      {Array.from({ length: 9 }, (_, i) => {
        const t = (i + 1) / 10;
        const x = DOME_CENTER_X - lidBandHalfWidth + lidBandHalfWidth * 2 * t;
        return (
          <line
            key={i}
            x1={x}
            y1={LID_CUT_Y - LID_BAND_HEIGHT + 6}
            x2={x}
            y2={LID_CUT_Y - 2}
            stroke={LID_SILVER_DARK}
            strokeWidth={1.5}
            opacity={0.45}
          />
        );
      })}

      {/* 筐体本体（排出口窓は穴あき） */}
      <rect
        x={CABINET_X}
        y={CABINET_TOP}
        width={CABINET_WIDTH}
        height={CABINET_HEIGHT}
        rx={CABINET_RX}
        fill={MACHINE_BODY_COLOR}
        mask={`url(#${maskId})`}
      />
      <rect
        x={CABINET_X}
        y={CABINET_TOP + CABINET_HEIGHT - 70}
        width={CABINET_WIDTH}
        height={70}
        rx={CABINET_RX}
        fill={MACHINE_BODY_DARK_COLOR}
        opacity={0.35}
        mask={`url(#${maskId})`}
      />

      {/* 金属プレート */}
      <rect x={KNOB_CX - 90} y={KNOB_CY - 40} width={180} height={80} rx={12} fill="var(--border)" opacity={0.9} />

      {/* メダル投入口（縦スリット） */}
      <rect x={KNOB_CX - 5} y={KNOB_CY - 34} width={10} height={22} rx={4} fill="#171717" />

      {/* 回転ノブ（アニメーションはこのgに親からclassを付けて回転させる） */}
      <g
        className={`gacha-knob-group${knobRotating ? " gacha-knob-group-spin" : ""}`}
        style={{ transformOrigin: `${KNOB_CX}px ${KNOB_CY}px` }}
      >
        <circle cx={KNOB_CX} cy={KNOB_CY} r={KNOB_R} fill={KNOB_COLOR} stroke={KNOB_GROOVE_COLOR} strokeWidth={2} />
        <rect x={KNOB_CX - KNOB_R + 6} y={KNOB_CY - 2.5} width={(KNOB_R - 6) * 2} height={5} rx={2.5} fill={KNOB_GROOVE_COLOR} />
      </g>

      {/* 排出口窓の枠とフタ */}
      <rect
        x={WINDOW_X}
        y={WINDOW_Y}
        width={WINDOW_WIDTH}
        height={WINDOW_HEIGHT}
        rx={WINDOW_RX}
        fill="none"
        stroke={MACHINE_BODY_DARK_COLOR}
        strokeWidth={5}
      />
      <rect
        className={`gacha-window-flap${ejecting ? " gacha-window-flap-pop" : ""}`}
        x={WINDOW_X + 6}
        y={WINDOW_Y + 4}
        width={WINDOW_WIDTH - 12}
        height={9}
        rx={4}
        fill={MACHINE_BODY_DARK_COLOR}
        style={{ transformOrigin: `${WINDOW_X + WINDOW_WIDTH / 2}px ${WINDOW_Y + 8}px` }}
      />

      {/* 脚 */}
      <rect x={CABINET_X + 25} y={CABINET_TOP + CABINET_HEIGHT - 4} width={20} height={14} rx={3} fill={MACHINE_BODY_DARK_COLOR} />
      <rect
        x={CABINET_X + CABINET_WIDTH - 45}
        y={CABINET_TOP + CABINET_HEIGHT - 4}
        width={20}
        height={14}
        rx={3}
        fill={MACHINE_BODY_DARK_COLOR}
      />
    </svg>
  );
}
