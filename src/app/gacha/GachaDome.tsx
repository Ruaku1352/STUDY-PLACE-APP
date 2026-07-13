"use client";

import Matter from "matter-js";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { randomCapsuleColorPair, type CapsuleColorPair } from "./colors";
import {
  CAPSULE_COUNT,
  CAPSULE_RADIUS,
  CANVAS_HEIGHT,
  CHUTE_BOTTOM_HALF_WIDTH,
  CHUTE_BOTTOM_Y,
  CHUTE_TOP_HALF_WIDTH,
  CHUTE_TOP_Y,
  CHUTE_WALL_THICKNESS,
  DOME_CENTER_X,
  DOME_CENTER_Y,
  DOME_RADIUS,
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

export interface GachaDomeHandle {
  /** ノブ回転と同時に呼ぶ。ドーム内のカプセル全体をかき混ぜる。 */
  stir: () => void;
  /** ゲートを開き、最初に抜けた1個のカプセルの色を返す（他は自動でドーム内へ戻す）。 */
  eject: () => Promise<CapsuleColorPair>;
}

function wallFromPoints(x1: number, y1: number, x2: number, y2: number, thickness: number): Matter.Body {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  return Matter.Bodies.rectangle((x1 + x2) / 2, (y1 + y2) / 2, length, thickness, {
    isStatic: true,
    angle,
    friction: FRICTION,
    restitution: RESTITUTION,
  });
}

function createDomeWalls(): Matter.Body[] {
  const walls: Matter.Body[] = [];
  const segAngle = (Math.PI * 2) / DOME_WALL_SEGMENTS;
  const segLen = (2 * Math.PI * DOME_RADIUS) / DOME_WALL_SEGMENTS;
  for (let i = 0; i < DOME_WALL_SEGMENTS; i++) {
    const angle = i * segAngle;
    // ドーム最下部中央はゲート用に壁を作らない（出口の隙間）
    const normalized = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const isBottomGap = normalized > Math.PI * 0.4 && normalized < Math.PI * 0.6;
    if (isBottomGap) continue;

    const x = DOME_CENTER_X + Math.cos(angle) * DOME_RADIUS;
    const y = DOME_CENTER_Y + Math.sin(angle) * DOME_RADIUS;
    walls.push(
      Matter.Bodies.rectangle(x, y, segLen * 1.2, DOME_WALL_THICKNESS, {
        isStatic: true,
        angle: angle + Math.PI / 2,
        friction: FRICTION,
        restitution: RESTITUTION,
      }),
    );
  }
  return walls;
}

/** ガチャドーム内の物理シミュレーション（Matter.js）。Canvas 1枚にドーム〜シュート〜排出口窓までを描画する。 */
export const GachaDome = forwardRef<GachaDomeHandle, { className?: string }>(function GachaDome({ className }, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const gateRef = useRef<Matter.Body | null>(null);
  const capsuleColorById = useRef<Map<number, CapsuleColorPair>>(new Map());
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
          const gate = gateRef.current;
          if (!engine || !gate || ejectingRef.current) {
            resolve({ top: "#888888", bottom: "#555555" });
            return;
          }
          ejectingRef.current = true;
          Matter.World.remove(engine.world, gate);

          const check = () => {
            const capsules = Matter.Composite.allBodies(engine.world).filter((b) => b.label === CAPSULE_LABEL);
            const passed = capsules.filter((b) => b.position.y > GATE_Y + 2);
            if (passed.length === 0) return;

            // ゲートを即座に閉じ、以降の抜け出しを止める
            Matter.World.add(engine.world, gate);

            const [chosen, ...extras] = passed;
            // ごく稀に複数抜けても、選ばれた1個以外はドーム内へ戻す（排出は必ず1個）
            for (const extra of extras) {
              Matter.Body.setPosition(extra, { x: DOME_CENTER_X, y: DOME_CENTER_Y - DOME_RADIUS * 0.3 });
              Matter.Body.setVelocity(extra, { x: 0, y: 0 });
            }

            Matter.Events.off(engine, "afterUpdate", check);
            pendingEjectCheckRef.current = null;
            ejectingRef.current = false;
            resolve(capsuleColorById.current.get(chosen.id) ?? { top: "#888888", bottom: "#555555" });
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
    const colorMap = capsuleColorById.current;
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
    const windowFloor = Matter.Bodies.rectangle(
      DOME_CENTER_X,
      WINDOW_LANDED_Y + CAPSULE_RADIUS,
      CHUTE_BOTTOM_HALF_WIDTH * 2,
      8,
      { isStatic: true, friction: FRICTION, restitution: RESTITUTION * 0.6 },
    );

    // ドーム内壁の内側に確実に収まるよう、半径をクランプしてから配置する
    // （角度＋距離＋オフセットの組み合わせが半径を超えて生成されないようにするため）
    const maxSpawnRadius = DOME_RADIUS - CAPSULE_RADIUS - 2;
    const capsules: Matter.Body[] = [];
    for (let i = 0; i < CAPSULE_COUNT; i++) {
      const angleSpread = Math.PI * 0.7;
      const angle = Math.PI * 1.15 + Math.random() * angleSpread;
      const dist = Math.random() * (DOME_RADIUS - CAPSULE_RADIUS * 2);
      let ox = Math.cos(angle) * dist + (Math.random() * 20 - 10);
      let oy = Math.sin(angle) * dist * 0.5 - 20 - i * 2;
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
      colorMap.set(body.id, randomCapsuleColorPair());
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

    // マウント時点で既に積み重なって見えるよう、非表示のまま少し進めておく
    for (let i = 0; i < 90; i++) {
      Matter.Engine.update(engine, 1000 / 60);
    }

    const runner = Matter.Runner.create();
    Matter.Runner.run(runner, engine);

    function draw() {
      ctx!.clearRect(0, 0, STAGE_WIDTH, CANVAS_HEIGHT);
      const bodies = Matter.Composite.allBodies(engine.world).filter((b) => b.label === CAPSULE_LABEL);
      for (const body of bodies) {
        const colors = colorMap.get(body.id);
        if (!colors) continue;
        const { x, y } = body.position;
        const r = CAPSULE_RADIUS;

        ctx!.save();
        ctx!.translate(x, y);
        ctx!.rotate(body.angle);

        ctx!.beginPath();
        ctx!.arc(0, 0, r, Math.PI, Math.PI * 2, false);
        ctx!.closePath();
        ctx!.fillStyle = colors.top;
        ctx!.fill();

        ctx!.beginPath();
        ctx!.arc(0, 0, r, 0, Math.PI, false);
        ctx!.closePath();
        ctx!.fillStyle = colors.bottom;
        ctx!.fill();

        ctx!.beginPath();
        ctx!.arc(0, 0, r, 0, Math.PI * 2);
        ctx!.lineWidth = 1.4;
        ctx!.strokeStyle = "rgba(0, 0, 0, 0.32)";
        ctx!.stroke();

        ctx!.beginPath();
        ctx!.ellipse(-r * 0.35, -r * 0.4, r * 0.28, r * 0.16, -0.5, 0, Math.PI * 2);
        ctx!.fillStyle = "rgba(255, 255, 255, 0.6)";
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
      colorMap.clear();
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
