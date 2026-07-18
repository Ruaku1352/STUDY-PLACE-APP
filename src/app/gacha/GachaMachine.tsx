"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { randomCapsuleColorPair, type CapsuleColorPair } from "./colors";
import { GachaDome, type GachaDomeHandle } from "./GachaDome";
import { MachineBackLayer, MachineFrontLayer } from "./MachineBody";
import { MedalIcon } from "./MedalIcon";
import { MEDAL_DOCK_PERCENT, WINDOW_CENTER_PERCENT } from "./physics";
import { RevealCard } from "./RevealCard";
import type { RevealResult, RevealWeather } from "./types";

/** ミッション文の取得アクション自体が失敗した場合のみ使うクライアント側の最終フォールバック
 * （サーバー側は通常この文言を返さず内部で固定文にフォールバックするため、ここに来るのは稀）。 */
const CLIENT_FALLBACK_MISSION_TEXT = "今日も1日、頑張りましょう。";

type Stage = "idle" | "coin-flying" | "knob-turning" | "ejecting" | "blackout" | "opening" | "card-shown" | "error";
type CapsuleVisualStage = "docked" | "risen";

const COIN_FLIGHT_MS = 600;
const KNOB_TURN_MS = 1200;
// 排出は物理挙動（GachaDome.eject）が実際に排出口へ着地するまで待って進める。
// この値は物理が万一収束しない場合の保険（フォールバック）としてのみ使う。
const EJECT_FALLBACK_MS = 2500;
// カプセルが排出口窓へ着地した瞬間に暗転すると速すぎるため、着地が見えてから少し間を置く。
const LANDED_PAUSE_MS = 700;
const OPEN_MS = 500;
const RISE_DELAY_MS = 30;

const SKIPPABLE_STAGES: Stage[] = ["coin-flying", "knob-turning", "ejecting"];
const BLACKOUT_STAGES: Stage[] = ["blackout", "opening", "card-shown"];

function describeClientError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export type GachaMode = "reveal" | "reroll";

export interface GachaMachineProps {
  mode: GachaMode;
  /** このガチャ演出1回で消費するメダルを含めた残数（reveal時は2、reroll時は1を渡す）。 */
  medalsRemaining: number;
  streakDays: number;
  action: () => Promise<RevealResult>;
  /** 開封演出をブロックしないよう別枠で並行取得するミッション文・天気アクション。 */
  fetchMissionTextAction: () => Promise<string>;
  fetchWeatherAction: () => Promise<RevealWeather | null>;
  /** reveal時のみ有効。ギブアップして手動編集へ切り替える。 */
  giveUpAction?: () => Promise<void>;
  /**
   * カードを閉じた後（または reveal失敗時のギブアップ後）に呼ばれる。
   * router.refresh()はこのコンポーネントが内部で行うため、親（例: TodayClientのリロール用オーバーレイ）が
   * 追加で必要とする後片付け（オーバーレイを閉じる等）がある場合のみ渡せばよい。
   */
  onComplete?: () => void;
}

