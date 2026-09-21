// Cumulative NASCAR Cup points for the season, computed from our own
// already-synced RaceResult/StageResult data instead of cf.nascar.com's
// "live points" feed — see nascarFeed.ts for why that feed can't be used
// here (it 403s outside the few hours a given race is actually green-flag
// live, so it's useless as a standings source on any other day).
//
// Standard finish-position points (winner 40, then 37 minus position down
// to a floor of 1) plus stage points (top 10 of each stage score 10 down
// to 1), summed across every points race (isNonPoints races don't count,
// same as NASCAR's own scoring). This deliberately does NOT replicate
// NASCAR's playoff bracket — the reset to a fixed base plus playoff-point
// bonuses for the 16 (then 12, then 8, then 4) drivers who qualify each
// round. That's a materially different, much more stateful system; this
// is a simple season-long cumulative total instead, good enough as a
// driver-strength signal for the auto-tier formula and as a stats-page
// leaderboard, but it will diverge from NASCAR.com's own standings once
// the playoffs start.
import { prisma } from "@/lib/prisma";

function finishPoints(position: number): number {
  if (position === 1) return 40;
  return Math.max(1, 37 - position);
}

function stagePoints(position: number): number {
  return Math.max(0, 11 - position);
}

export type SeasonPointsEntry = {
  driverId: string;
  driverName: string;
  points: number;
  wins: number;
  top5: number;
  top10: number;
};

// beforeWeek, when given, only counts races earlier than that week — used
// by the auto-tier formula so a race's own points component only reflects
// standings as of before it happened, matching how its recent-form
// component is scoped (see tierRanking.ts).
export async function computeSeasonPointsStandings(seasonId: string, beforeWeek?: number): Promise<SeasonPointsEntry[]> {
  const pointsRaceWhere = { seasonId, isNonPoints: false, ...(beforeWeek != null ? { week: { lt: beforeWeek } } : {}) };

  const [results, stageResults] = await Promise.all([
    prisma.raceResult.findMany({ where: { race: pointsRaceWhere }, include: { driver: true } }),
    prisma.stageResult.findMany({ where: { race: pointsRaceWhere } }),
  ]);

  const byDriverId = new Map<string, SeasonPointsEntry>();
  for (const r of results) {
    const entry = byDriverId.get(r.driverId) ?? {
      driverId: r.driverId,
      driverName: r.driver.name,
      points: 0,
      wins: 0,
      top5: 0,
      top10: 0,
    };
    entry.points += finishPoints(r.finishingPosition);
    if (r.finishingPosition === 1) entry.wins += 1;
    if (r.finishingPosition <= 5) entry.top5 += 1;
    if (r.finishingPosition <= 10) entry.top10 += 1;
    byDriverId.set(r.driverId, entry);
  }
  for (const s of stageResults) {
    const entry = byDriverId.get(s.driverId);
    if (entry) entry.points += stagePoints(s.position);
  }

  return [...byDriverId.values()].sort((a, b) => b.points - a.points);
}
