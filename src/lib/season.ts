// The site-wide "current" season — see SiteSettings in schema.prisma for
// why this is a separate pointer rather than always "the newest Season by
// year": it lets /admin/season-setup prep next year's schedule and roster
// ahead of time without that season going live until advanceToNextSeason
// is actually clicked.

import { prisma } from "@/lib/prisma";
import type { Season } from "@prisma/client";

export async function getCurrentSeason(): Promise<Season | null> {
  const settings = await prisma.siteSettings.findUnique({
    where: { id: "singleton" },
    include: { currentSeason: true },
  });
  if (settings?.currentSeason) return settings.currentSeason;

  // No pointer set yet (a database from before SiteSettings existed, or a
  // fresh one) — fall back to the newest Season by year, same behavior as
  // every call site had before, and self-heal the pointer so later reads
  // take the fast path and admin's "current season" stays consistent with
  // this fallback until someone explicitly advances it.
  const latest = await prisma.season.findFirst({ orderBy: { year: "desc" } });
  if (latest) {
    await prisma.siteSettings.upsert({
      where: { id: "singleton" },
      update: { currentSeasonId: latest.id },
      create: { id: "singleton", currentSeasonId: latest.id },
    });
  }
  return latest;
}

// Idempotent — safe to call every time the season-setup page loads.
export async function getOrCreateNextSeason(currentYear: number): Promise<Season> {
  return prisma.season.upsert({
    where: { year: currentYear + 1 },
    update: {},
    create: { year: currentYear + 1 },
  });
}
