"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Same shape as the one Pick'em leagues have used since the historical
// import — a new league gets this as a starting point, editable later once
// there's a rules-editing UI.
const DEFAULT_RULESET_CONFIG = {
  picksPerWeek: 1,
  eligibility: "any_driver",
  scoring: {
    base: "fieldSize + 1 - finishPosition",
    winBonus: 10,
    stageBonusPerStageWin: 5,
    maxStageBonus: 10,
  },
};

export async function createLeague(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const name = formData.get("name");
  if (typeof name !== "string" || name.trim().length < 3) {
    return "League name must be at least 3 characters.";
  }

  const session = await auth();
  if (!session?.user?.id) {
    return "You need to be signed in to create a league.";
  }
  const userId = session.user.id;

  // The league takes part in whatever the current shared season is, if one
  // exists yet — a brand-new deployment with no season seeded still lets a
  // league get created, it just won't show any races until one is.
  const currentSeason = await prisma.season.findFirst({ orderBy: { year: "desc" } });

  const league = await prisma.$transaction(async (tx) => {
    const league = await tx.league.create({
      data: { name: name.trim(), type: "PICKEM", ownerId: userId },
    });
    await tx.leagueMembership.create({
      data: { leagueId: league.id, userId, role: "OWNER" },
    });
    const ruleSet = await tx.ruleSet.create({
      data: {
        leagueId: league.id,
        label: currentSeason ? `${currentSeason.year} Season Rules` : "Default Rules",
        config: DEFAULT_RULESET_CONFIG,
      },
    });
    if (currentSeason) {
      await tx.leagueSeason.create({
        data: { leagueId: league.id, seasonId: currentSeason.id, ruleSetId: ruleSet.id },
      });
    }
    return league;
  });

  redirect(`/leagues/${league.id}`);
}