/** ガチャガチャ（カプセルトイマシン）の開封演出オーケストレーター。 */
export function GachaMachine({
  mode,
  medalsRemaining,
  streakDays,
  action,
  fetchMissionTextAction,
  fetchWeatherAction,
  giveUpAction,
  onComplete,
}: GachaMachineProps) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [capsuleColor, setCapsuleColor] = useState<CapsuleColorPair | null>(null);
  const [capsuleVisualStage, setCapsuleVisualStage] = useState<CapsuleVisualStage>("docked");
  const [dockedOffset, setDockedOffset] = useState({ dx: 0, dy: 0 });
  const [result, setResult] = useState<RevealResult | null>(null);
  const [missionText, setMissionText] = useState<string | null>(null);
  const [weather, setWeather] = useState<RevealWeather | null>(null);
  const [weatherLoaded, setWeatherLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [giveUpPending, setGiveUpPending] = useState(false);

  const domeRef = useRef<GachaDomeHandle | null>(null);
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const actionPromiseRef = useRef<Promise<RevealResult> | null>(null);
  const missionTextPromiseRef = useRef<Promise<string> | null>(null);
  const weatherPromiseRef = useRef<Promise<RevealWeather | null> | null>(null);

  const ensureActionStarted = useCallback(() => {
    if (!actionPromiseRef.current) {
      actionPromiseRef.current = action();
    }
    return actionPromiseRef.current;
  }, [action]);

  // ミッション文・天気は開封演出をブロックしないよう、開封スケジュール取得とは別枠で
  // 並行して取得し、解決しだいカードへ差し込む（プレースホルダー→差し替え方式）。
  const ensureMissionTextStarted = useCallback(() => {
    if (!missionTextPromiseRef.current) {
      missionTextPromiseRef.current = fetchMissionTextAction();
    }
    return missionTextPromiseRef.current;
  }, [fetchMissionTextAction]);

  const ensureWeatherStarted = useCallback(() => {
    if (!weatherPromiseRef.current) {
      weatherPromiseRef.current = fetchWeatherAction();
    }
    return weatherPromiseRef.current;
  }, [fetchWeatherAction]);

  useEffect(() => {
    if (stage === "coin-flying") {
      const t = setTimeout(() => setStage("knob-turning"), COIN_FLIGHT_MS);
      return () => clearTimeout(t);
    }

    if (stage === "knob-turning") {
      ensureActionStarted().catch(() => {
        // エラーはblackout stageでまとめて拾う
      });
      // ノブ回転中（演出の間）に先行して呼び始めることで、体感の待ち時間を減らす。
      ensureMissionTextStarted().catch(() => {});
      ensureWeatherStarted().catch(() => {});
      domeRef.current?.stir();
      const t = setTimeout(() => setStage("ejecting"), KNOB_TURN_MS);
      return () => clearTimeout(t);
    }

    if (stage === "ejecting") {
      let active = true;
      let advanced = false;
      let landedPauseTimer: ReturnType<typeof setTimeout> | null = null;
      const advanceToBlackout = () => {
        if (!active || advanced) return;
        advanced = true;
        setStage("blackout");
      };

      domeRef.current?.eject().then((color) => {
        if (!active) return;
        setCapsuleColor(color);
        // カプセルが実際に排出口へ着地した瞬間に暗転すると速すぎるため、
        // 着地が見えるよう少し間を置いてから暗転演出へ進む。
        landedPauseTimer = setTimeout(advanceToBlackout, LANDED_PAUSE_MS);
      });
      // 物理挙動が万一収束しない場合のみ発動する保険のフォールバック
      const fallbackTimer = setTimeout(advanceToBlackout, EJECT_FALLBACK_MS);
      return () => {
        active = false;
        clearTimeout(fallbackTimer);
        if (landedPauseTimer) clearTimeout(landedPauseTimer);
      };
    }

    if (stage === "blackout") {
      const container = stageContainerRef.current;
      if (container && typeof window !== "undefined") {
        const rect = container.getBoundingClientRect();
        const windowX = rect.left + rect.width * (WINDOW_CENTER_PERCENT.x / 100);
        const windowY = rect.top + rect.height * (WINDOW_CENTER_PERCENT.y / 100);
        setDockedOffset({ dx: windowX - window.innerWidth / 2, dy: windowY - window.innerHeight / 2 });
      }
      setCapsuleVisualStage("docked");
      setCapsuleColor((prev) => prev ?? randomCapsuleColorPair());
      const riseTimer = setTimeout(() => setCapsuleVisualStage("risen"), RISE_DELAY_MS);

      let active = true;
      ensureActionStarted()
        .then((res) => {
          if (!active) return;
          setResult(res);
          setStage("opening");
        })
        .catch((e) => {
          if (!active) return;
          setErrorMessage(describeClientError(e));
          setStage("error");
        });

      // ミッション文・天気は開封演出の完了を待たず、解決しだいカードへ差し込む
      // （まだ取得中ならカード側でプレースホルダーを表示する）。
      ensureMissionTextStarted()
        .then((text) => {
          if (active) setMissionText(text);
        })
        .catch(() => {
          if (active) setMissionText(CLIENT_FALLBACK_MISSION_TEXT);
        });
      ensureWeatherStarted()
        .then((w) => {
          if (active) setWeather(w);
        })
        .catch(() => {})
        .finally(() => {
          if (active) setWeatherLoaded(true);
        });

      return () => {
        active = false;
        clearTimeout(riseTimer);
      };
    }

    if (stage === "opening") {
      const t = setTimeout(() => setStage("card-shown"), OPEN_MS);
      return () => clearTimeout(t);
    }
  }, [stage, ensureActionStarted, ensureMissionTextStarted, ensureWeatherStarted]);

  function handleStart() {
    if (stage !== "idle" || medalsRemaining <= 0) return;
    setStage("coin-flying");
  }

  function handleSkip() {
    if (!SKIPPABLE_STAGES.includes(stage)) return;
    ensureActionStarted().catch(() => {});
    ensureMissionTextStarted().catch(() => {});
    ensureWeatherStarted().catch(() => {});
    setStage("blackout");
  }

  function handleClose() {
    router.refresh();
    onComplete?.();
  }

  function handleErrorClose() {
    actionPromiseRef.current = null;
    missionTextPromiseRef.current = null;
    weatherPromiseRef.current = null;
    setResult(null);
    setMissionText(null);
    setWeather(null);
    setWeatherLoaded(false);
    setErrorMessage(null);
    setCapsuleColor(null);
    setStage("idle");
  }

  async function handleGiveUp() {
    if (!giveUpAction || giveUpPending) return;
    setGiveUpPending(true);
    try {
      await giveUpAction();
      router.refresh();
      onComplete?.();
    } finally {
      setGiveUpPending(false);
    }
  }

  const displayedMedals = stage === "idle" ? medalsRemaining : Math.max(0, medalsRemaining - 1);
  const knobRotating = stage === "knob-turning";
  const ejecting = stage === "ejecting";
  const showBlackout = BLACKOUT_STAGES.includes(stage);
  const showCapsule = capsuleColor !== null && showBlackout;
  const capsuleOpen = stage === "opening" || stage === "card-shown";

  const capsuleStyle: CSSProperties & Record<"--capsule-dx" | "--capsule-dy" | "--capsule-top" | "--capsule-bottom", string> = {
    "--capsule-dx": `${dockedOffset.dx}px`,
    "--capsule-dy": `${dockedOffset.dy}px`,
    "--capsule-top": capsuleColor?.top ?? "#888888",
    "--capsule-bottom": capsuleColor?.bottom ?? "#555555",
  };

  return (
    <div className="gacha-machine">
      <div className="gacha-status-bar">
        <div className="row" style={{ gap: "0.3rem" }}>
          {Array.from({ length: 2 }, (_, i) => (
            <MedalIcon key={i} size="sm" className={i < displayedMedals ? "" : "gacha-medal-spent"} />
          ))}
        </div>
        <span className="muted">🔥 {streakDays}日目</span>
      </div>

      <div ref={stageContainerRef} className={`gacha-stage${showBlackout ? " gacha-stage-sinking" : ""}`}>
        <MachineBackLayer className="gacha-back-layer" />
        <GachaDome ref={domeRef} className="gacha-dome-canvas" />
        <MachineFrontLayer knobRotating={knobRotating} ejecting={ejecting} className="gacha-front-layer" />

        {stage === "idle" && (
          <button type="button" className="gacha-medal-dock" style={{ left: `${MEDAL_DOCK_PERCENT.x}%`, top: `${MEDAL_DOCK_PERCENT.y}%` }} onClick={handleStart} aria-label="メダルを投入する">
            <MedalIcon size="lg" />
          </button>
        )}

        {stage === "coin-flying" && (
          <div className="gacha-medal-flying" aria-hidden="true">
            <MedalIcon size="lg" />
          </div>
        )}
      </div>

      {stage === "idle" && (
        <p className="muted gacha-tap-hint">メダルをタップして開封</p>
      )}

      {SKIPPABLE_STAGES.includes(stage) && (
        <button type="button" className="gacha-skip-button" onClick={handleSkip}>
          タップでスキップ
        </button>
      )}

      {mode === "reveal" && stage === "idle" && giveUpAction && (
        <button type="button" className="gacha-giveup-link" onClick={handleGiveUp} disabled={giveUpPending}>
          {giveUpPending ? "処理中..." : "ギブアップして手動編集する"}
        </button>
      )}

      {showBlackout && (
        <div className="gacha-blackout-overlay">
          {showCapsule && (
            <div
              className={`gacha-ejected-capsule gacha-ejected-capsule-${capsuleVisualStage}${capsuleOpen ? " gacha-ejected-capsule-open" : ""}`}
              style={capsuleStyle}
            >
              <div className="gacha-capsule-half gacha-capsule-half-top" />
              <div className="gacha-capsule-half gacha-capsule-half-bottom" />
            </div>
          )}

          {stage === "card-shown" && result && (
            <RevealCard
              result={result}
              missionText={missionText}
              weather={weather}
              weatherLoaded={weatherLoaded}
              streakDays={streakDays}
              onClose={handleClose}
            />
          )}
        </div>
      )}

      {stage === "error" && (
        <div className="gacha-blackout-overlay">
          <div className="gacha-error-card">
            <p>通信に失敗しました。もう一度お試しください。</p>
            {errorMessage && (
              <p className="muted" style={{ fontSize: "0.75rem", wordBreak: "break-all" }}>
                詳細: {errorMessage}
              </p>
            )}
            <button type="button" className="button-primary" onClick={handleErrorClose}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
