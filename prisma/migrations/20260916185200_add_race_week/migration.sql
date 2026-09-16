-- AlterTable
ALTER TABLE "Race" ADD COLUMN     "week" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Race_seasonId_week_key" ON "Race"("seasonId", "week");

