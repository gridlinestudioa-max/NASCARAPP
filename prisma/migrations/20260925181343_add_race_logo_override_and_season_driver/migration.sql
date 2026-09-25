-- AlterTable
ALTER TABLE "Race" ADD COLUMN     "logoOverride" TEXT;

-- CreateTable
CREATE TABLE "SeasonDriver" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SeasonDriver_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeasonDriver_seasonId_driverId_key" ON "SeasonDriver"("seasonId", "driverId");

-- AddForeignKey
ALTER TABLE "SeasonDriver" ADD CONSTRAINT "SeasonDriver_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonDriver" ADD CONSTRAINT "SeasonDriver_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
