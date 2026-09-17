"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseRuleSetConfig, pickemLockAt } from "@/lib/scoring";
import {
  LATE_SWAP_GROUPS,
  TIERED_LINEUP_SLOTS,
  lineupLockPhase,
  parseTieredDraftRuleSetConfig,
} from "@/lib/tieredDraft";

export async function submitPick(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const leagueId = formData.get("leagueId");
  const raceId = formData.get("raceId");

  if (typeof leagueId !== "string" || typeof raceId !== "string") {
    return "Missing league or race.";
  }

  const session = await auth();
  if (!session?.user?.id) {
    return "You need to be signed in to pick.";
  }
  const userId = session.user.id;

  const membership = await prisma.leagueMembership.findUnique({
    where: { leagueId_userId: { leagueId, userId } },
  });
  if (!membership) {
    return "You're not a member of this league.";
  }

  const race = await prisma.race.findUnique({
    where: { id: raceId },
    include: { picks: { where: { userId }, include: { score: true } } },
  });
  if (!race) {
    return "Race not found.";
  }
  // Scope to this league: a race id that's real but belongs to a season
  // this league doesn't take part in shouldn't be pickable through this URL.
  const leagueSeason = await prisma.leagueSeason.findUnique({
    where: { leagueId_seasonId: { leagueId, seasonId: race.seasonId } },
    include: { ruleSet: true },
  });
  if (!leagueSeason) {
    return "Race not found.";
  }
  const config = parseRuleSetConfig(leagueSeason.ruleSet.config);

  // Picks close once the race has results recorded or its lock time has
  // passed — whichever field flips first, since this app doesn't backfill
  // picks for races that ran outside it.
  const alreadyScored = race.picks.some((p) => p.score);
  if (alreadyScored || pickemLockAt(race, config.lockTiming).getTime() <= Date.now()) {
    return "Picks are closed for this race.";
  }

  const driverIds: string[] = [];
  for (let slot = 1; slot <= config.picksPerWeek; slot++) {
    const driverId = formData.get(`driverId-${slot}`);
    if (typeof driverId !== "string" || !driverId) {
      return config.picksPerWeek > 1 ? `Pick a driver for slot ${slot}.` : "Pick a driver first.";
    }
    driverIds.push(driverId);
  }
  if (new Set(driverIds).size !== driverIds.length) {
    return "You can't pick the same driver twice in one week.";
  }

  const drivers = await prisma.driver.findMany({ where: { id: { in: driverIds } } });
  if (drivers.length !== driverIds.length) {
    return "Unknown driver.";
  }
  const driverNameById = new Map(drivers.map((d) => [d.id, d.name]));

  if (config.maxPicksPerDriverPerSeason != null) {
    const seasonRaces = await prisma.race.findMany({
      where: { seasonId: race.seasonId, id: { not: raceId } },
      select: { id: true },
    });
    const priorPicks = await prisma.pick.findMany({
      where: {
        leagueId,
        userId,
        raceId: { in: seasonRaces.map((r) => r.id) },
        driverId: { in: driverIds },
      },
    });
    const countByDriver = new Map<string, number>();
    for (const p of priorPicks) {
      countByDriver.set(p.driverId, (countByDriver.get(p.driverId) ?? 0) + 1);
    }
    for (const driverId of driverIds) {
      const count = countByDriver.get(driverId) ?? 0;
      if (count + 1 > config.maxPicksPerDriverPerSeason) {
        return `You've already picked ${driverNameById.get(driverId)} the maximum ${config.maxPicksPerDriverPerSeason} time(s) this season.`;
      }
    }
  }

  await prisma.$transaction(
    driverIds.map((driverId, i) =>
      prisma.pick.upsert({
        where: { leagueId_userId_raceId_pickNumber: { leagueId, userId, raceId, pickNumber: i + 1 } },
        update: { driverId },
        create: { leagueId, userId, raceId, pickNumber: i + 1, driverId },
      }),
    ),
  );

  revalidatePath(`/leagues/${leagueId}/races/${raceId}`);
  return undefined;
}

