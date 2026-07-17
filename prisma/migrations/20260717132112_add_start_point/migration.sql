-- AlterTable
ALTER TABLE "DayState" ADD COLUMN     "startPointId" TEXT;

-- CreateTable
CREATE TABLE "StartPoint" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StartPoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StartPoint_userId_idx" ON "StartPoint"("userId");

-- AddForeignKey
ALTER TABLE "StartPoint" ADD CONSTRAINT "StartPoint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayState" ADD CONSTRAINT "DayState_startPointId_fkey" FOREIGN KEY ("startPointId") REFERENCES "StartPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
