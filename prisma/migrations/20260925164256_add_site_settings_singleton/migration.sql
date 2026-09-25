-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "currentSeasonId" TEXT,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SiteSettings" ADD CONSTRAINT "SiteSettings_currentSeasonId_fkey" FOREIGN KEY ("currentSeasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;
