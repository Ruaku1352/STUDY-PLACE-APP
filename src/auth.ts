import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { authConfig } from "./auth.config";
import { prisma } from "@/lib/prisma";

const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const DEFAULT_SETTINGS = {
  wakeWeekday: "08:00",
  wakeWeekend: "09:00",
  morningEnd: "12:00",
  outsideEnd: "21:00",
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/calendar.events",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      if (!user.email) return false;
      return ALLOWED_EMAILS.includes(user.email.toLowerCase());
    },
    async jwt({ token, account, user }) {
      if (account && user?.email) {
        const dbUser = await prisma.user.upsert({
          where: { email: user.email },
          create: {
            email: user.email,
            name: user.name ?? undefined,
            googleAccessToken: account.access_token,
            googleRefreshToken: account.refresh_token,
            googleAccessTokenExpiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
          },
          update: {
            name: user.name ?? undefined,
            googleAccessToken: account.access_token,
            // refresh_token はGoogleが初回同意時にしか返さないため、無い場合は既存値を保持する
            ...(account.refresh_token ? { googleRefreshToken: account.refresh_token } : {}),
            googleAccessTokenExpiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
          },
        });

        await prisma.settings.upsert({
          where: { userId: dbUser.id },
          create: { userId: dbUser.id, ...DEFAULT_SETTINGS },
          update: {},
        });

        token.appUserId = dbUser.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.appUserId) {
        session.user.id = token.appUserId as string;
      }
      return session;
    },
  },
});
