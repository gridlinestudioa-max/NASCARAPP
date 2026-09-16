-- AlterTable
ALTER TABLE "Race" ADD COLUMN     "isNonPoints" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Score" ADD COLUMN     "finishPosition" INTEGER,
ADD COLUMN     "needsReview" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "baseScore" DROP NOT NULL,
ALTER COLUMN "winBonus" DROP NOT NULL;
