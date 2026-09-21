-- AlterTable
ALTER TABLE "Race" ADD COLUMN     "resultsNotifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifyResultsEmail" BOOLEAN NOT NULL DEFAULT true;
