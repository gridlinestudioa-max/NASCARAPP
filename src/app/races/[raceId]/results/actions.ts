"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ownsALeagueInSeason } from "@/lib/authz";
import { computeScore, parseRuleSetConfig } from "@/lib/scoring";
import { materializeCarriedOverLineups, parseTieredDraftRuleSetConfig, scoreTieredFinish } from "@/lib/tieredDraft";

function parseOptionalStagePosition(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const n = parseInt(raw, 10);
  return Number.isInteger(n) && n >= 1 && n <= 10 ? n : null;
}

export async function submitResults(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const raceId = formData.get("raceId");
  const driverIds = formData.getAll("driverId");

  if (typeof raceId !== "string" || driverIds.length === 0) {
    return "Missing race or driver data.";
  }

  const session = await auth();
  if (!session?.user?.id) {
    return "You need to be signed in to enter results.";
  }

  const race = await prisma.race.findUnique({ where: { id: raceId } });
  if (!race) {
    return "Race not found.";
  }

  const authorized = await ownsALeagueInSeason(session.user.id, race.seasonId);
  if (!authorized) {
    return "Only an owner of a league in this season can enter results.";
  }

  // Only finishing positions for drivers someone actually picked are
  // collected (see ResultsForm) — that's the minimum needed to score every
  // pick on this race, across every league that shares it. Stage top-10s
  // are optional (blank = not top 10 that stage).
  const finishPositions = new Map<string, number>();
  const stage1Positions = new Map<string, number>();
  const stage2Positions = new Map<string, number>();
  for (const driverId of driverIds) {
    if (typeof driverId !== "string") continue;
    const raw = formData.get(`finish-${driverId}`);
    const finishPosition = typeof raw === "string" ? parseInt(raw, 10) : NaN;
    if (!Number.isInteger(finishPosition) || finishPosition < 1) {
      return "Enter a valid finishing position for every driver.";
    }
    finishPositions.set(driverId, finishPosition);

    const stage1 = parseOptionalStagePosition(formData, `stage1-${driverId}`);
    if (stage1 != null) stage1Positions.set(driverId, stage1);
    const stage2 = parseOptionalStagePosition(formData, `stage2-${driverId}`);
    if (stage2 != null) stage2Positions.set(driverId, stage2);
  }
  // A stage position can only be claimed by one driver.
  if (new Set(stage1Positions.values()).size !== stage1Positions.size) {
    return "Two drivers can't share the same Stage 1 finishing position.";
  }
  if (new Set(stage2Positions.values()).size !== stage2Positions.size) {
    return "Two drivers can't share the same Stage 2 finishing position.";
  }

  await prisma.$transaction(async (tx) => {
    for (const [driverId, finishPosition] of finishPositions) {
      await tx.raceResult.upsert({
        where: { raceId_driverId: { raceId, driverId } },
        update: { finishingPosition: finishPosition },
        create: { raceId, driverId, finishingPosition: finishPosition },
      });

      for (const [stageNumber, stagePositions] of [
        [1, stage1Positions],
        [2, stage2Positions],
      ] as const) {
        const position = stagePositions.get(driverId);
        if (position != null) {
          await tx.stageResult.upsert({
            where: { raceId_stageNumber_driverId: { raceId, stageNumber, driverId } },
            update: { position },
            create: { raceId, stageNumber, position, driverId },
          });
        } else {
          await tx.stageResult.deleteMany({ where: { raceId, stageNumber, driverId } });
        }
      }
    }

    // Before scoring, make sure every Tiered Lineup member who never
    // touched their lineup this week has one carried forward from their
    // last set lineup — otherwise they'd silently score nothing.
    await materializeCarriedOverLineups(tx, raceId);

    // Results are shared data — recompute scores for every league's picks
    // on this race, not just the submitter's own league. Pick'em and
    // Tiered Lineup leagues score under entirely different formulas, so
    // they're handled separately below.
    const picks = await tx.pick.findMany({
      where: { raceId, driverId: { in: [...finishPositions.keys()] } },
      include: { league: true },
    });
    const pickemLeagueIds = [...new Set(picks.filter((p) => p.league.type === "PICKEM").map((p) => p.leagueId))];
    const leagueSeasons = await tx.leagueSeason.findMany({
      where: { leagueId: { in: pickemLeagueIds }, seasonId: race.seasonId },
      include: { ruleSet: true },
    });
    const configByLeagueId = new Map(
      leagueSeasons.map((ls) => [ls.leagueId, parseRuleSetConfig(ls.ruleSet.config)]),
    );

    for (const pick of picks) {
      if (pick.league.type !== "PICKEM") continue;
      const config = configByLeagueId.get(pick.leagueId);
      if (!config) continue;
      // A league that didn't opt into non-points races doesn't score picks
      // on one at all, rather than scoring them as 0 — they just stay
      // unscored, same as a race that hasn't happened yet.
      if (race.isNonPoints && !config.includeNonPointsRaces) continue;

      const finishPosition = finishPositions.get(pick.driverId)!;
      const stagePositions = [stage1Positions.get(pick.driverId), stage2Positions.get(pick.driverId)].filter(
        (p): p is number => p != null,
      );
      const score = computeScore(finishPosition, race.fieldSize, stagePositions, config);
      await tx.score.upsert({
        where: { pickId: pick.id },
        update: { finishPosition, ...score, needsReview: false },
        create: { pickId: pick.id, finishPosition, ...score, needsReview: false },
      });
    }

    const tieredLeagueIds = [...new Set(picks.filter((p) => p.league.type === "TIERED_DRAFT").map((p) => p.leagueId))];
    const tieredLeagueSeasons = await tx.leagueSeason.findMany({
      where: { leagueId: { in: tieredLeagueIds }, seasonId: race.seasonId },
      include: { ruleSet: true },
    });
    const tieredConfigByLeagueId = new Map(
      tieredLeagueSeasons.map((ls) => [ls.leagueId, parseTieredDraftRuleSetConfig(ls.ruleSet.config)]),
    );
    await scoreTieredFinish(tx, raceId, finishPositions, tieredConfigByLeagueId);

    await tx.race.update({ where: { id: raceId }, data: { status: "COMPLETE" } });
  });

  revalidatePath(`/races/${raceId}`);
  revalidatePath(`/stats`);
  redirect(`/races/${raceId}`);
}
