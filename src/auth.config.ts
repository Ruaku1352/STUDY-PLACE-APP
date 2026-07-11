import type { NextAuthConfig } from "next-auth";

/**
 * Edge Runtime（middleware）でも読み込める最小構成。
 * Prisma など Node.js専用APIに依存するコード（providers本体・DBを触るcallback）は
 * ここに置かず auth.ts 側に置く。
 */
export const authConfig: NextAuthConfig = {
  providers: [],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = Boolean(auth?.user);
      const isLoginPage = request.nextUrl.pathname.startsWith("/login");

      if (!isLoggedIn && !isLoginPage) return false;
      if (isLoggedIn && isLoginPage) {
        return Response.redirect(new URL("/", request.nextUrl));
      }
      return true;
    },
  },
};
