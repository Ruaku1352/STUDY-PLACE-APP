"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

export function LocationCard({
  id,
  name,
  subLabel,
  isEnabled,
  setLocationEnabledAction,
}: {
  id: string;
  name: string;
  subLabel: string;
  isEnabled: boolean;
  setLocationEnabledAction: (locationId: string, isEnabled: boolean) => Promise<void>;
}) {
  const [enabled, setEnabled] = useState(isEnabled);
  const [isPending, startTransition] = useTransition();

  function handleToggle(next: boolean) {
    setEnabled(next);
    startTransition(async () => {
      await setLocationEnabledAction(id, next);
    });
  }

  return (
    <div className={`list-item${enabled ? "" : " location-card-disabled"}`}>
      <Link href={`/locations/${id}/edit`} className="list-item-main" style={{ textDecoration: "none", color: "inherit" }}>
        <span className="list-item-title">{name}</span>
        <span className="list-item-sub">{subLabel}</span>
      </Link>
      <div className="row">
        <Link href={`/locations/${id}/edit`} className="muted">
          編集 ›
        </Link>
        <label className="toggle-switch" aria-label={`${name}を今週のガチャの抽選対象にする`}>
          <input type="checkbox" checked={enabled} disabled={isPending} onChange={(e) => handleToggle(e.target.checked)} />
          <span className="toggle-switch-track" aria-hidden="true" />
        </label>
      </div>
    </div>
  );
}
