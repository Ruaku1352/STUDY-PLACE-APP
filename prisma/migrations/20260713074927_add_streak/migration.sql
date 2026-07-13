-- CreateTable
CREATE TABLE "Streak" (
    "userId" TEXT NOT NULL,
    "currentCount" INTEGER NOT NULL DEFAULT 0,
    "longestCount" INTEGER NOT NULL DEFAULT 0,
    "lastQualifiedDate" TIMESTAMP(3),
    "freezeUsedInWeek" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Streak_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "Streak" ADD CONSTRAINT "Streak_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
