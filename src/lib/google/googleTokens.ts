import { prisma } from "@/lib/prisma";

const TOKEN_REFRESH_MARGIN_MS = 60_000;

/**
 * ユーザーの有効なGoogleアクセストークンを返す。期限切れならrefresh_tokenで更新してDBに保存する。
 */
export async function getValidGoogleAccessToken(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const isExpired =
    !user.googleAccessToken ||
    !user.googleAccessTokenExpiresAt ||
    user.googleAccessTokenExpiresAt.getTime() - TOKEN_REFRESH_MARGIN_MS < Date.now();

  if (!isExpired) return user.googleAccessToken!;

  if (!user.googleRefreshToken) {
    throw new Error("Googleの再認証が必要です（refresh_tokenがありません）。一度ログアウトして再度ログインしてください。");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET が設定されていません");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: user.googleRefreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    throw new Error(`Googleアクセストークンの更新に失敗しました: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  await prisma.user.update({
    where: { id: userId },
    data: { googleAccessToken: data.access_token, googleAccessTokenExpiresAt: expiresAt },
  });

  return data.access_token;
}
