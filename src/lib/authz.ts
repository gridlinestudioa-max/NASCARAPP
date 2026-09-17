import { prisma } from "@/lib/prisma";

// Race results are shared, site-wide data (not owned by any one league),
// so entering them isn't scoped to a specific league's URL — anyone who
// owns at least one league taking part in that race's season is trusted
// to record what actually happened.
export async function ownsALeagueInSeason(userId: string, seasonId: string): Promise<boolean> {
  const count = await prisma.leagueSeason.count({
    where: {
      seasonId,
      league: { memberships: { some: { userId, role: "OWNER" } } },
    },
  });
  return count > 0;
}
