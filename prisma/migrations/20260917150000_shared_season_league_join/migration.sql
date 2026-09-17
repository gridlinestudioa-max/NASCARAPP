-- Seasons/races move from being owned by one League to being shared,
-- real-world schedule data every league can take part in. A league's
-- participation (and which of its own RuleSets scores it) now lives in
-- the new LeagueSeason join table. Existing Season/RuleSet data is carried
-- over rather than dropped.

-- CreateTable
CREATE TABLE "LeagueSeason" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "ruleSetId" TEXT NOT NULL,

    CONSTRAINT "LeagueSeason_pkey" PRIMARY KEY ("id")
);

-- Backfill: one LeagueSeason row per existing Season, carrying over its
-- current leagueId/ruleSetId before those columns are dropped.
INSERT INTO "LeagueSeason" ("id", "leagueId", "seasonId", "ruleSetId")
SELECT gen_random_uuid()::text, s."leagueId", s.id, s."ruleSetId"
FROM "Season" s;

-- AlterTable: give every existing League a real invite code before the
-- column becomes NOT NULL (can't use a Prisma-level default against
-- existing rows).
ALTER TABLE "League" ADD COLUMN "inviteCode" TEXT;
UPDATE "League" SET "inviteCode" = gen_random_uuid()::text WHERE "inviteCode" IS NULL;
ALTER TABLE "League" ALTER COLUMN "inviteCode" SET NOT NULL;
CREATE UNIQUE INDEX "League_inviteCode_key" ON "League"("inviteCode");

-- DropForeignKey
ALTER TABLE "Season" DROP CONSTRAINT "Season_leagueId_fkey";
ALTER TABLE "Season" DROP CONSTRAINT "Season_ruleSetId_fkey";

-- DropIndex
DROP INDEX "Season_leagueId_year_key";

-- AlterTable
ALTER TABLE "Season" DROP COLUMN "leagueId",
DROP COLUMN "ruleSetId";

-- CreateIndex
CREATE UNIQUE INDEX "Season_year_key" ON "Season"("year");
CREATE UNIQUE INDEX "LeagueSeason_leagueId_seasonId_key" ON "LeagueSeason"("leagueId", "seasonId");

-- AddForeignKey
ALTER TABLE "LeagueSeason" ADD CONSTRAINT "LeagueSeason_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeagueSeason" ADD CONSTRAINT "LeagueSeason_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeagueSeason" ADD CONSTRAINT "LeagueSeason_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "RuleSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
