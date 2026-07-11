import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * ログイン中のユーザーの内部 userId を返す。未ログインなら /login へリダイレクトする。
 * User・Settings 行の作成は auth.ts の jwt コールバック（ログイン時）で行う。
 */
export async function getCurrentUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session.user.id;
}
