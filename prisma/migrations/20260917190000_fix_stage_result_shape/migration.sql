-- StageResult's original unique([raceId, stageNumber]) only allowed one
-- row per stage, which can't represent a top-10 finish at all. The table
-- has never had any rows written to it, so this is a clean shape fix, not
-- a data migration.

ALTER TABLE "StageResult" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "StageResult" ALTER COLUMN "position" DROP DEFAULT;

DROP INDEX "StageResult_raceId_stageNumber_key";
CREATE UNIQUE INDEX "StageResult_raceId_stageNumber_position_key" ON "StageResult"("raceId", "stageNumber", "position");
CREATE UNIQUE INDEX "StageResult_raceId_stageNumber_driverId_key" ON "StageResult"("raceId", "stageNumber", "driverId");