export async function submitTieredLineup(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const leagueId = formData.get("leagueId");
  const raceId = formData.get("raceId");

  if (typeof leagueId !== "string" || typeof raceId !== "string") {
    return "Missing league or race.";
  }

  const session = await auth();
  if (!session?.user?.id) {
    return "You need to be signed in to set a lineup.";
  }
  const userId = session.user.id;

  const membership = await prisma.leagueMembership.findUnique({
    where: { leagueId_userId: { leagueId, userId } },
  });
  if (!membership) {
    return "You're not a member of this league.";
  }

  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league || league.type !== "TIERED_DRAFT") {
    return "This league doesn't use Tiered Lineup rosters.";
  }

  const race = await prisma.race.findUnique({ where: { id: raceId } });
  if (!race) {
    return "Race not found.";
  }
  const leagueSeason = await prisma.leagueSeason.findUnique({
    where: { leagueId_seasonId: { leagueId, seasonId: race.seasonId } },
    include: { ruleSet: true },
  });
  if (!leagueSeason) {
    return "Race not found.";
  }
  const config = parseTieredDraftRuleSetConfig(leagueSeason.ruleSet.config);

  const phase = lineupLockPhase(race, Date.now());
  if (phase === "locked") {
    return "Lineups are locked for this race.";
  }

  const submitted = new Map<number, string>();
  for (const slot of TIERED_LINEUP_SLOTS) {
    const driverId = formData.get(`driverId-${slot.pickNumber}`);
    if (typeof driverId !== "string" || !driverId) {
      return `Pick a ${slot.role === "STARTER" ? "starter" : "bench"} driver for Tier ${slot.tier}.`;
    }
    submitted.set(slot.pickNumber, driverId);
  }
  const allDriverIds = [...submitted.values()];
  if (new Set(allDriverIds).size !== allDriverIds.length) {
    return "Each driver can only appear once in your lineup.";
  }

  const drivers = await prisma.driver.findMany({ where: { id: { in: allDriverIds } } });
  const driverNameById = new Map(drivers.map((d) => [d.id, d.name]));
  if (drivers.length !== allDriverIds.length) {
    return "Unknown driver.";
  }

  const tierAssignments = await prisma.driverTierAssignment.findMany({
    where: { raceId, driverId: { in: allDriverIds } },
  });
  const tierByDriverId = new Map(tierAssignments.map((a) => [a.driverId, a.tier]));
  for (const slot of TIERED_LINEUP_SLOTS) {
    const driverId = submitted.get(slot.pickNumber)!;
    if (tierByDriverId.get(driverId) !== slot.tier) {
      return `${driverNameById.get(driverId)} isn't assigned to Tier ${slot.tier} this week.`;
    }
  }

  if (phase === "lateSwapOnly") {
    const existingPicks = await prisma.pick.findMany({ where: { leagueId, userId, raceId } });
    if (existingPicks.length === 0) {
      return "You didn't set a lineup before it locked, so there's nothing left to swap.";
    }
    const existingByPickNumber = new Map(existingPicks.map((p) => [p.pickNumber, p.driverId]));
    for (const group of LATE_SWAP_GROUPS) {
      const before = group.pickNumbers.map((pn) => existingByPickNumber.get(pn)).sort();
      const after = group.pickNumbers.map((pn) => submitted.get(pn)).sort();
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        return `During the late-swap window you can only swap Tier ${group.tier}'s starter(s) with its own bench driver(s) — not bring in a new driver.`;
      }
    }
  }

  // Season starts cap (starter slots only — benching a driver doesn't count).
  const starterSlots = TIERED_LINEUP_SLOTS.filter((s) => s.role === "STARTER");
  const starterDriverIds = starterSlots.map((s) => submitted.get(s.pickNumber)!);
  const seasonRaces = await prisma.race.findMany({
    where: { seasonId: race.seasonId, id: { not: raceId } },
    select: { id: true },
  });
  const priorStarterPicks = await prisma.pick.findMany({
    where: {
      leagueId,
      userId,
      raceId: { in: seasonRaces.map((r) => r.id) },
      pickNumber: { in: starterSlots.map((s) => s.pickNumber) },
      driverId: { in: starterDriverIds },
    },
  });
  const priorStartsByDriver = new Map<string, number>();
  for (const p of priorStarterPicks) {
    priorStartsByDriver.set(p.driverId, (priorStartsByDriver.get(p.driverId) ?? 0) + 1);
  }
  for (const driverId of starterDriverIds) {
    const projected = (priorStartsByDriver.get(driverId) ?? 0) + 1;
    if (projected > config.maxStartsPerDriverPerSeason) {
      return `${driverNameById.get(driverId)} has already started the maximum ${config.maxStartsPerDriverPerSeason} time(s) this season.`;
    }
  }

  await prisma.$transaction(
    TIERED_LINEUP_SLOTS.map((slot) =>
      prisma.pick.upsert({
        where: { leagueId_userId_raceId_pickNumber: { leagueId, userId, raceId, pickNumber: slot.pickNumber } },
        update: { driverId: submitted.get(slot.pickNumber)! },
        create: { leagueId, userId, raceId, pickNumber: slot.pickNumber, driverId: submitted.get(slot.pickNumber)! },
      }),
    ),
  );

  revalidatePath(`/leagues/${leagueId}/races/${raceId}`);
  return undefined;
}
