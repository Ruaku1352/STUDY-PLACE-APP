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

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    setValue(next);
    setPending(true);
    try {
      await setStartPointAction(next);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <label htmlFor="startPointSelect" className="muted" style={{ fontSize: "0.8rem", display: "block", marginBottom: "0.3rem" }}>
        今日の出発地点
      </label>
      <select id="startPointSelect" value={value} onChange={handleChange} disabled={pending}>
        {startPoints.map((sp) => (
          <option key={sp.id} value={sp.id}>
            {sp.name}
          </option>
        ))}
      </select>
    </div>
  );
}
