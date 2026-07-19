-- AlterTable
ALTER TABLE "DayState" ADD COLUMN     "allBlocksBonusGranted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ScheduleBlock" ADD COLUMN     "xpAwarded" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "UserProgress" (
    "userId" TEXT NOT NULL,
    "totalXp" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProgress_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
