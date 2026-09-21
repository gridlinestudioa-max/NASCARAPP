// Shared data fetch for every tab under a league's hub (standings,
// personal stats, league stats, driver selection, past scores) plus the
// layout that wraps them. Wrapped in React's cache() so the layout and
// whichever tab page is active share one set of queries per request
// instead of each re-fetching independently.

import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const getLeagueHubData = cache(async (leagueId: string, userId: string) => {
  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) return null;

  const membership = await prisma.leagueMembership.findUnique({
    where: { leagueId_userId: { leagueId, userId } },
  });
  if (!membership) return null;

  const leagueSeason = await prisma.leagueSeason.findFirst({
    where: { leagueId },
    include: { ruleSet: true, season: true },
    orderBy: { season: { year: "desc" } },
  });
  const season = leagueSeason?.season ?? null;

  const [races, members] = await Promise.all([
    season
      ? prisma.race.findMany({ where: { seasonId: season.id }, orderBy: { week: "asc" } })
      : Promise.resolve([]),
    // Ordered by join time — used as the pick-order join-order fallback
    // (src/lib/pickOrder.ts) on the Commissioner tab, harmless everywhere
    // else this list is consumed.
    prisma.leagueMembership.findMany({ where: { leagueId }, include: { user: true }, orderBy: { createdAt: "asc" } }),
  ]);

  // Scoped to this season's races only — standings/stats shouldn't blend
  // totals across seasons once a league has more than one.
  const picks = season
    ? await prisma.pick.findMany({
        where: { leagueId, raceId: { in: races.map((r) => r.id) } },
        include: { score: true, driver: true, user: true },
      })
    : [];

  type Standing = { userId: string; name: string; total: number; picksCount: number; needsReviewCount: number };
  // Seeded from every league member, not just those with a pick recorded,
  // so a season with no picks yet still shows the full player list at 0.
  const standingsByUser = new Map<string, Standing>(
    members.map((m) => [
      m.userId,
      { userId: m.userId, name: m.user.name ?? m.user.email, total: 0, picksCount: 0, needsReviewCount: 0 },
    ]),
  );
  for (const p of picks) {
    const existing = standingsByUser.get(p.userId);
    if (!existing) continue;
    existing.total += p.score?.total ?? 0;
    existing.picksCount += 1;
    if (p.score?.needsReview) existing.needsReviewCount += 1;
  }
  const standings = [...standingsByUser.values()].sort((a, b) => b.total - a.total);
  const myRank = standings.findIndex((s) => s.userId === userId) + 1 || null;
  const myStanding = standings.find((s) => s.userId === userId) ?? null;

  const now = Date.now();
  const nextOpenRace = races.find((r) => r.date.getTime() > now) ?? null;

  return {
    league,
    membership,
    season,
    leagueSeason,
    races,
    members,
    picks,
    standings,
    myRank,
    myStanding,
    nextOpenRace,
  };
});

export type LeagueHubData = NonNullable<Awaited<ReturnType<typeof getLeagueHubData>>>;
