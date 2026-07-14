import type { Metadata, Viewport } from "next";
import { auth, signOut } from "@/auth";
import { BottomNav } from "./BottomNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "勉強スケジュール管理アプリ",
  description: "デイリーガチャ形式の勉強スケジュール管理アプリ",
  appleWebApp: {
    title: "スタディガチャ",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#29539d",
};

const NAV_ITEMS = [
  { href: "/", label: "今日" },
  { href: "/history", label: "実績" },
  { href: "/dashboard", label: "進捗" },
  { href: "/weekly-plan", label: "週の優先順位" },
  { href: "/subjects", label: "科目" },
  { href: "/locations", label: "場所" },
  { href: "/events", label: "予定" },
  { href: "/settings", label: "設定" },
];

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="ja">
      <body>
        <header className="app-header">
          <div className="app-header-inner">
            <span className="app-brand">
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" className="app-brand-mark">
                <circle cx="12" cy="12" r="10" fill="var(--accent)" />
                <path d="M2 12A10 10 0 0 0 22 12" fill="rgba(255, 255, 255, 0.35)" />
                <path d="M2.3 12h19.4" stroke="rgba(0, 0, 0, 0.18)" strokeWidth="1.2" />
                <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(0, 0, 0, 0.15)" strokeWidth="1" />
                <ellipse cx="8.3" cy="8.3" rx="2" ry="1.3" fill="rgba(255, 255, 255, 0.8)" transform="rotate(-30 8.3 8.3)" />
              </svg>
              <span className="app-title">スタディガチャ</span>
            </span>
            {session?.user && (
              <div className="app-user">
                <span className="app-user-email">{session.user.email}</span>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/login" });
                  }}
                >
                  <button type="submit" className="app-logout-button">
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    ログアウト
                  </button>
                </form>
              </div>
            )}
          </div>
        </header>
        <main className="app-main">{children}</main>
        {session?.user && <BottomNav items={NAV_ITEMS} />}
      </body>
    </html>
  );
}
