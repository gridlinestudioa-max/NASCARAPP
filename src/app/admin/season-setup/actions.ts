"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSiteAdmin } from "@/lib/authz";
import { getCurrentSeason } from "@/lib/season";

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

// ---------- Drivers (site-wide roster — see DriverRosterPanel for why
// "next year" editing is the same list as "this year" viewing) ----------

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

  const existing = await prisma.driver.findUnique({ where: { name } });
  if (existing) return `${name} is already on the roster.`;

  await prisma.driver.create({ data: { name, number, team } });
  revalidateEverywhere();
  return `Added ${name} to the roster.`;
}

export async function updateDriver(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const driverId = formData.get("driverId");
  if (typeof driverId !== "string") return "Missing driver.";

  const numberRaw = formData.get("number");
  const number = typeof numberRaw === "string" && numberRaw.trim() ? Number(numberRaw) : null;
  if (number != null && !Number.isInteger(number)) return "Car number must be a whole number.";

  const teamRaw = formData.get("team");
  const team = typeof teamRaw === "string" && teamRaw.trim() ? teamRaw.trim() : null;
  const isActive = formData.get("isActive") === "on";

  await prisma.driver.update({ where: { id: driverId }, data: { number, team, isActive } });
  revalidateEverywhere();
  return "Saved.";
}

// ---------- Season schedule ----------

export async function addRace(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const seasonId = formData.get("seasonId");
  const trackNameRaw = formData.get("trackName");
  const dateRaw = formData.get("date");
  const weekRaw = formData.get("week");
  const fieldSizeRaw = formData.get("fieldSize");
  const isNonPoints = formData.get("isNonPoints") === "on";

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

  await prisma.race.create({ data: { seasonId, week, trackName, date, fieldSize, isNonPoints } });
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

  await prisma.race.update({ where: { id: raceId }, data: { trackName, date, week, fieldSize, isNonPoints } });
  revalidateEverywhere();
  return "Race updated.";
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
