import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    // api/cron はVercel Cronからのリクエストで、セッションを持たない代わりにルート側で
    // CRON_SECRETを検証する（NextAuthのセッション認証は通さない）。
    "/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest|icons/).*)",
  ],
};
