"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export interface NavItem {
  href: string;
  label: string;
}

export function BottomNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const current = items.find((item) => item.href === pathname);

  return (
    <>
      {open && <div className="app-nav-backdrop" onClick={() => setOpen(false)} />}

      <div className="app-nav-sheet" data-open={open}>
        <ul className="app-nav-list">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="app-nav-sheet-link"
                data-active={item.href === pathname}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <nav className="app-nav">
        <button
          type="button"
          className="app-nav-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="メニューを開く"
        >
          <span className={`app-nav-hamburger${open ? " app-nav-hamburger-open" : ""}`} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>{open ? "閉じる" : (current?.label ?? "メニュー")}</span>
        </button>
      </nav>
    </>
  );
}
