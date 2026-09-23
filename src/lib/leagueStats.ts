// Shared statistic computations for the league hub, modeled on the stat
// widgets from the user's existing spreadsheet-driven fantasy dashboard
// (momentum, consistency, driver value/ownership, stage points, etc).
// Everything here is a pure function over the same {races, picks, members}
// already loaded by (hub)/leagueData.ts — it works for both league types
// since it operates on raw Pick+Score rows rather than anything
// Pick'em/Tiered-specific.
//
// Two metrics don't come from the source data (the reference site reads
// them straight out of a spreadsheet column) and are defined here instead:
//   - Momentum: this player's most recent scored race total minus their
//     previous scored race total (null until they have 2 scored races).
//   - Consistency score: season average points per race divided by the
//     standard deviation of their per-race points (higher = steadier
//     output relative to their own average; 0 if stdDev is 0 or they have
//     no scored races).

export function ordinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]}`;
}

type RaceLite = { id: string; week: number; trackName: string };
type MemberLite = { userId: string; user: { name: string | null; email: string } };
type ScoreLite = { total: number; stageBonus: number } | null;
type PickLite = { raceId: string; userId: string; driverId: string; driver: { name: string }; score: ScoreLite };

// raceId -> userId -> summed score.total across that player's picks that race
export type WeeklyTotals = Map<string, Map<string, number>>;

export function computeWeeklyTotals(races: RaceLite[], picks: PickLite[]): WeeklyTotals {
  const totals: WeeklyTotals = new Map();
  for (const race of races) totals.set(race.id, new Map());
  for (const p of picks) {
    if (!p.score) continue;
    const byUser = totals.get(p.raceId);
    if (!byUser) continue;
    byUser.set(p.userId, (byUser.get(p.userId) ?? 0) + p.score.total);
  }
  return totals;
}

// Races that have at least one scored pick, in week order — the set both
// the trend charts and the per-player stats below iterate over.
export function scoredRacesInOrder(races: RaceLite[], weekly: WeeklyTotals): RaceLite[] {
  return races.filter((r) => (weekly.get(r.id)?.size ?? 0) > 0).sort((a, b) => a.week - b.week);
}

export type PlayerSeasonStat = {
  userId: string;
  name: string;
  total: number;
  rank: number;
  diffToLeader: number;
  lastRacePts: number | null;
  momentum: number | null;
  avg: number;
  stdDev: number;
  consistencyScore: number;
  stagePts: number;
  stagePct: number;
  uniqueDrivers: number;
};

export function computePlayerSeasonStats(
  members: MemberLite[],
  scoredRaces: RaceLite[],
  weekly: WeeklyTotals,
  picks: PickLite[],
): PlayerSeasonStat[] {
  const unranked = members.map((m) => {
    const weeklyValues = scoredRaces.map((r) => weekly.get(r.id)?.get(m.userId) ?? 0);
    const n = weeklyValues.length;
    const total = weeklyValues.reduce((sum, v) => sum + v, 0);
    const avg = n > 0 ? total / n : 0;
    const variance = n > 0 ? weeklyValues.reduce((sum, v) => sum + (v - avg) ** 2, 0) / n : 0;
    const stdDev = Math.sqrt(variance);
    const consistencyScore = stdDev > 0 ? avg / stdDev : 0;

    const lastRacePts = n > 0 ? weeklyValues[n - 1] : null;
    const momentum = n >= 2 ? weeklyValues[n - 1] - weeklyValues[n - 2] : null;

    const myPicks = picks.filter((p) => p.userId === m.userId);
    const stagePts = myPicks.reduce((sum, p) => sum + (p.score?.stageBonus ?? 0), 0);
    const stagePct = total > 0 ? (stagePts / total) * 100 : 0;
    const uniqueDrivers = new Set(myPicks.map((p) => p.driverId)).size;

    return {
      userId: m.userId,
      name: m.user.name ?? m.user.email,
      total,
      avg,
      stdDev,
      consistencyScore,
      lastRacePts,
      momentum,
      stagePts,
      stagePct,
      uniqueDrivers,
    };
  });

  unranked.sort((a, b) => b.total - a.total);
  const leaderTotal = unranked[0]?.total ?? 0;
  return unranked.map((r, i) => ({ ...r, rank: i + 1, diffToLeader: leaderTotal - r.total }));
}

export type TrendSeries = { userId: string; name: string; data: number[] };

// Running (cumulative) totals per player across the scored races, point
// differential to whoever's leading at that point in time, and each
// player's standings rank at that point in time — the "by week" line
// charts (Points by week on Stats; Weekly Placement / Point Differential,
// toggled by button, on Standings).
export function computeTrendSeries(
  members: MemberLite[],
  scoredRaces: RaceLite[],
  weekly: WeeklyTotals,
): { labels: string[]; totals: TrendSeries[]; diffs: TrendSeries[]; places: TrendSeries[] } {
  const labels = scoredRaces.map((r) => `Wk ${r.week}`);
  const runningByUser = new Map<string, number[]>();

  for (const m of members) {
    let running = 0;
    const series: number[] = [];
    for (const race of scoredRaces) {
      running += weekly.get(race.id)?.get(m.userId) ?? 0;
      series.push(running);
    }
    runningByUser.set(m.userId, series);
  }

  const totals: TrendSeries[] = members.map((m) => ({
    userId: m.userId,
    name: m.user.name ?? m.user.email,
    data: runningByUser.get(m.userId) ?? [],
  }));

  const diffs: TrendSeries[] = members.map((m) => {
    const mine = runningByUser.get(m.userId) ?? [];
    const data = mine.map((_, i) => {
      const leaderAtI = Math.max(...members.map((other) => runningByUser.get(other.userId)?.[i] ?? 0));
      return mine[i] - leaderAtI;
    });
    return { userId: m.userId, name: m.user.name ?? m.user.email, data };
  });

  // Standings-competition ranking (ties share a rank, e.g. 1, 1, 3) at
  // each week, from each player's cumulative total at that point.
  const placesByUser = new Map<string, number[]>(members.map((m) => [m.userId, []]));
  for (let i = 0; i < scoredRaces.length; i++) {
    const atWeek = members
      .map((m) => ({ userId: m.userId, value: runningByUser.get(m.userId)?.[i] ?? 0 }))
      .sort((a, b) => b.value - a.value);
    let rank = 1;
    for (let j = 0; j < atWeek.length; j++) {
      if (j > 0 && atWeek[j].value !== atWeek[j - 1].value) rank = j + 1;
      placesByUser.get(atWeek[j].userId)?.push(rank);
    }
  }
  const places: TrendSeries[] = members.map((m) => ({
    userId: m.userId,
    name: m.user.name ?? m.user.email,
    data: placesByUser.get(m.userId) ?? [],
  }));

  return { labels, totals, diffs, places };
}

export type DriverPickStat = { driverId: string; name: string; timesPicked: number; totalPts: number; avgPts: number };

// Every driver anyone in this league has picked, with how often and how
// well they've scored — "driver value" is avg points per scored pick.
export function computeDriverStats(picks: PickLite[]): DriverPickStat[] {
  const byDriver = new Map<string, { name: string; timesPicked: number; totalPts: number; scoredCount: number }>();
  for (const p of picks) {
    const existing = byDriver.get(p.driverId) ?? { name: p.driver.name, timesPicked: 0, totalPts: 0, scoredCount: 0 };
    existing.timesPicked += 1;
    if (p.score) {
      existing.totalPts += p.score.total;
      existing.scoredCount += 1;
    }
    byDriver.set(p.driverId, existing);
  }
  return [...byDriver.entries()].map(([driverId, d]) => ({
    driverId,
    name: d.name,
    timesPicked: d.timesPicked,
    totalPts: d.totalPts,
    avgPts: d.scoredCount > 0 ? d.totalPts / d.scoredCount : 0,
  }));
}

// driverName -> userId -> times that player picked that driver, plus a
// stable driver ordering (by total picks, descending) for rendering.
export function computeDriverOwnership(picks: PickLite[]): { drivers: string[]; ownership: Map<string, Map<string, number>> } {
  const ownership = new Map<string, Map<string, number>>();
  for (const p of picks) {
    const byUser = ownership.get(p.driver.name) ?? new Map<string, number>();
    byUser.set(p.userId, (byUser.get(p.userId) ?? 0) + 1);
    ownership.set(p.driver.name, byUser);
  }
  const drivers = [...ownership.entries()]
    .sort((a, b) => {
      const totalA = [...a[1].values()].reduce((s, v) => s + v, 0);
      const totalB = [...b[1].values()].reduce((s, v) => s + v, 0);
      return totalB - totalA;
    })
    .map(([name]) => name);
  return { drivers, ownership };
}
