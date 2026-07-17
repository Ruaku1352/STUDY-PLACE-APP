import { prisma } from "@/lib/prisma";

/** ユーザーのデフォルト出発地点IDを取得する。未登録なら分かりやすいエラーを投げる。 */
export async function getDefaultStartPointId(userId: string): Promise<string> {
  const startPoint = await prisma.startPoint.findFirst({ where: { userId, isDefault: true } });
  if (!startPoint) {
    throw new Error("出発地点が登録されていません。「出発地点」画面から登録してください。");
  }
  return startPoint.id;
}
