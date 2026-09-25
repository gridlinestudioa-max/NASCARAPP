"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSiteAdmin } from "@/lib/authz";
import { getAllDriversForSeasonAdmin, getCurrentSeason } from "@/lib/season";

async function requireAdmin(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id || !isSiteAdmin(session.user.email)) {
    return "Not authorized.";
  }
  return null;
}

function revalidateEverywhere() {
  revalidatePath("/admin/season-setup");
  revalidatePath("/admin");
  revalidatePath("/races");
  revalidatePath("/", "layout");
  revalidatePath("/stats");
}

// ---------- Drivers (Driver itself is site-wide — name/number/team apply
// everywhere immediately — but roster *membership* for a race is scoped
// per season via SeasonDriver; see lib/season.ts) ----------

export async function addDriver(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const nameRaw = formData.get("name");
  if (typeof nameRaw !== "string" || !nameRaw.trim()) return "Driver name can't be blank.";
  const name = nameRaw.trim();

  const numberRaw = formData.get("number");
  const number = typeof numberRaw === "string" && numberRaw.trim() ? Number(numberRaw) : null;
  if (number != null && !Number.isInteger(number)) return "Car number must be a whole number.";

  const teamRaw = formData.get("team");
  const team = typeof teamRaw === "string" && teamRaw.trim() ? teamRaw.trim() : null;

  // The season this driver is being added for, and (when adding from the
  // Next Year tab) the still-in-progress season they should NOT show up
  // in yet — both optional so this still works if a season isn't in play.
  const seasonId = formData.get("seasonId");
  const pinOutOfSeasonId = formData.get("pinOutOfSeasonId");

  const existing = await prisma.driver.findUnique({ where: { name } });
  if (existing) return `${name} is already on the roster.`;

  await prisma.$transaction(async (tx) => {
    const driver = await tx.driver.create({ data: { name, number, team } });
    if (typeof seasonId === "string" && seasonId) {
      await tx.seasonDriver.upsert({
        where: { seasonId_driverId: { seasonId, driverId: driver.id } },
        update: { isActive: true },
        create: { seasonId, driverId: driver.id, isActive: true },
      });
    }
    if (typeof pinOutOfSeasonId === "string" && pinOutOfSeasonId && pinOutOfSeasonId !== seasonId) {
      await tx.seasonDriver.upsert({
        where: { seasonId_driverId: { seasonId: pinOutOfSeasonId, driverId: driver.id } },
        update: { isActive: false },
        create: { seasonId: pinOutOfSeasonId, driverId: driver.id, isActive: false },
      });
    }
  });

  revalidateEverywhere();
  return `Added ${name} to the roster.`;
}

// Edits a driver's shared name/number/team fields (Driver itself) and
// their roster membership for one specific season (SeasonDriver) in one
// save — the active checkbox on /admin/season-setup only ever affects the
// season tab it's shown on, never the driver globally.
export async function updateDriverForSeason(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const driverId = formData.get("driverId");
  const seasonId = formData.get("seasonId");
  if (typeof driverId !== "string" || typeof seasonId !== "string" || !seasonId) return "Missing driver or season.";

  const numberRaw = formData.get("number");
  const number = typeof numberRaw === "string" && numberRaw.trim() ? Number(numberRaw) : null;
  if (number != null && !Number.isInteger(number)) return "Car number must be a whole number.";

  const teamRaw = formData.get("team");
  const team = typeof teamRaw === "string" && teamRaw.trim() ? teamRaw.trim() : null;
  const isActive = formData.get("isActive") === "on";

  await prisma.$transaction([
    prisma.driver.update({ where: { id: driverId }, data: { number, team } }),
    prisma.seasonDriver.upsert({
      where: { seasonId_driverId: { seasonId, driverId } },
      update: { isActive },
      create: { seasonId, driverId, isActive },
    }),
  ]);

  revalidateEverywhere();
  return "Saved.";
}

// Snapshots one season's effective roster (SeasonDriver override, or each
// Driver's own isActive) as explicit SeasonDriver rows for another season
// — the "duplicate, then edit independently" starting point. Safe to
// re-run any time (e.g. to reset next year's roster back to a copy of
// this year's current state) since it always overwrites toSeasonId's rows
// with a fresh snapshot.
export async function duplicateRoster(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const fromSeasonId = formData.get("fromSeasonId");
  const toSeasonId = formData.get("toSeasonId");
  if (typeof fromSeasonId !== "string" || typeof toSeasonId !== "string" || !fromSeasonId || !toSeasonId) {
    return "Missing seasons to duplicate between.";
  }

  const effectiveRoster = await getAllDriversForSeasonAdmin(fromSeasonId);
  await prisma.$transaction(
    effectiveRoster.map((d) =>
      prisma.seasonDriver.upsert({
        where: { seasonId_driverId: { seasonId: toSeasonId, driverId: d.id } },
        update: { isActive: d.isActive },
        create: { seasonId: toSeasonId, driverId: d.id, isActive: d.isActive },
      }),
    ),
  );

  revalidateEverywhere();
  return `Duplicated the roster (${effectiveRoster.filter((d) => d.isActive).length} active drivers).`;
}

