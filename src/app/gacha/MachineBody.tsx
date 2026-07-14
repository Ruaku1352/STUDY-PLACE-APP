"use client";

import { useId } from "react";
import {
  DOME_GLASS_HIGHLIGHT,
  KNOB_GROOVE_COLOR,
  KNOB_PASTEL,
  LID_PASTEL,
  LID_SILVER,
  LID_SILVER_DARK,
  LID_SILVER_HIGHLIGHT,
  MACHINE_BODY,
  MACHINE_BODY_COLOR,
  MACHINE_BODY_DARK_COLOR,
  outlineWidth,
  RADIUS,
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
 * 背景の具体的なシーン（丘や空など）はアプリ全体の画面デザインとあわせて検討するため
 * 一旦保留し、テーマ変数に追従するニュートラルな見た目のプレースホルダに留めている。
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
      {/* ドーム越しにうっすら透ける背景（差し替え可能なプレースホルダ）。
          前面レイヤーのガラスと同じくLID_CUT_Yで上部を平らに切り、蓋の上に飛び出さないようにする。 */}
      <path d={flatTopEllipsePath(DOME_CENTER_X, DOME_CENTER_Y, DOME_RADIUS_X - 2, DOME_RADIUS_Y - 2, LID_CUT_Y)} fill={`url(#${gradId})`} />
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
  const ginghamId = useId();
  const metalGradId = useId();
  const domeClipId = useId();
  const glassClipId = useId();
  const knobClipId = useId();

  // 蓋（帯）の幅は、ドーム外周の楕円をLID_CUT_Yで切った幅に合わせ、継ぎ目なく繋がって見えるようにする
  const lidSinT = Math.max(-1, Math.min(1, (LID_CUT_Y - DOME_CENTER_Y) / DOME_RADIUS_Y));
  const lidBandHalfWidth = DOME_RADIUS_X * Math.sqrt(Math.max(0, 1 - lidSinT * lidSinT));
  // 蓋（帯）の下端。ドーム側（ガラス・縁取り・ベゼル等）はここより上を一切描画しない
  // （太い縁取り線のはみ出しやジョイントの丸みで蓋の外に飛び出すのを防ぐため、
  // 個々のパスの形状に頼らずclipPathで強制的に切り落とす）。
  const lidBandBottomY = LID_CUT_Y + 4;

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
        {/* 筐体の控えめなギンガムチェック風テクスチャ（薄い白の縦横帯を重ねて3段の市松に見せる） */}
        <pattern id={ginghamId} width={18} height={18} patternUnits="userSpaceOnUse">
          <rect width={18} height={18} fill="none" />
          <rect width={18} height={9} fill="rgba(255, 255, 255, 0.10)" />
          <rect width={9} height={18} fill="rgba(255, 255, 255, 0.10)" />
        </pattern>
        {/* 金属部のブラシ調グラデーション（プレート・ノブ共通） */}
        <linearGradient id={metalGradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={KNOB_PASTEL.highlight} />
          <stop offset="18%" stopColor={KNOB_PASTEL.base} />
          <stop offset="34%" stopColor={KNOB_PASTEL.highlight} />
          <stop offset="50%" stopColor={KNOB_PASTEL.base} />
          <stop offset="66%" stopColor={KNOB_PASTEL.highlight} />
          <stop offset="82%" stopColor={KNOB_PASTEL.base} />
          <stop offset="100%" stopColor={KNOB_PASTEL.highlight} />
        </linearGradient>
        {/* 蓋より上をドーム側が一切描画しないようにするクリップ（蓋の下端から下だけを許可） */}
        <clipPath id={domeClipId}>
          <rect x={0} y={lidBandBottomY} width={STAGE_WIDTH} height={STAGE_HEIGHT - lidBandBottomY} />
        </clipPath>
        {/* ガラスのハイライト（縦のハイライト帯等）がガラスの輪郭からはみ出さないようにするクリップ */}
        <clipPath id={glassClipId}>
          <path d={flatTopEllipsePath(DOME_CENTER_X, DOME_CENTER_Y, DOME_RADIUS_X - 4, DOME_RADIUS_Y - 4, LID_CUT_Y)} />
        </clipPath>
        {/* ノブの陰影（下側の影・上側のハイライト）が円からはみ出さないようにするクリップ */}
        <clipPath id={knobClipId}>
          <circle cx={KNOB_CX} cy={KNOB_CY} r={KNOB_R} />
        </clipPath>
      </defs>

      {/* ドームと筐体をつなぐ首（リング状の土台）。筐体まで隙間なく届く高さにして接着させる。 */}
      <rect
        x={DOME_CENTER_X - COLLAR_HALF_WIDTH}
        y={COLLAR_TOP}
        width={COLLAR_HALF_WIDTH * 2}
        height={COLLAR_HEIGHT}
        rx={RADIUS.lg}
        fill={MACHINE_BODY_DARK_COLOR}
      />
      <rect
        x={DOME_CENTER_X - COLLAR_HALF_WIDTH}
        y={COLLAR_TOP}
        width={COLLAR_HALF_WIDTH * 2}
        height={10}
        rx={RADIUS.sm}
        fill={MACHINE_BODY_COLOR}
        opacity={0.5}
      />

      {/* ドームのガラス表現（台に合わせて楕円形に、上部は蓋の高さぶん平らに切って蓋と一体化させる）:
          筐体と同系色の太い縁取り＋内側ベゼル＋グラデーションの光沢。
          太い縁取り線のはみ出しで蓋の外に飛び出さないよう、蓋の下端から上をclipPathで強制的に切り落とす。 */}
      <g clipPath={`url(#${domeClipId})`}>
        <path d={flatTopEllipsePath(DOME_CENTER_X, DOME_CENTER_Y, DOME_RADIUS_X - 4, DOME_RADIUS_Y - 4, LID_CUT_Y)} fill={`url(#${glassGradId})`} />
        <path
          d={flatTopEllipsePath(DOME_CENTER_X, DOME_CENTER_Y, DOME_RADIUS_X, DOME_RADIUS_Y, LID_CUT_Y)}
          fill="none"
          stroke={MACHINE_BODY_DARK_COLOR}
          strokeWidth={outlineWidth(DOME_RADIUS_X * 2)}
          strokeLinejoin="round"
        />
        <path
          d={flatTopEllipsePath(DOME_CENTER_X, DOME_CENTER_Y, DOME_RADIUS_X - 7, DOME_RADIUS_Y - 7, LID_CUT_Y)}
          fill="none"
          stroke="rgba(255, 255, 255, 0.5)"
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

        {/* 縁に沿った反射光（外周に近いところを弧で這わせる、メインのハイライトとは反対側） */}
        <path
          d={`M ${DOME_CENTER_X + DOME_RADIUS_X * 0.55} ${DOME_CENTER_Y - DOME_RADIUS_Y * 0.7}
              A ${DOME_RADIUS_X * 0.92} ${DOME_RADIUS_Y * 0.92} 0 0 1 ${DOME_CENTER_X + DOME_RADIUS_X * 0.85} ${DOME_CENTER_Y - DOME_RADIUS_Y * 0.1}`}
          fill="none"
          stroke="rgba(255, 255, 255, 0.35)"
          strokeWidth={5}
          strokeLinecap="round"
        />

        {/* ガラスのハイライト（大きめの弧＋小さな輝き＋縦に走る太いハイライト2本）。
            縦帯はガラスの輪郭からはみ出さないようglassClipIdでクリップする。 */}
        <g clipPath={`url(#${glassClipId})`}>
          <rect
            x={DOME_CENTER_X - DOME_RADIUS_X * 0.5}
            y={LID_CUT_Y + 14}
            width={DOME_RADIUS_X * 0.22}
            height={DOME_RADIUS_Y * 1.15}
            rx={DOME_RADIUS_X * 0.11}
            fill="rgba(255, 255, 255, 0.3)"
            transform={`rotate(-9 ${DOME_CENTER_X - DOME_RADIUS_X * 0.4} ${DOME_CENTER_Y})`}
          />
          <rect
            x={DOME_CENTER_X + DOME_RADIUS_X * 0.18}
            y={LID_CUT_Y + 24}
            width={DOME_RADIUS_X * 0.12}
            height={DOME_RADIUS_Y * 0.8}
            rx={DOME_RADIUS_X * 0.06}
            fill="rgba(255, 255, 255, 0.18)"
            transform={`rotate(-6 ${DOME_CENTER_X + DOME_RADIUS_X * 0.24} ${DOME_CENTER_Y})`}
          />
        </g>
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
      </g>

      {/* ドーム上部の銀色の蓋。瓶の蓋を横から見た形（上面は描かず、側面の帯として表現する）。
          帯の幅は、ドーム楕円をLID_CUT_Yで切った幅にぴったり合わせ、継ぎ目なく繋がって見えるようにする。 */}
      <rect
        x={DOME_CENTER_X - lidBandHalfWidth}
        y={LID_CUT_Y - LID_BAND_HEIGHT}
        width={lidBandHalfWidth * 2}
        height={LID_BAND_HEIGHT + 4}
        rx={RADIUS.sm}
        fill={LID_SILVER}
        stroke={LID_PASTEL.edge}
        strokeWidth={outlineWidth(lidBandHalfWidth * 2, 0.02)}
      />
      <rect
        x={DOME_CENTER_X - lidBandHalfWidth}
        y={LID_CUT_Y - LID_BAND_HEIGHT}
        width={lidBandHalfWidth * 2}
        height={7}
        rx={RADIUS.sm}
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

      {/* 筐体本体（排出口窓は穴あき）。ベース塗り＋ギンガムチェック風の控えめなテクスチャ＋太い縁取り */}
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
        y={CABINET_TOP}
        width={CABINET_WIDTH}
        height={CABINET_HEIGHT}
        rx={CABINET_RX}
        fill={`url(#${ginghamId})`}
        mask={`url(#${maskId})`}
      />
      <rect
        x={CABINET_X}
        y={CABINET_TOP + CABINET_HEIGHT - 70}
        width={CABINET_WIDTH}
        height={70}
        rx={CABINET_RX}
        fill={MACHINE_BODY_DARK_COLOR}
        opacity={0.28}
        mask={`url(#${maskId})`}
      />
      <rect
        x={CABINET_X}
        y={CABINET_TOP}
        width={CABINET_WIDTH}
        height={CABINET_HEIGHT}
        rx={CABINET_RX}
        fill="none"
        stroke={MACHINE_BODY.edge}
        strokeWidth={outlineWidth(CABINET_WIDTH)}
      />

      {/* 金属プレート：ブラシ調グラデーション＋太い縁取り＋角の丸ネジ4つ */}
      <rect
        x={KNOB_CX - 90}
        y={KNOB_CY - 38}
        width={180}
        height={76}
        rx={RADIUS.md}
        fill={`url(#${metalGradId})`}
        stroke={KNOB_GROOVE_COLOR}
        strokeWidth={outlineWidth(180, 0.02)}
      />
      {[
        [KNOB_CX - 78, KNOB_CY - 28],
        [KNOB_CX + 78, KNOB_CY - 28],
        [KNOB_CX - 78, KNOB_CY + 28],
        [KNOB_CX + 78, KNOB_CY + 28],
      ].map(([sx, sy], i) => (
        <circle key={i} cx={sx} cy={sy} r={4} fill={KNOB_GROOVE_COLOR} opacity={0.6} />
      ))}

      {/* メダル投入口（プレート上部に統合した縦スリット。ノブとは重ならない位置・サイズにする） */}
      <rect
        x={KNOB_CX - 6}
        y={KNOB_CY - 36}
        width={12}
        height={8}
        rx={3}
        fill="#171717"
        stroke={KNOB_GROOVE_COLOR}
        strokeWidth={1.5}
      />
      <rect x={KNOB_CX - 4} y={KNOB_CY - 30.5} width={8} height={1.2} fill="rgba(255, 255, 255, 0.35)" />

      {/* ノブの下に落ちる影（プレートに接地しているような立体感を出す） */}
      <ellipse cx={KNOB_CX} cy={KNOB_CY + KNOB_R * 0.62} rx={KNOB_R * 0.92} ry={KNOB_R * 0.32} fill="rgba(0, 0, 0, 0.16)" />

      {/* 回転ノブ（アニメーションはこのgに親からclassを付けて回転させる） */}
      <g
        className={`gacha-knob-group${knobRotating ? " gacha-knob-group-spin" : ""}`}
        style={{ transformOrigin: `${KNOB_CX}px ${KNOB_CY}px` }}
      >
        <circle
          cx={KNOB_CX}
          cy={KNOB_CY}
          r={KNOB_R}
          fill={`url(#${metalGradId})`}
          stroke={KNOB_GROOVE_COLOR}
          strokeWidth={outlineWidth(KNOB_R * 2)}
        />
        {/* 円の輪郭内だけに収まる下側の陰影＋上側のハイライトで球体らしい立体感を出す */}
        <g clipPath={`url(#${knobClipId})`}>
          <ellipse cx={KNOB_CX} cy={KNOB_CY + KNOB_R * 0.55} rx={KNOB_R * 1.05} ry={KNOB_R * 0.6} fill="rgba(0, 0, 0, 0.14)" />
          <ellipse cx={KNOB_CX - KNOB_R * 0.3} cy={KNOB_CY - KNOB_R * 0.45} rx={KNOB_R * 0.55} ry={KNOB_R * 0.32} fill="rgba(255, 255, 255, 0.45)" />
        </g>
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
        strokeWidth={outlineWidth(WINDOW_WIDTH, 0.045)}
      />
      <rect
        className={`gacha-window-flap${ejecting ? " gacha-window-flap-pop" : ""}`}
        x={WINDOW_X + 6}
        y={WINDOW_Y + 4}
        width={WINDOW_WIDTH - 12}
        height={9}
        rx={RADIUS.sm}
        fill={MACHINE_BODY_DARK_COLOR}
        style={{ transformOrigin: `${WINDOW_X + WINDOW_WIDTH / 2}px ${WINDOW_Y + 8}px` }}
      />

      {/* 脚（小さく丸いポップな見た目に。てっぺんに小さなハイライトを入れる） */}
      {[CABINET_X + 22, CABINET_X + CABINET_WIDTH - 38].map((legX, i) => (
        <g key={i}>
          <rect
            x={legX}
            y={CABINET_TOP + CABINET_HEIGHT - 3}
            width={16}
            height={11}
            rx={5.5}
            fill={MACHINE_BODY_DARK_COLOR}
            stroke={MACHINE_BODY.edge}
            strokeWidth={1.5}
          />
          <ellipse cx={legX + 5} cy={CABINET_TOP + CABINET_HEIGHT + 1} rx={2.6} ry={1.6} fill="rgba(255, 255, 255, 0.35)" />
        </g>
      ))}
    </svg>
  );
}
