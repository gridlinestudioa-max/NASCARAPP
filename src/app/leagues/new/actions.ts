"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { LeagueType } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateInviteCode } from "@/lib/inviteCode";
import { computeScore, parseRuleSetConfig, type PickemRuleSetConfig } from "@/lib/scoring";
import { parseTieredDraftRuleSetConfig, type TieredDraftRuleSetConfig } from "@/lib/tieredDraft";
import { getCurrentSeason } from "@/lib/season";

export async function createLeague(
  name: string,
  leagueType: LeagueType,
  rawConfig: PickemRuleSetConfig | TieredDraftRuleSetConfig,
): Promise<string | undefined> {
  const trimmed = name.trim();
  if (trimmed.length < 3) {
    return "League name must be at least 3 characters.";
  }

  const session = await auth();
  if (!session?.user?.id) {
    return "You need to be signed in to create a league.";
  }
  const userId = session.user.id;

  // Sanitize client-supplied config rather than trusting its shape directly.
  const config: PickemRuleSetConfig | TieredDraftRuleSetConfig =
    leagueType === "TIERED_DRAFT"
      ? parseTieredDraftRuleSetConfig(rawConfig)
      : parseRuleSetConfig(rawConfig as PickemRuleSetConfig);

  // The league takes part in whatever the current shared season is, if one
  // exists yet — a brand-new deployment with no season seeded still lets a
  // league get created, it just won't show any races until one is.
  const currentSeason = await getCurrentSeason();

  const league = await prisma.$transaction(async (tx) => {
    // Collisions are astronomically unlikely at this keyspace (32^6), but
    // cheap to guard against rather than let a unique-constraint error
    // bubble up as a confusing "create league" failure.
    let inviteCode = generateInviteCode();
    for (let attempt = 0; attempt < 5 && (await tx.league.findUnique({ where: { inviteCode } })); attempt++) {
      inviteCode = generateInviteCode();
    }

    const league = await tx.league.create({
      data: { name: trimmed, type: leagueType, ownerId: userId, inviteCode },
    });
    await tx.leagueMembership.create({
      data: { leagueId: league.id, userId, role: "OWNER" },
    });
    const ruleSet = await tx.ruleSet.create({
      data: {
        leagueId: league.id,
        label: currentSeason ? `${currentSeason.year} Season Rules` : "League Rules",
        config,
      },
    });
    if (currentSeason) {
      await tx.leagueSeason.create({
        data: { leagueId: league.id, seasonId: currentSeason.id, ruleSetId: ruleSet.id },
      });
    }
    return league;
  });

  // The sidebar's league quick-list is fetched by the root layout, which
  // Next.js otherwise keeps cached across this redirect.
  revalidatePath("/", "layout");
  redirect(`/leagues/${league.id}`);
}

export type PreviewRow = {
  driverId: string;
  driverName: string;
  finishPosition: number;
  baseScore: number;
  winBonus: number;
  stageBonus: number;
  total: number;
};

// Runs the in-progress (not-yet-saved) rule config against a real race's
// already-entered results, so a league owner can see what their rules
// would have scored before committing to them.
export async function previewRules(rawConfig: PickemRuleSetConfig, raceId: string): Promise<PreviewRow[] | string> {
  const session = await auth();
  if (!session?.user?.id) {
    return "You need to be signed in.";
  }
  if (!raceId) {
    return "Pick a race to preview against.";
  }

  const config = parseRuleSetConfig(rawConfig);
  const [race, results, stageResults] = await Promise.all([
    prisma.race.findUnique({ where: { id: raceId } }),
    prisma.raceResult.findMany({
      where: { raceId },
      include: { driver: true },
      orderBy: { finishingPosition: "asc" },
    }),
    prisma.stageResult.findMany({ where: { raceId } }),
  ]);
  if (!race || results.length === 0) {
    return "No results have been entered for that race yet.";
  }

  const stage1ByDriver = new Map(stageResults.filter((r) => r.stageNumber === 1).map((r) => [r.driverId, r.position]));
  const stage2ByDriver = new Map(stageResults.filter((r) => r.stageNumber === 2).map((r) => [r.driverId, r.position]));

  return results.map((r) => {
    const stagePositions = [stage1ByDriver.get(r.driverId), stage2ByDriver.get(r.driverId)].filter(
      (p): p is number => p != null,
    );
    const score = computeScore(r.finishingPosition, race.fieldSize, stagePositions, config);
    return { driverId: r.driverId, driverName: r.driver.name, finishPosition: r.finishingPosition, ...score };
  });
}
