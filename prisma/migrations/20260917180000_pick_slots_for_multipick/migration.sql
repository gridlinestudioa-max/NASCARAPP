-- Supports leagues where picksPerWeek > 1: a player now fills numbered
-- pick slots for a race instead of a single implicit pick. Existing picks
-- default to slot 1, which is exactly correct for every league so far
-- (all currently run picksPerWeek: 1).

ALTER TABLE "Pick" ADD COLUMN "pickNumber" INTEGER NOT NULL DEFAULT 1;

DROP INDEX "Pick_leagueId_userId_raceId_key";
CREATE UNIQUE INDEX "Pick_leagueId_userId_raceId_pickNumber_key" ON "Pick"("leagueId", "userId", "raceId", "pickNumber");