// ---------- Season schedule ----------

// "" (the <select>'s default) means auto-match by trackName — see
// RACE_LOGO_OPTIONS/getRaceLogo in lib/raceLogos.ts.
function parseLogoOverride(formData: FormData): string | null {
  const raw = formData.get("logoOverride");
  return typeof raw === "string" && raw ? raw : null;
}

export async function addRace(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const seasonId = formData.get("seasonId");
  const trackNameRaw = formData.get("trackName");
  const dateRaw = formData.get("date");
  const weekRaw = formData.get("week");
  const fieldSizeRaw = formData.get("fieldSize");
  const isNonPoints = formData.get("isNonPoints") === "on";
  const logoOverride = parseLogoOverride(formData);

  if (typeof seasonId !== "string" || typeof trackNameRaw !== "string" || typeof dateRaw !== "string") {
    return "Missing season, track name, or date.";
  }
  const trackName = trackNameRaw.trim();
  if (!trackName) return "Track name can't be blank.";

  const date = new Date(dateRaw);
  if (Number.isNaN(date.getTime())) return "Enter a valid date.";

  const week = typeof weekRaw === "string" && weekRaw.trim() ? Number(weekRaw) : null;
  if (week == null || !Number.isInteger(week) || week < 1) return "Enter a valid week number.";

  const fieldSize = typeof fieldSizeRaw === "string" && fieldSizeRaw.trim() ? Number(fieldSizeRaw) : 40;
  if (!Number.isInteger(fieldSize) || fieldSize < 1) return "Field size must be a whole number.";

  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!season) return "Season not found.";

  const clash = await prisma.race.findUnique({ where: { seasonId_week: { seasonId, week } } });
  if (clash) return `Week ${week} already has a race (${clash.trackName}) — edit or delete it first.`;

  await prisma.race.create({ data: { seasonId, week, trackName, date, fieldSize, isNonPoints, logoOverride } });
  revalidateEverywhere();
  return `Added week ${week} — ${trackName}.`;
}

export async function updateRace(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const raceId = formData.get("raceId");
  const trackNameRaw = formData.get("trackName");
  const dateRaw = formData.get("date");
  const weekRaw = formData.get("week");
  const fieldSizeRaw = formData.get("fieldSize");
  const isNonPoints = formData.get("isNonPoints") === "on";
  const logoOverride = parseLogoOverride(formData);

  if (typeof raceId !== "string" || typeof trackNameRaw !== "string" || typeof dateRaw !== "string") {
    return "Missing race, track name, or date.";
  }
  const trackName = trackNameRaw.trim();
  if (!trackName) return "Track name can't be blank.";

  const date = new Date(dateRaw);
  if (Number.isNaN(date.getTime())) return "Enter a valid date.";

  const week = typeof weekRaw === "string" && weekRaw.trim() ? Number(weekRaw) : null;
  if (week == null || !Number.isInteger(week) || week < 1) return "Enter a valid week number.";

  const fieldSize = typeof fieldSizeRaw === "string" && fieldSizeRaw.trim() ? Number(fieldSizeRaw) : null;
  if (fieldSize == null || !Number.isInteger(fieldSize) || fieldSize < 1) return "Field size must be a whole number.";

  const race = await prisma.race.findUnique({ where: { id: raceId } });
  if (!race) return "Race not found.";

  if (week !== race.week) {
    const clash = await prisma.race.findUnique({ where: { seasonId_week: { seasonId: race.seasonId, week } } });
    if (clash) return `Week ${week} already has a race (${clash.trackName}).`;
  }

  await prisma.race.update({
    where: { id: raceId },
    data: { trackName, date, week, fieldSize, isNonPoints, logoOverride },
  });
  revalidateEverywhere();
  return "Race updated.";
}

