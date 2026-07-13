-- AlterTable
ALTER TABLE "WeeklyPlan" ADD COLUMN     "aiProposalAt" TIMESTAMP(3),
ADD COLUMN     "aiProposalJson" JSONB;
