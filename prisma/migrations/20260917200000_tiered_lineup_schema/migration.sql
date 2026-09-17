-- Schema support for the Tiered Lineup league type.
--
-- 1. Race gains qualifyingAt (nullable) — drives lock timing for both
--    league types.
-- 2. New QualifyingResult table — shared qualifying results, like
--    RaceResult/StageResult.
-- 3. Tier is replaced by a fixed DriverTier enum (A/B/C): the real game
--    only ever has three fixed tiers, not a per-league-configurable set,
--    and the table has never been populated, so DriverTierAssignment.tierId
--    and Pick.tierId (both FKs into it) are dropped and replaced cleanly
--    rather than migrated.
-- 4. Score gains qualifyingPosition/qualifyingBonus for Tiered Lineup
--    scoring (every rostered driver, starter or bench, scores qualifying
--    points).

-- 1. Race.qualifyingAt
ALTER TABLE "Race" ADD COLUMN "qualifyingAt" TIMESTAMP(3);

-- 2. QualifyingResult
CREATE TABLE "QualifyingResult" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "qualifyingPosition" INTEGER NOT NULL,

    CONSTRAINT "QualifyingResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QualifyingResult_raceId_driverId_key" ON "QualifyingResult"("raceId", "driverId");

ALTER TABLE "QualifyingResult" ADD CONSTRAINT "QualifyingResult_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QualifyingResult" ADD CONSTRAINT "QualifyingResult_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Tier -> fixed DriverTier enum
CREATE TYPE "DriverTier" AS ENUM ('A', 'B', 'C');

ALTER TABLE "Pick" DROP CONSTRAINT "Pick_tierId_fkey";
ALTER TABLE "Pick" DROP COLUMN "tierId";

ALTER TABLE "DriverTierAssignment" DROP CONSTRAINT "DriverTierAssignment_tierId_fkey";
ALTER TABLE "DriverTierAssignment" DROP COLUMN "tierId";
ALTER TABLE "DriverTierAssignment" ADD COLUMN "tier" "DriverTier" NOT NULL;

DROP TABLE "Tier";

-- 4. Score qualifying fields
ALTER TABLE "Score" ADD COLUMN "qualifyingPosition" INTEGER;
ALTER TABLE "Score" ADD COLUMN "qualifyingBonus" INTEGER NOT NULL DEFAULT 0;
