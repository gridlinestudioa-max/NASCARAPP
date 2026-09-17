"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function submitPick(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const leagueId = formData.get("leagueId");
  const raceId = formData.get("raceId");
  const driverId = formData.get("driverId");

  if (typeof leagueId !== "string" || typeof raceId !== "string" || typeof driverId !== "string" || !driverId) {
    return "Pick a driver first.";
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

  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver) {
    return "Unknown driver.";
  }

  await prisma.pick.upsert({
    where: { leagueId_userId_raceId: { leagueId, userId, raceId } },
    update: { driverId },
    create: { leagueId, userId, raceId, driverId },
  });

  revalidatePath(`/leagues/${leagueId}/races/${raceId}`);
  return undefined;
}
