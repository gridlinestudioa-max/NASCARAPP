-- CreateEnum
CREATE TYPE "TierAssignmentSource" AS ENUM ('AUTO', 'MANUAL');

-- AlterTable
ALTER TABLE "DriverTierAssignment" ADD COLUMN     "source" "TierAssignmentSource" NOT NULL DEFAULT 'AUTO';
