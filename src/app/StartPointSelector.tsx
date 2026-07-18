"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface StartPointOption {
  id: string;
  name: string;
}

/** 開封前の今日の出発地点を選ぶ小さなセレクタ。出発地点が2件以上ある時だけ表示する。 */
export function StartPointSelector({
  startPoints,
  currentStartPointId,
  setStartPointAction,
}: {
  startPoints: StartPointOption[];
  currentStartPointId: string;
  setStartPointAction: (startPointId: string) => Promise<void>;
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentStartPointId);
  const [pending, setPending] = useState(false);

  if (startPoints.length <= 1) return null;

  async function handleSelect(id: string) {
    setValue(id);
    setPending(true);
    try {
      await setStartPointAction(id);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <h2 style={{ marginTop: 0, fontSize: "1rem" }}>どこから出発する?</h2>
      <div className="card-list">
        {startPoints.map((sp) => {
          const isCurrent = sp.id === value;
          return (
            <div key={sp.id} className={`list-item${isCurrent ? " start-point-selected" : ""}`}>
              <div className="list-item-main">
                <span className="list-item-title">{sp.name}</span>
                {isCurrent && <span className="list-item-sub">📍 ここを基準に予定を組みます</span>}
              </div>
              {!isCurrent && (
                <button type="button" onClick={() => handleSelect(sp.id)} disabled={pending}>
                  この場所を基準にする
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
