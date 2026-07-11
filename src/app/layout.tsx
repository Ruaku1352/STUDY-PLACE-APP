import type { Metadata } from "next";
import { auth, signOut } from "@/auth";
import { BottomNav } from "./BottomNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "勉強スケジュール管理アプリ",
  description: "デイリーガチャ形式の勉強スケジュール管理アプリ",
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
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="app-title">🎁 スタディガチャ</span>
            {session?.user && (
              <div className="row" style={{ gap: "0.5rem" }}>
                <span className="muted" style={{ fontSize: "0.75rem" }}>
                  {session.user.email}
                </span>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/login" });
                  }}
                >
                  <button type="submit" style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}>
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
