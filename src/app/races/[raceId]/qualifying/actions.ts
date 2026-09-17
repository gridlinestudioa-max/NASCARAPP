"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ownsALeagueInSeason } from "@/lib/authz";
import { parseTieredDraftRuleSetConfig, scoreTieredQualifying } from "@/lib/tieredDraft";

export async function submitQualifying(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const raceId = formData.get("raceId");
  if (typeof raceId !== "string") {
    return "Missing race.";
  }

  const session = await auth();
  if (!session?.user?.id) {
    return "You need to be signed in to enter qualifying results.";
  }

  const race = await prisma.race.findUnique({ where: { id: raceId } });
  if (!race) {
    return "Race not found.";
  }

  const authorized = await ownsALeagueInSeason(session.user.id, race.seasonId);
  if (!authorized) {
    return "Only a league owner in this season can enter qualifying results.";
  }

  const tierAssignments = await prisma.driverTierAssignment.findMany({ where: { raceId } });

  const positions = new Map<string, number>();
  for (const { driverId } of tierAssignments) {
    const raw = formData.get(`position-${driverId}`);
    if (typeof raw !== "string" || raw.trim() === "") continue;
    const position = parseInt(raw, 10);
    if (!Number.isInteger(position) || position < 1) {
      return "Enter a valid qualifying position for every driver you fill in.";
    }
    positions.set(driverId, position);
  }
  if (new Set(positions.values()).size !== positions.size) {
    return "Two drivers can't share the same qualifying position.";
  }

  await prisma.$transaction(async (tx) => {
    for (const [driverId, qualifyingPosition] of positions) {
      await tx.qualifyingResult.upsert({
        where: { raceId_driverId: { raceId, driverId } },
        update: { qualifyingPosition },
        create: { raceId, driverId, qualifyingPosition },
      });
    }

    const tieredLeagueSeasons = await tx.leagueSeason.findMany({
      where: { seasonId: race.seasonId, league: { type: "TIERED_DRAFT" } },
      include: { ruleSet: true },
    });
    const configByLeagueId = new Map(
      tieredLeagueSeasons.map((ls) => [ls.leagueId, parseTieredDraftRuleSetConfig(ls.ruleSet.config)]),
    );
    await scoreTieredQualifying(tx, raceId, positions, configByLeagueId);
  });

  revalidatePath(`/races/${raceId}`);
  redirect(`/races/${raceId}`);
}
