"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseRuleSetConfig } from "@/lib/scoring";

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
  // Picks close once the race has results recorded or has already happened —
  // whichever field flips first, since this app doesn't backfill picks for
  // races that ran outside it.
  const alreadyScored = race.picks.some((p) => p.score);
  if (alreadyScored || race.date.getTime() <= Date.now()) {
    return "Picks are closed for this race.";
  }

  const config = parseRuleSetConfig(leagueSeason.ruleSet.config);

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
