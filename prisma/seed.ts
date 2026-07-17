import type { Prisma } from "@prisma/client";
import { fetchOpeningHours, resolveAddressLocation, resolvePlaceId } from "@/lib/google/places";
import { prisma } from "@/lib/prisma";

// ALLOWED_EMAILS の先頭（自分のGoogleアカウント）をシード対象にする
const SEED_EMAIL = (process.env.ALLOWED_EMAILS ?? "").split(",")[0]?.trim();

// ここを自分の自宅住所に書き換えてください
const HOME_ADDRESS = "東京駅";

// ここを自分の最寄り駅周辺の実在する場所3件に書き換えてください
const LOCATIONS: Array<{
  name: string;
  address: string;
  kind: "library" | "cafe" | "other";
  maxStayMin?: number;
}> = [
  { name: "日比谷図書文化館", address: "日比谷図書文化館", kind: "library" },
  { name: "国立国会図書館", address: "国立国会図書館", kind: "library" },
  { name: "スターバックス コーヒー 東京駅前", address: "スターバックス コーヒー 東京駅前", kind: "cafe", maxStayMin: 120 },
];

async function main() {
  if (!SEED_EMAIL) {
    throw new Error("ALLOWED_EMAILS が .env.local に設定されていません（シード対象のメールアドレスが必要です）");
  }

  const user = await prisma.user.upsert({
    where: { email: SEED_EMAIL },
    create: { email: SEED_EMAIL },
    update: {},
  });
  console.log(`User: ${SEED_EMAIL} (userId=${user.id})`);

  await prisma.settings.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      wakeWeekday: "08:00",
      wakeWeekend: "09:00",
      morningEnd: "12:00",
      outsideEnd: "21:00",
    },
    update: {},
  });

  const homeLocation = await resolveAddressLocation(HOME_ADDRESS).catch(() => null);
  const existingDefault = await prisma.startPoint.findFirst({ where: { userId: user.id, isDefault: true } });
  if (existingDefault) {
    await prisma.startPoint.update({
      where: { id: existingDefault.id },
      data: { address: HOME_ADDRESS, lat: homeLocation?.lat ?? null, lng: homeLocation?.lng ?? null },
    });
  } else {
    await prisma.startPoint.create({
      data: {
        userId: user.id,
        name: "自宅",
        address: HOME_ADDRESS,
        lat: homeLocation?.lat ?? null,
        lng: homeLocation?.lng ?? null,
        isDefault: true,
      },
    });
  }
  console.log(`StartPoint: デフォルト出発地点を「${HOME_ADDRESS}」に設定しました`);

  for (const loc of LOCATIONS) {
    const existing = await prisma.location.findFirst({ where: { userId: user.id, name: loc.name } });
    const location = existing
      ? await prisma.location.update({ where: { id: existing.id }, data: loc })
      : await prisma.location.create({ data: { userId: user.id, ...loc } });

    const placeId = await resolvePlaceId(loc.address);
    if (placeId) {
      const hours = await fetchOpeningHours(placeId);
      await prisma.location.update({
        where: { id: location.id },
        data: {
          placeId,
          openingHoursJson: (hours as Prisma.InputJsonValue) ?? undefined,
          openingHoursFetchedAt: hours ? new Date() : undefined,
        },
      });
      console.log(`Location: ${loc.name} — placeId解決OK${hours ? "、営業時間取得OK" : ""}`);
    } else {
      console.log(`Location: ${loc.name} — placeId解決失敗（手動で営業時間を設定してください）`);
    }
  }

  console.log("シード完了");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
