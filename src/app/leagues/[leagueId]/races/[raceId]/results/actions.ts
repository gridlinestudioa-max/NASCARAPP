"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeScore, parseScoringConfig } from "@/lib/scoring";

export async function submitResults(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const leagueId = formData.get("leagueId");
  const raceId = formData.get("raceId");
  const driverIds = formData.getAll("driverId");

  if (typeof leagueId !== "string" || typeof raceId !== "string" || driverIds.length === 0) {
    return "Missing race or driver data.";
  }

  const session = await auth();
  if (!session?.user?.id) {
    return "You need to be signed in to enter results.";
  }

  const membership = await prisma.leagueMembership.findUnique({
    where: { leagueId_userId: { leagueId, userId: session.user.id } },
  });
  if (!membership || membership.role !== "OWNER") {
    return "Only a league owner can enter results.";
  }

  const race = await prisma.race.findUnique({ where: { id: raceId } });
  if (!race) {
    return "Race not found.";
  }
  const leagueSeason = await prisma.leagueSeason.findUnique({
    where: { leagueId_seasonId: { leagueId, seasonId: race.seasonId } },
  });
  if (!leagueSeason) {
    return "Race not found.";
  }

  // Only finishing positions for drivers someone actually picked are
  // collected (see ResultsForm) — that's the minimum needed to score every
  // pick on this race, across every league that shares it.
  const finishPositions = new Map<string, number>();
  for (const driverId of driverIds) {
    if (typeof driverId !== "string") continue;
    const raw = formData.get(`finish-${driverId}`);
    const finishPosition = typeof raw === "string" ? parseInt(raw, 10) : NaN;
    if (!Number.isInteger(finishPosition) || finishPosition < 1) {
      return "Enter a valid finishing position for every driver.";
    }
    finishPositions.set(driverId, finishPosition);
  }

  await prisma.$transaction(async (tx) => {
    for (const [driverId, finishPosition] of finishPositions) {
      await tx.raceResult.upsert({
        where: { raceId_driverId: { raceId, driverId } },
        update: { finishingPosition: finishPosition },
        create: { raceId, driverId, finishingPosition: finishPosition },
      });
    }

    // Results are shared data — recompute scores for every league's picks
    // on this race, not just the league the submitter belongs to.
    const picks = await tx.pick.findMany({
      where: { raceId, driverId: { in: [...finishPositions.keys()] } },
    });
    const leagueIds = [...new Set(picks.map((p) => p.leagueId))];
    const leagueSeasons = await tx.leagueSeason.findMany({
      where: { leagueId: { in: leagueIds }, seasonId: race.seasonId },
      include: { ruleSet: true },
    });
    const configByLeagueId = new Map(
      leagueSeasons.map((ls) => [ls.leagueId, parseScoringConfig(ls.ruleSet.config)]),
    );

    for (const pick of picks) {
      const config = configByLeagueId.get(pick.leagueId);
      if (!config) continue;
      const finishPosition = finishPositions.get(pick.driverId)!;
      const score = computeScore(finishPosition, race.fieldSize, config);
      await tx.score.upsert({
        where: { pickId: pick.id },
        update: { finishPosition, ...score, needsReview: false },
        create: { pickId: pick.id, finishPosition, ...score, needsReview: false },
      });
    }

    await tx.race.update({ where: { id: raceId }, data: { status: "COMPLETE" } });
  });

  revalidatePath(`/leagues/${leagueId}/races/${raceId}`);
  redirect(`/leagues/${leagueId}/races/${raceId}`);
}
