"use client";

import Matter from "matter-js";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { outlineWidth, randomCapsuleColorPair, type CapsuleColorPair } from "./colors";
import {
  CAPSULE_COUNT,
  CAPSULE_RADIUS,
  CAPSULE_VISUAL_RADIUS,
  CANVAS_HEIGHT,
  CHUTE_BOTTOM_HALF_WIDTH,
  CHUTE_BOTTOM_Y,
  CHUTE_TOP_HALF_WIDTH,
  CHUTE_TOP_Y,
  CHUTE_WALL_THICKNESS,
  DOME_BOTTOM_GAP_HALF_WIDTH,
  DOME_CENTER_X,
  DOME_CENTER_Y,
  DOME_RADIUS_X,
  DOME_RADIUS_Y,
  DOME_WALL_SEGMENTS,
  DOME_WALL_THICKNESS,
  FRICTION,
  FRICTION_AIR,
  GATE_HEIGHT,
  GATE_WIDTH,
  GATE_Y,
  GRAVITY_Y,
  RESTITUTION,
  STAGE_WIDTH,
  STIR_FORCE_MAX,
  STIR_FORCE_MIN,
  WINDOW_LANDED_Y,
} from "./physics";

const CAPSULE_LABEL = "capsule";

/** カプセルの塗り分けパターン。2色ハーフだけでなく数種類混在させて見た目に変化をつける。 */
type CapsulePattern = "horizontal" | "vertical" | "quad";
const CAPSULE_PATTERNS: CapsulePattern[] = ["horizontal", "vertical", "quad"];

interface CapsuleVisual extends CapsuleColorPair {
  pattern: CapsulePattern;
  /** 0(奥)〜1(手前)の疑似奥行き。描画順と明暗の両方に使い、重なりの立体感を出す。 */
  depth: number;
}

function randomCapsuleVisual(): CapsuleVisual {
  const { top, bottom } = randomCapsuleColorPair();
  const pattern = CAPSULE_PATTERNS[Math.floor(Math.random() * CAPSULE_PATTERNS.length)];
  return { top, bottom, pattern, depth: Math.random() };
}

/** #rrggbb形式の色を明度factor倍にする（奥にあるカプセルを少し暗くするため）。 */
function shadeColor(hex: string, factor: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = Math.round(parseInt(m[1], 16) * factor);
  const g = Math.round(parseInt(m[2], 16) * factor);
  const b = Math.round(parseInt(m[3], 16) * factor);
  return `rgb(${r}, ${g}, ${b})`;
}

export interface GachaDomeHandle {
  /** ノブ回転と同時に呼ぶ。ドーム内のカプセル全体をかき混ぜる。 */
  stir: () => void;
  /** ゲートを開き、最初に抜けた1個のカプセルの色を返す（他は自動でドーム内へ戻す）。 */
  eject: () => Promise<CapsuleColorPair>;
}

function wallFromPoints(x1: number, y1: number, x2: number, y2: number, thickness: number, lengthScale = 1): Matter.Body {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy) * lengthScale;
  const angle = Math.atan2(dy, dx);
  return Matter.Bodies.rectangle((x1 + x2) / 2, (y1 + y2) / 2, length, thickness, {
    isStatic: true,
    angle,
    friction: FRICTION,
    restitution: RESTITUTION,
  });
}

/**
 * 楕円形のドーム境界を、隣り合う2点を結ぶ短い矩形（静的セグメント）を連ねて近似する。
 * 楕円は円と違い弧の間隔が一定でないため、角度ではなく隣接2点間の距離・角度から都度算出する。
 */
