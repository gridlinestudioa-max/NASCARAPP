// The site-wide "current" season — see SiteSettings in schema.prisma for
// why this is a separate pointer rather than always "the newest Season by
// year": it lets /admin/season-setup prep next year's schedule and roster
// ahead of time without that season going live until advanceToNextSeason
// is actually clicked.

import { prisma } from "@/lib/prisma";
import type { Driver, Season } from "@prisma/client";

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

// A driver's roster membership for one season: a SeasonDriver row for that
// season overrides Driver.isActive when present, per-driver — a season
// with zero SeasonDriver rows (every season before this model existed,
// and any season whose roster no one has touched yet) behaves exactly as
// it always did, driven entirely by the shared Driver.isActive flag.
async function mergeSeasonDrivers(seasonId: string): Promise<{ driver: Driver; isActive: boolean }[]> {
  const [drivers, overrides] = await Promise.all([
    prisma.driver.findMany({ orderBy: { name: "asc" } }),
    prisma.seasonDriver.findMany({ where: { seasonId } }),
  ]);
  const overrideById = new Map(overrides.map((o) => [o.driverId, o.isActive]));
  return drivers.map((driver) => ({ driver, isActive: overrideById.get(driver.id) ?? driver.isActive }));
}

// The driver-eligibility list for one race week (tier assignment, Pick'em
// picks) — every league drafts from the same season-scoped roster.
export async function getActiveDriversForSeason(seasonId: string): Promise<Driver[]> {
  const merged = await mergeSeasonDrivers(seasonId);
  return merged.filter((m) => m.isActive).map((m) => m.driver);
}

// Every driver (active or not) with their effective status for this
// season — for the /admin/season-setup roster editor, which needs to show
// and toggle inactive drivers too (e.g. to reactivate someone for next
// year).
export async function getAllDriversForSeasonAdmin(
  seasonId: string,
): Promise<{ id: string; name: string; number: number | null; team: string | null; isActive: boolean }[]> {
  const merged = await mergeSeasonDrivers(seasonId);
  return merged.map(({ driver, isActive }) => ({
    id: driver.id,
    name: driver.name,
    number: driver.number,
    team: driver.team,
    isActive,
  }));
}
