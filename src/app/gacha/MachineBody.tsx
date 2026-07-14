"use client";

import { useId } from "react";
import {
  DOME_GLASS_HIGHLIGHT,
  KNOB_COLOR,
  KNOB_GROOVE_COLOR,
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
  DOME_CENTER_X,
  DOME_CENTER_Y,
  DOME_RADIUS,
  KNOB_CX,
  KNOB_CY,
  KNOB_R,
  STAGE_HEIGHT,
  STAGE_WIDTH,
  WINDOW_HEIGHT,
  WINDOW_RX,
  WINDOW_WIDTH,
  WINDOW_X,
  WINDOW_Y,
} from "./physics";

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
      <circle cx={DOME_CENTER_X} cy={DOME_CENTER_Y} r={DOME_RADIUS - 2} fill={`url(#${gradId})`} />
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

      {/* ドームと筐体をつなぐリング状の土台（筐体と同系色で一体感を出す） */}
      <rect
        x={DOME_CENTER_X - 54}
        y={DOME_CENTER_Y + DOME_RADIUS - 20}
        width={108}
        height={34}
        rx={17}
        fill={MACHINE_BODY_DARK_COLOR}
      />
      <rect
        x={DOME_CENTER_X - 54}
        y={DOME_CENTER_Y + DOME_RADIUS - 20}
        width={108}
        height={10}
        rx={5}
        fill={MACHINE_BODY_COLOR}
        opacity={0.5}
      />

      {/* ドームのガラス表現: 筐体と同系色の太い縁取り＋内側ベゼル＋グラデーションの光沢 */}
      <circle cx={DOME_CENTER_X} cy={DOME_CENTER_Y} r={DOME_RADIUS - 4} fill={`url(#${glassGradId})`} />
      <circle
        cx={DOME_CENTER_X}
        cy={DOME_CENTER_Y}
        r={DOME_RADIUS}
        fill="none"
        stroke={MACHINE_BODY_DARK_COLOR}
        strokeWidth={11}
      />
      <circle
        cx={DOME_CENTER_X}
        cy={DOME_CENTER_Y}
        r={DOME_RADIUS - 7}
        fill="none"
        stroke="rgba(255, 255, 255, 0.4)"
        strokeWidth={2}
      />
      <circle
        cx={DOME_CENTER_X}
        cy={DOME_CENTER_Y}
        r={DOME_RADIUS - 4.5}
        fill="none"
        stroke={MACHINE_BODY_COLOR}
        strokeWidth={3}
        opacity={0.9}
      />

      {/* ガラスのハイライト（大きめの弧＋小さな輝き） */}
      <path
        d={`M ${DOME_CENTER_X - DOME_RADIUS * 0.6} ${DOME_CENTER_Y - DOME_RADIUS * 0.66}
            A ${DOME_RADIUS * 0.82} ${DOME_RADIUS * 0.82} 0 0 1 ${DOME_CENTER_X + DOME_RADIUS * 0.1} ${DOME_CENTER_Y - DOME_RADIUS * 0.95}`}
        fill="none"
        stroke={DOME_GLASS_HIGHLIGHT}
        strokeWidth={12}
        strokeLinecap="round"
      />
      <ellipse
        cx={DOME_CENTER_X - DOME_RADIUS * 0.42}
        cy={DOME_CENTER_Y - DOME_RADIUS * 0.5}
        rx={7}
        ry={11}
        fill="rgba(255, 255, 255, 0.55)"
        transform={`rotate(-25 ${DOME_CENTER_X - DOME_RADIUS * 0.42} ${DOME_CENTER_Y - DOME_RADIUS * 0.5})`}
      />

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