function createDomeWalls(): Matter.Body[] {
  const walls: Matter.Body[] = [];
  const segAngle = (Math.PI * 2) / DOME_WALL_SEGMENTS;
  // ドーム最下部中央の隙間（ゲート用）を実寸(DOME_BOTTOM_GAP_HALF_WIDTH)で管理する。
  // DOME_RADIUS_Xが変わっても隙間の実際の幅が一定に保たれるよう、角度は都度逆算する。
  const bottomGapHalfAngle = Math.asin(Math.min(1, DOME_BOTTOM_GAP_HALF_WIDTH / DOME_RADIUS_X));

  for (let i = 0; i < DOME_WALL_SEGMENTS; i++) {
    const angleA = i * segAngle;
    const angleB = angleA + segAngle;

    // ドーム最下部中央はゲート用に壁を作らない（出口の隙間）。
    const midAngle = angleA + segAngle / 2;
    const normalizedMid = ((midAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const isBottomGap =
      normalizedMid > Math.PI / 2 - bottomGapHalfAngle && normalizedMid < Math.PI / 2 + bottomGapHalfAngle;
    if (isBottomGap) continue;

    const xA = DOME_CENTER_X + Math.cos(angleA) * DOME_RADIUS_X;
    const yA = DOME_CENTER_Y + Math.sin(angleA) * DOME_RADIUS_Y;
    const xB = DOME_CENTER_X + Math.cos(angleB) * DOME_RADIUS_X;
    const yB = DOME_CENTER_Y + Math.sin(angleB) * DOME_RADIUS_Y;

    walls.push(wallFromPoints(xA, yA, xB, yB, DOME_WALL_THICKNESS, 1.2));
  }
  return walls;
}

/** ガチャドーム内の物理シミュレーション（Matter.js）。Canvas 1枚にドーム〜シュート〜排出口窓までを描画する。 */
export const GachaDome = forwardRef<GachaDomeHandle, { className?: string }>(function GachaDome({ className }, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const gateRef = useRef<Matter.Body | null>(null);
  const capsuleVisualById = useRef<Map<number, CapsuleVisual>>(new Map());
  const ejectingRef = useRef(false);
  const pendingEjectCheckRef = useRef<(() => void) | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      stir() {
        const engine = engineRef.current;
        if (!engine) return;
        const capsules = Matter.Composite.allBodies(engine.world).filter((b) => b.label === CAPSULE_LABEL);
        for (const body of capsules) {
          const fx = (Math.random() * 2 - 1) * STIR_FORCE_MAX;
          const fy = -(STIR_FORCE_MIN + Math.random() * (STIR_FORCE_MAX - STIR_FORCE_MIN));
          Matter.Body.applyForce(body, body.position, { x: fx, y: fy });
          Matter.Body.setAngularVelocity(body, (Math.random() * 2 - 1) * 0.3);
        }
      },
      eject(): Promise<CapsuleColorPair> {
        return new Promise((resolve) => {
          const engine = engineRef.current;
          if (!engine || ejectingRef.current) {
            resolve({ top: "#888888", bottom: "#555555" });
            return;
          }
          const capsules = Matter.Composite.allBodies(engine.world).filter((b) => b.label === CAPSULE_LABEL);
          if (capsules.length === 0) {
            resolve({ top: "#888888", bottom: "#555555" });
            return;
          }
          ejectingRef.current = true;

          // ゲートを外して山からの自然な落下だけに頼ると、カプセル同士が
          // ゲート付近でアーチ状に支え合って誰も落ちてこないことがある
          // （粒状体のブリッジ現象）。実機のプッシャー機構と同様、排出する
          // カプセルを1個選んでシュート入口へ直接送り出し、そこから先は
          // 通常の物理挙動（落下・バウンド）で排出口まで運ばせる。
          const chosen = capsules.reduce((closest, b) => {
            const d = Math.hypot(b.position.x - DOME_CENTER_X, b.position.y - GATE_Y);
            const dc = Math.hypot(closest.position.x - DOME_CENTER_X, closest.position.y - GATE_Y);
            return d < dc ? b : closest;
          });
          const chosenId = chosen.id;
          Matter.Body.setPosition(chosen, { x: DOME_CENTER_X, y: CHUTE_TOP_Y + 6 });
          Matter.Body.setVelocity(chosen, { x: 0, y: 4 });
          Matter.Body.setAngularVelocity(chosen, 0);

          let frame = 0;
          const check = () => {
            frame++;
            const chosenBody = Matter.Composite.allBodies(engine.world).find((b) => b.id === chosenId);
            if (!chosenBody) {
              Matter.Events.off(engine, "afterUpdate", check);
              pendingEjectCheckRef.current = null;
              ejectingRef.current = false;
              resolve({ top: "#888888", bottom: "#555555" });
              return;
            }
            // 着地位置には物理的な誤差（拘束の許容誤差など）が数px乗るため、
            // 少し手前の閾値で「到達」とみなす（ちょうど等号一致を待たない）。
            if (chosenBody.position.y < WINDOW_LANDED_Y - 3) {
              // シュートの途中で壁に引っかかって進まなくなることがあるため、軽く後押しする。
              if (frame % 12 === 0) {
                Matter.Body.setVelocity(chosenBody, {
                  x: chosenBody.velocity.x + (DOME_CENTER_X - chosenBody.position.x) * 0.03,
                  y: Math.max(chosenBody.velocity.y, 4),
                });
              }
              return;
            }

            Matter.Events.off(engine, "afterUpdate", check);
            pendingEjectCheckRef.current = null;
            ejectingRef.current = false;
            const visual = capsuleVisualById.current.get(chosenId);
            resolve(visual ? { top: visual.top, bottom: visual.bottom } : { top: "#888888", bottom: "#555555" });
          };
          pendingEjectCheckRef.current = check;
          Matter.Events.on(engine, "afterUpdate", check);
        });
      },
    }),
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const visualMap = capsuleVisualById.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const engine = Matter.Engine.create();
    engine.gravity.y = GRAVITY_Y;
    engineRef.current = engine;

    const domeWalls = createDomeWalls();

    const gate = Matter.Bodies.rectangle(DOME_CENTER_X, GATE_Y, GATE_WIDTH, GATE_HEIGHT, {
      isStatic: true,
      friction: FRICTION,
    });
    gateRef.current = gate;

    const chuteLeft = wallFromPoints(
      DOME_CENTER_X - CHUTE_TOP_HALF_WIDTH,
      CHUTE_TOP_Y,
      DOME_CENTER_X - CHUTE_BOTTOM_HALF_WIDTH,
      CHUTE_BOTTOM_Y,
      CHUTE_WALL_THICKNESS,
    );
    const chuteRight = wallFromPoints(
      DOME_CENTER_X + CHUTE_TOP_HALF_WIDTH,
      CHUTE_TOP_Y,
      DOME_CENTER_X + CHUTE_BOTTOM_HALF_WIDTH,
      CHUTE_BOTTOM_Y,
      CHUTE_WALL_THICKNESS,
    );
    // カプセルが着地して静止した時の中心Yがちょうど WINDOW_LANDED_Y になるよう、
    // 床の厚み(floorHeight)の半分ぶんだけ床の中心を余分に下げて配置する
    // （床の上面が WINDOW_LANDED_Y + CAPSULE_RADIUS に来るようにするため）。
    const windowFloorHeight = 8;
    const windowFloor = Matter.Bodies.rectangle(
      DOME_CENTER_X,
      WINDOW_LANDED_Y + CAPSULE_RADIUS + windowFloorHeight / 2,
      CHUTE_BOTTOM_HALF_WIDTH * 2,
      windowFloorHeight,
      { isStatic: true, friction: FRICTION, restitution: RESTITUTION * 0.6 },
    );

    // ドーム内壁の内側に確実に収まるよう、半径をクランプしてから配置する
    // （角度＋距離＋オフセットの組み合わせが半径を超えて生成されないようにするため）。
    // 楕円の内接円（短い方の半径）を安全な生成範囲として使う。
    const domeInnerRadius = Math.min(DOME_RADIUS_X, DOME_RADIUS_Y);
    const maxSpawnRadius = domeInnerRadius - CAPSULE_RADIUS - 2;
    const capsules: Matter.Body[] = [];
    for (let i = 0; i < CAPSULE_COUNT; i++) {
      const angleSpread = Math.PI * 0.9;
      const angle = Math.PI * 1.05 + Math.random() * angleSpread;
      const dist = Math.random() * (domeInnerRadius - CAPSULE_RADIUS * 1.6);
      let ox = Math.cos(angle) * dist + (Math.random() * 20 - 10);
      let oy = Math.sin(angle) * dist * 0.5 - 10 - i * 3;
      const offsetMagnitude = Math.hypot(ox, oy);
      if (offsetMagnitude > maxSpawnRadius) {
        const scale = maxSpawnRadius / offsetMagnitude;
        ox *= scale;
        oy *= scale;
      }
      const body = Matter.Bodies.circle(DOME_CENTER_X + ox, DOME_CENTER_Y + oy, CAPSULE_RADIUS, {
        restitution: RESTITUTION,
        friction: FRICTION,
        frictionAir: FRICTION_AIR,
        label: CAPSULE_LABEL,
      });
      visualMap.set(body.id, randomCapsuleVisual());
      capsules.push(body);
    }

    Matter.World.add(engine.world, [...domeWalls, gate, chuteLeft, chuteRight, windowFloor, ...capsules]);

    // ドラッグでかき混ぜられるようにする
    const mouse = Matter.Mouse.create(canvas);
    const mouseConstraint = Matter.MouseConstraint.create(engine, {
      mouse,
      constraint: { stiffness: 0.15, render: { visible: false } },
    });
    Matter.World.add(engine.world, mouseConstraint);

    // マウント時点で既に容器下半分に積み重なって見えるよう、非表示のまま少し多めに進めておく
    // （カプセル数が増えた分、安定して積もるまでの時間も長くとる）。
    for (let i = 0; i < 160; i++) {
      Matter.Engine.update(engine, 1000 / 60);
    }

    const runner = Matter.Runner.create();
    Matter.Runner.run(runner, engine);

    function draw() {
      ctx!.clearRect(0, 0, STAGE_WIDTH, CANVAS_HEIGHT);
      const bodies = Matter.Composite.allBodies(engine.world).filter((b) => b.label === CAPSULE_LABEL);

      // depthの昇順（奥→手前）に描画することで、手前のカプセルが奥のカプセルに重なって見えるようにする。
      const withVisual = bodies
        .map((body) => ({ body, visual: visualMap.get(body.id) }))
        .filter((entry): entry is { body: Matter.Body; visual: CapsuleVisual } => Boolean(entry.visual))
        .sort((a, b) => a.visual.depth - b.visual.depth);

      for (const { body, visual } of withVisual) {
        const { x, y } = body.position;
        // 物理的な当たり判定(CAPSULE_RADIUS)より一回り大きく描画し、隣接カプセル同士の重なりを強調する
        const r = CAPSULE_VISUAL_RADIUS;
        // 奥(depth=0)ほど暗く、手前(depth=1)ほど明るく見せて重なりの立体感を出す
        const shade = 0.72 + 0.28 * visual.depth;
        const topColor = shadeColor(visual.top, shade);
        const bottomColor = shadeColor(visual.bottom, shade);

        ctx!.save();
        ctx!.translate(x, y);
        ctx!.rotate(body.angle);

        ctx!.beginPath();
        if (visual.pattern === "horizontal") {
          ctx!.arc(0, 0, r, Math.PI, Math.PI * 2, false);
          ctx!.closePath();
          ctx!.fillStyle = topColor;
          ctx!.fill();
          ctx!.beginPath();
          ctx!.arc(0, 0, r, 0, Math.PI, false);
          ctx!.closePath();
          ctx!.fillStyle = bottomColor;
          ctx!.fill();
          ctx!.beginPath();
          ctx!.moveTo(-r, 0);
          ctx!.lineTo(r, 0);
          ctx!.lineWidth = Math.max(1.5, r * 0.06);
          ctx!.strokeStyle = "rgba(0, 0, 0, 0.28)";
          ctx!.stroke();
        } else if (visual.pattern === "vertical") {
          ctx!.arc(0, 0, r, Math.PI * 0.5, Math.PI * 1.5, false);
          ctx!.closePath();
          ctx!.fillStyle = topColor;
          ctx!.fill();
          ctx!.beginPath();
          ctx!.arc(0, 0, r, -Math.PI * 0.5, Math.PI * 0.5, false);
          ctx!.closePath();
          ctx!.fillStyle = bottomColor;
          ctx!.fill();
          ctx!.beginPath();
          ctx!.moveTo(0, -r);
          ctx!.lineTo(0, r);
          ctx!.lineWidth = Math.max(1.5, r * 0.06);
          ctx!.strokeStyle = "rgba(0, 0, 0, 0.28)";
          ctx!.stroke();
        } else {
          // 4分割（市松模様）: 左上・右下をtop色、右上・左下をbottom色にする
          const quadrants: Array<[number, number, string]> = [
            [Math.PI, Math.PI * 1.5, topColor],
            [Math.PI * 1.5, Math.PI * 2, bottomColor],
            [0, Math.PI * 0.5, topColor],
            [Math.PI * 0.5, Math.PI, bottomColor],
          ];
          for (const [start, end, color] of quadrants) {
            ctx!.beginPath();
            ctx!.moveTo(0, 0);
            ctx!.arc(0, 0, r, start, end, false);
            ctx!.closePath();
            ctx!.fillStyle = color;
            ctx!.fill();
          }
          ctx!.beginPath();
          ctx!.moveTo(-r, 0);
          ctx!.lineTo(r, 0);
          ctx!.moveTo(0, -r);
          ctx!.lineTo(0, r);
          ctx!.lineWidth = Math.max(1.5, r * 0.055);
          ctx!.strokeStyle = "rgba(0, 0, 0, 0.28)";
          ctx!.stroke();
        }

        // 太い縁取り（手描き風のポップなタッチに合わせ、要素サイズの比率で統一）
        ctx!.beginPath();
        ctx!.arc(0, 0, r, 0, Math.PI * 2);
        ctx!.lineWidth = outlineWidth(r * 2, 0.075);
        ctx!.strokeStyle = "rgba(0, 0, 0, 0.34)";
        ctx!.stroke();

        // 白の光沢ハイライト
        ctx!.beginPath();
        ctx!.ellipse(-r * 0.35, -r * 0.4, r * 0.28, r * 0.16, -0.5, 0, Math.PI * 2);
        ctx!.fillStyle = "rgba(255, 255, 255, 0.65)";
        ctx!.fill();

        ctx!.restore();
      }
    }
    Matter.Events.on(engine, "afterUpdate", draw);
    draw();

    return () => {
      Matter.Runner.stop(runner);
      Matter.Events.off(engine, "afterUpdate", draw);
      if (pendingEjectCheckRef.current) {
        Matter.Events.off(engine, "afterUpdate", pendingEjectCheckRef.current);
        pendingEjectCheckRef.current = null;
      }
      Matter.World.clear(engine.world, false);
      Matter.Engine.clear(engine);
      engineRef.current = null;
      gateRef.current = null;
      ejectingRef.current = false;
      visualMap.clear();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={STAGE_WIDTH}
      height={CANVAS_HEIGHT}
      className={className}
      style={{ touchAction: "none", width: "100%", height: "auto", display: "block" }}
    />
  );
});
