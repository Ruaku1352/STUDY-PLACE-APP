-- CreateTable
CREATE TABLE "PrepReminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "gcalEventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrepReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrepReminder_userId_weekStartDate_key" ON "PrepReminder"("userId", "weekStartDate");

-- AddForeignKey
ALTER TABLE "PrepReminder" ADD CONSTRAINT "PrepReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
