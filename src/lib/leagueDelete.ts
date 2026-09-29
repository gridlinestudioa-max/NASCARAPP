import { prisma } from "./prisma";

export type DeleteResult = { ok: true } | { ok: false; error: string };

// Irreversible — every member's picks/scores, rule sets, and season
// participation for this league are gone, along with the league itself.
// The caller (the admin delete action) is expected to have already
// confirmed with the admin; this function itself does no confirmation of
// its own.
//
// Deletion order matters: Score references Pick, LeagueSeason references
// RuleSet, so both have to go before the rows they point at. Nothing
// outside these five tables points at a League (see the schema's four
// `leagueId` fields plus Score's own `pickId`), so this is the complete
// set — no orphaned rows left behind.
export async function deleteLeague(leagueId: string): Promise<DeleteResult> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.league.findUniqueOrThrow({ where: { id: leagueId } });

      await tx.score.deleteMany({ where: { pick: { leagueId } } });
      await tx.pick.deleteMany({ where: { leagueId } });
      await tx.leagueSeason.deleteMany({ where: { leagueId } });
      await tx.ruleSet.deleteMany({ where: { leagueId } });
      await tx.leagueMembership.deleteMany({ where: { leagueId } });
      await tx.league.delete({ where: { id: leagueId } });
    });
    return { ok: true };
  } catch (cause) {
    return { ok: false, error: (cause as Error).message };
  }
}
