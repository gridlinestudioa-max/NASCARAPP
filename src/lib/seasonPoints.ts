// NASCAR Cup Series points for the season, computed from our own
// already-synced RaceResult/StageResult data instead of cf.nascar.com's
// "live points" feed — see nascarFeed.ts for why that feed can't be used
// here (it 403s outside the few hours a given race is actually green-flag
// live, so it's useless as a standings source on any other day). This
// replicates the 2026 Cup points system exactly, per the season's actual
// rules (a return to a Chase-style format, replacing the 2017-2025
// playoff-points/elimination-round system):
//
//   - Finish points: winner scores 55; 2nd through 40th score
//     max(1, 36 - position). isNonPoints races (e.g. the All-Star race)
//     don't count at all, same as NASCAR's own scoring, and aren't part of
//     the 26/10 race-count split below.
//   - Stage points: top 10 of each of a race's (up to) two stages score
//     10 down to 1.
//   - Regular season = the first 26 points races. Points accumulate
//     normally (finish + stage) with no bonuses of any kind — the old
//     system's playoff-point bonuses for wins/stage wins/regular-season
//     rank are gone entirely in 2026.
//   - After race 26, the top 16 drivers by regular-season points (ties
//     broken by wins, then top 5s) get their points RESET to a fixed
//     seed value based on their rank — the "Chase" reset. Everyone else
//     just keeps their regular-season total as-is (not Chase-eligible).
//   - Races 27-36 ("the Chase") score with the exact same finish+stage
//     formula as the regular season — no elimination rounds, no
//     Championship 4, just 10 more races added on top of the reset.
//   - Whoever has the most points after race 36 is the champion.
import { prisma } from "@/lib/prisma";

const REGULAR_SEASON_RACE_COUNT = 26;
// Seed 1 and 2 are irregular (25-point, then 10-point gaps); seed 3 down
// to 16 step by 5.
const CHASE_SEEDS = [2100, 2075, ...Array.from({ length: 14 }, (_, i) => 2065 - i * 5)];

function finishPoints(position: number): number {
  if (position === 1) return 55;
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
  races: number;
  avgFinish: number;
  inChase: boolean;
};

function racePoints(
  raceId: string,
  resultsByRaceId: Map<string, { driverId: string; finishingPosition: number }[]>,
  stagesByRaceId: Map<string, { driverId: string; position: number }[]>,
): Map<string, number> {
  const points = new Map<string, number>();
  for (const r of resultsByRaceId.get(raceId) ?? []) {
    points.set(r.driverId, (points.get(r.driverId) ?? 0) + finishPoints(r.finishingPosition));
  }
  for (const s of stagesByRaceId.get(raceId) ?? []) {
    if (points.has(s.driverId)) points.set(s.driverId, points.get(s.driverId)! + stagePoints(s.position));
  }
  return points;
}

// beforeWeek, when given, only counts races earlier than that week — used
// by the auto-tier formula so a race's own points component only reflects
// standings as of before it happened, matching how its recent-form
// component is scoped (see tierRanking.ts). The regular-season/Chase split
// above still applies to whatever subset of races that leaves.
export async function computeSeasonPointsStandings(seasonId: string, beforeWeek?: number): Promise<SeasonPointsEntry[]> {
  const raceWhere = { seasonId, isNonPoints: false, ...(beforeWeek != null ? { week: { lt: beforeWeek } } : {}) };

  const races = await prisma.race.findMany({ where: raceWhere, orderBy: { week: "asc" }, select: { id: true } });
  if (races.length === 0) return [];
  const raceIds = races.map((r) => r.id);

  const [results, stageResults] = await Promise.all([
    prisma.raceResult.findMany({ where: { raceId: { in: raceIds } }, include: { driver: true } }),
    prisma.stageResult.findMany({ where: { raceId: { in: raceIds } } }),
  ]);

  const resultsByRaceId = new Map<string, typeof results>();
  for (const r of results) {
    const bucket = resultsByRaceId.get(r.raceId);
    if (bucket) bucket.push(r);
    else resultsByRaceId.set(r.raceId, [r]);
  }
  const stagesByRaceId = new Map<string, typeof stageResults>();
  for (const s of stageResults) {
    const bucket = stagesByRaceId.get(s.raceId);
    if (bucket) bucket.push(s);
    else stagesByRaceId.set(s.raceId, [s]);
  }
  const driverNameById = new Map(results.map((r) => [r.driverId, r.driver.name]));

  function getEntry(byDriverId: Map<string, SeasonPointsEntry>, driverId: string): SeasonPointsEntry {
    let entry = byDriverId.get(driverId);
    if (!entry) {
      entry = {
        driverId,
        driverName: driverNameById.get(driverId) ?? "Unknown driver",
        points: 0,
        wins: 0,
        top5: 0,
        top10: 0,
        races: 0,
        avgFinish: 0,
        inChase: false,
      };
      byDriverId.set(driverId, entry);
    }
    return entry;
  }

  const byDriverId = new Map<string, SeasonPointsEntry>();

  const regularSeasonRaceIds = raceIds.slice(0, REGULAR_SEASON_RACE_COUNT);
  const chaseRaceIds = raceIds.slice(REGULAR_SEASON_RACE_COUNT);

  for (const raceId of regularSeasonRaceIds) {
    for (const [driverId, points] of racePoints(raceId, resultsByRaceId, stagesByRaceId)) {
      getEntry(byDriverId, driverId).points += points;
    }
  }

  // The Chase reset — only happens once all 26 regular-season races have
  // actually been run.
  if (raceIds.length >= REGULAR_SEASON_RACE_COUNT) {
    const seeded = [...byDriverId.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || b.top5 - a.top5);
    seeded.slice(0, CHASE_SEEDS.length).forEach((entry, i) => {
      entry.points = CHASE_SEEDS[i];
      entry.inChase = true;
    });
  }

  for (const raceId of chaseRaceIds) {
    for (const [driverId, points] of racePoints(raceId, resultsByRaceId, stagesByRaceId)) {
      getEntry(byDriverId, driverId).points += points;
    }
  }

  // Wins/top5/top10/races are season-wide counts (not reset by the
  // Chase) — just a career-style tally for the year, computed once over
  // every race. avgFinish sums alongside them and divides once all races
  // are counted.
  const finishSumByDriverId = new Map<string, number>();
  for (const r of results) {
    const entry = getEntry(byDriverId, r.driverId);
    entry.races += 1;
    if (r.finishingPosition === 1) entry.wins += 1;
    if (r.finishingPosition <= 5) entry.top5 += 1;
    if (r.finishingPosition <= 10) entry.top10 += 1;
    finishSumByDriverId.set(r.driverId, (finishSumByDriverId.get(r.driverId) ?? 0) + r.finishingPosition);
  }
  for (const entry of byDriverId.values()) {
    const sum = finishSumByDriverId.get(entry.driverId);
    entry.avgFinish = sum != null && entry.races > 0 ? Math.round((sum / entry.races) * 10) / 10 : 0;
  }

  return [...byDriverId.values()].sort((a, b) => b.points - a.points);
}
