-- Schema support for syncing race data from NASCAR's own feed.
--
-- 1. Race gains nascarRaceId/nascarSeriesId (to fetch by) and lastSyncedAt.
-- 2. RaceResult gains lapsLed (nullable enrichment).
-- 3. New RaceEntry table — the announced field for a race week.

ALTER TABLE "Race" ADD COLUMN "nascarRaceId" INTEGER;
ALTER TABLE "Race" ADD COLUMN "nascarSeriesId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Race" ADD COLUMN "lastSyncedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Race_nascarRaceId_key" ON "Race"("nascarRaceId");

ALTER TABLE "RaceResult" ADD COLUMN "lapsLed" INTEGER;

CREATE TABLE "RaceEntry" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "carNumber" INTEGER,
    "teamName" TEXT,
    "manufacturer" TEXT,

    CONSTRAINT "RaceEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RaceEntry_raceId_driverId_key" ON "RaceEntry"("raceId", "driverId");

ALTER TABLE "RaceEntry" ADD CONSTRAINT "RaceEntry_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RaceEntry" ADD CONSTRAINT "RaceEntry_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