// Swaps this race's week with the adjacent race (by week order) in the
// same season — the simplest safe reorder primitive: it can't collide
// with a third race's week, and two calls move a race past a neighbor.
export async function moveRace(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const raceId = formData.get("raceId");
  const direction = formData.get("direction");
  if (typeof raceId !== "string" || (direction !== "up" && direction !== "down")) {
    return "Missing race or direction.";
  }

  const race = await prisma.race.findUnique({ where: { id: raceId } });
  if (!race) return "Race not found.";

  const neighbor = await prisma.race.findFirst({
    where: { seasonId: race.seasonId, week: direction === "up" ? { lt: race.week } : { gt: race.week } },
    orderBy: { week: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbor) return direction === "up" ? "Already at the top of the schedule." : "Already at the bottom of the schedule.";

  await prisma.$transaction([
    // A temporary, guaranteed-unused week avoids the seasonId+week unique
    // constraint rejecting the swap's first write.
    prisma.race.update({ where: { id: race.id }, data: { week: -1 } }),
    prisma.race.update({ where: { id: neighbor.id }, data: { week: race.week } }),
    prisma.race.update({ where: { id: race.id }, data: { week: neighbor.week } }),
  ]);
  revalidateEverywhere();
  return "Reordered.";
}

// Copies every race from one season into another — the "duplicate, then
// tweak dates/order/logos" starting point for a season whose real
// schedule isn't synced yet. Dates are shifted a year forward (same
// month/day) as a reasonable starting guess; nascarRaceId/venueName/
// qualifyingAt are left unset so the new races match fresh against a
// future sync instead of inheriting stale links from last year's races.
export async function duplicateSchedule(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const fromSeasonId = formData.get("fromSeasonId");
  const toSeasonId = formData.get("toSeasonId");
  if (typeof fromSeasonId !== "string" || typeof toSeasonId !== "string" || !fromSeasonId || !toSeasonId) {
    return "Missing seasons to duplicate between.";
  }

  const existingCount = await prisma.race.count({ where: { seasonId: toSeasonId } });
  if (existingCount > 0) return "This season already has races — remove them first to duplicate over.";

  const sourceRaces = await prisma.race.findMany({ where: { seasonId: fromSeasonId }, orderBy: { week: "asc" } });
  if (sourceRaces.length === 0) return "The season to duplicate from has no races yet.";

  await prisma.race.createMany({
    data: sourceRaces.map((r) => {
      const date = new Date(r.date);
      date.setFullYear(date.getFullYear() + 1);
      return {
        seasonId: toSeasonId,
        week: r.week,
        trackName: r.trackName,
        date,
        fieldSize: r.fieldSize,
        isNonPoints: r.isNonPoints,
        logoOverride: r.logoOverride,
      };
    }),
  });

  revalidateEverywhere();
  return `Duplicated ${sourceRaces.length} races.`;
}

export async function deleteRace(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const raceId = formData.get("raceId");
  if (typeof raceId !== "string") return "Missing race.";

  const [resultCount, entryCount, qualifyingCount, pickCount] = await Promise.all([
    prisma.raceResult.count({ where: { raceId } }),
    prisma.raceEntry.count({ where: { raceId } }),
    prisma.qualifyingResult.count({ where: { raceId } }),
    prisma.pick.count({ where: { raceId } }),
  ]);
  if (resultCount > 0 || entryCount > 0 || qualifyingCount > 0 || pickCount > 0) {
    return "Can't delete a race that already has entries, qualifying, results, or picks recorded.";
  }

  await prisma.race.delete({ where: { id: raceId } });
  revalidateEverywhere();
  return "Race removed.";
}

// ---------- Season rollover ----------

export type AdvanceSeasonResult = { ok: true; message: string } | { ok: false; error: string };

// Flips the site's "current season" pointer forward one year. Every
// League with a LeagueSeason in the outgoing season is carried forward
// automatically (that's what "continuing" means here — there's no
// per-league opt-out today, every active league renews): each gets a
// fresh RuleSet cloned from its current one — RuleSets are never edited
// in place once a season uses them, see schema.prisma — and a new
// LeagueSeason linking to the new season, so its commissioner can tweak
// next year's rules independently without touching past-season scoring
// or history. Nothing about past Race/Pick/Score rows changes — they
// stay attached to the old Season forever, which is what keeps a
// league's multi-year history intact after this runs.
export async function advanceToNextSeason(): Promise<AdvanceSeasonResult> {
  const unauthorized = await requireAdmin();
  if (unauthorized) return { ok: false, error: unauthorized };

  const currentSeason = await getCurrentSeason();
  if (!currentSeason) return { ok: false, error: "No current season is set up yet." };

  const nextSeason = await prisma.season.findUnique({ where: { year: currentSeason.year + 1 } });
  if (!nextSeason) return { ok: false, error: `No ${currentSeason.year + 1} season has been created yet.` };

  const nextRaceCount = await prisma.race.count({ where: { seasonId: nextSeason.id } });
  if (nextRaceCount === 0) {
    return { ok: false, error: `Add at least one race to the ${nextSeason.year} schedule before advancing.` };
  }

  const continuingLeagueSeasons = await prisma.leagueSeason.findMany({
    where: { seasonId: currentSeason.id },
    include: { ruleSet: true },
  });

  let carriedForward = 0;
  await prisma.$transaction(async (tx) => {
    for (const ls of continuingLeagueSeasons) {
      const alreadyContinuing = await tx.leagueSeason.findUnique({
        where: { leagueId_seasonId: { leagueId: ls.leagueId, seasonId: nextSeason.id } },
      });
      if (alreadyContinuing) continue;

      const newRuleSet = await tx.ruleSet.create({
        data: {
          leagueId: ls.leagueId,
          label: `${nextSeason.year} Season Rules`,
          config: ls.ruleSet.config as object,
        },
      });
      await tx.leagueSeason.create({
        data: { leagueId: ls.leagueId, seasonId: nextSeason.id, ruleSetId: newRuleSet.id },
      });
      carriedForward++;
    }

    await tx.siteSettings.upsert({
      where: { id: "singleton" },
      update: { currentSeasonId: nextSeason.id },
      create: { id: "singleton", currentSeasonId: nextSeason.id },
    });
  });

  revalidateEverywhere();
  return {
    ok: true,
    message: `The site is now on the ${nextSeason.year} season. ${carriedForward} league${carriedForward === 1 ? "" : "s"} carried forward with all past-season data intact.`,
  };
}
