-- Tighten the Pick uniqueness constraint from (leagueId, userId, raceId,
-- driverId) to (leagueId, userId, raceId): a user should hold at most one
-- pick per race per league (every RuleSet so far has picksPerWeek: 1), but
-- the old constraint only blocked an exact duplicate driver, not a second
-- different-driver pick for the same week.
DROP INDEX "Pick_leagueId_userId_raceId_driverId_key";

CREATE UNIQUE INDEX "Pick_leagueId_userId_raceId_key" ON "Pick"("leagueId", "userId", "raceId");
