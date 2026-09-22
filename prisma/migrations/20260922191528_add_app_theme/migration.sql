-- CreateTable
CREATE TABLE "AppTheme" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "ink" TEXT NOT NULL DEFAULT '#2e2e2e',
    "pageBg" TEXT NOT NULL DEFAULT '#ffffff',
    "surface" TEXT NOT NULL DEFAULT '#f7f7f7',
    "border" TEXT NOT NULL DEFAULT '#e3e3e3',
    "accent" TEXT NOT NULL DEFAULT '#000000',
    "headingFont" TEXT NOT NULL DEFAULT 'Barlow',
    "radius" INTEGER NOT NULL DEFAULT 14,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppTheme_pkey" PRIMARY KEY ("id")
);
