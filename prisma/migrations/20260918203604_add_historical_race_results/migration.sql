-- CreateTable
CREATE TABLE "HistoricalRaceResult" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "trackName" TEXT NOT NULL,
    "finishingPosition" INTEGER NOT NULL,
    "driverId" TEXT NOT NULL,

    CONSTRAINT "HistoricalRaceResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HistoricalRaceResult_trackName_idx" ON "HistoricalRaceResult"("trackName");

-- CreateIndex
CREATE UNIQUE INDEX "HistoricalRaceResult_year_trackName_driverId_key" ON "HistoricalRaceResult"("year", "trackName", "driverId");

-- AddForeignKey
ALTER TABLE "HistoricalRaceResult" ADD CONSTRAINT "HistoricalRaceResult_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
