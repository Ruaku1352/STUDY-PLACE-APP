-- AlterTable
ALTER TABLE "DayState" ADD COLUMN     "weatherFetchedAt" TIMESTAMP(3),
ADD COLUMN     "weatherJson" JSONB;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "homeLat" DOUBLE PRECISION,
ADD COLUMN     "homeLng" DOUBLE PRECISION;
