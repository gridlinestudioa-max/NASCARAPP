// Automatic weekly tier determination for Tiered Lineup leagues.
//
// Computes a composite "power score" per driver in this week's entry
// list and buckets them into Tier A/B/C: 65% season points, 25% recent
// race form (last 5 finishes), 10% history at this same race. It never
// writes without going through the same DriverTierAssignment rows the
// manual tiers page reads — a commissioner always sees (and can override)
// the computed result there before it's used for anything.

import type { DriverTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchLivePoints, normalizeTrackName } from "@/lib/nascarFeed";

export const AUTO_TIER_WEIGHTS = { seasonPoints: 0.65, recentForm: 0.25, trackHistory: 0.1 };

// How many of the most recent (already-synced) races count toward a
// driver's "recent form" component.
const RECENT_FORM_RACE_WINDOW = 5;

// Field-relative tier sizes — deliberately generous on Tier B, since a
// Tiered Lineup roster needs 4 Tier B slots (2 starters + 2 bench) per
// team vs. 2 each for A and C. Tune freely; nothing else depends on these
// being any particular size.
const TIER_A_SIZE = 8;
const TIER_B_SIZE = 20;

function minMaxNormalize(values: Map<string, number>, invert = false): Map<string, number> {
  const nums = [...values.values()];
  if (nums.length === 0) return new Map();
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min;
  const normalized = new Map<string, number>();
  for (const [key, value] of values) {
    const n = range === 0 ? 0.5 : (value - min) / range;
    normalized.set(key, invert ? 1 - n : n);
  }
  return normalized;
}

function median(values: number[]): number {
  if (values.length === 0) return 0.5;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export type AutoTierResult = { driverId: string; driverName: string; tier: DriverTier; score: number };
export type AutoTierOutcome = { ok: true; tiers: AutoTierResult[]; warnings: string[] } | { ok: false; error: string };

export async function computeAutoTiers(raceId: string): Promise<AutoTierOutcome> {
  const race = await prisma.race.findUnique({ where: { id: raceId } });
  if (!race) return { ok: false, error: "Race not found." };

  const entries = await prisma.raceEntry.findMany({ where: { raceId }, include: { driver: true } });
  if (entries.length === 0) {
    return { ok: false, error: "No entry list for this race yet — sync from NASCAR first (or assign tiers manually)." };
  }

  const warnings: string[] = [];

  // ---------- Season points (from NASCAR's own live standings feed) ----------
  const seasonPointsByDriverId = new Map<string, number>();
  if (race.nascarRaceId) {
    try {
      const points = await fetchLivePoints(race.nascarSeriesId, race.nascarRaceId);
      const driverIdByName = new Map(entries.map((e) => [e.driver.name.trim().toLowerCase(), e.driverId]));
      for (const p of points) {
        const key = `${p.first_name} ${p.last_name}`.trim().toLowerCase();
        const driverId = driverIdByName.get(key);
        if (driverId) seasonPointsByDriverId.set(driverId, p.points);
      }
      if (seasonPointsByDriverId.size === 0) {
        warnings.push("Season points feed returned no matching drivers — weighting it as neutral for everyone.");
      }
    } catch (cause) {
      warnings.push(`Couldn't fetch season points, weighting it as neutral for everyone: ${(cause as Error).message}`);
    }
  } else {
    warnings.push("This race isn't linked to a NASCAR race id yet, so season points couldn't be fetched.");
  }

  // ---------- Recent form (from our own already-synced results) ----------
  const recentResults = await prisma.raceResult.findMany({
    where: { driverId: { in: entries.map((e) => e.driverId) }, race: { seasonId: race.seasonId, week: { lt: race.week } } },
    orderBy: { race: { week: "desc" } },
  });
  const formSumByDriverId = new Map<string, number>();
  const formCountByDriverId = new Map<string, number>();
  for (const r of recentResults) {
    const count = formCountByDriverId.get(r.driverId) ?? 0;
    if (count >= RECENT_FORM_RACE_WINDOW) continue;
    formSumByDriverId.set(r.driverId, (formSumByDriverId.get(r.driverId) ?? 0) + r.finishingPosition);
    formCountByDriverId.set(r.driverId, count + 1);
  }
  const avgFinishByDriverId = new Map<string, number>();
  for (const [driverId, sum] of formSumByDriverId) {
    avgFinishByDriverId.set(driverId, sum / formCountByDriverId.get(driverId)!);
  }
  if (avgFinishByDriverId.size === 0) {
    warnings.push("No synced results yet this season, so recent form couldn't be weighed — its share was neutral.");
  }

  // ---------- Track history (this same race, any past season we have data for) ----------
  const normalizedTrack = normalizeTrackName(race.trackName);
  const historicalResults = await prisma.raceResult.findMany({
    where: { driverId: { in: entries.map((e) => e.driverId) }, raceId: { not: raceId } },
    include: { race: { select: { trackName: true } } },
  });
  const trackHistorySumByDriverId = new Map<string, number>();
  const trackHistoryCountByDriverId = new Map<string, number>();
  for (const r of historicalResults) {
    if (normalizeTrackName(r.race.trackName) !== normalizedTrack) continue;
    trackHistorySumByDriverId.set(r.driverId, (trackHistorySumByDriverId.get(r.driverId) ?? 0) + r.finishingPosition);
    trackHistoryCountByDriverId.set(r.driverId, (trackHistoryCountByDriverId.get(r.driverId) ?? 0) + 1);
  }
  const avgTrackFinishByDriverId = new Map<string, number>();
  for (const [driverId, sum] of trackHistorySumByDriverId) {
    avgTrackFinishByDriverId.set(driverId, sum / trackHistoryCountByDriverId.get(driverId)!);
  }
  if (avgTrackFinishByDriverId.size === 0) {
    warnings.push(
      "No past results found for this race in our data yet (first time we've tracked it), so track history couldn't be weighed — its share was neutral.",
    );
  }

  // ---------- Combine ----------
  const normSeasonPoints = minMaxNormalize(seasonPointsByDriverId);
  const normRecentForm = minMaxNormalize(avgFinishByDriverId, true); // lower average finish = better
  const normTrackHistory = minMaxNormalize(avgTrackFinishByDriverId, true); // lower average finish = better
  const seasonPointsFallback = median([...normSeasonPoints.values()]);
  const recentFormFallback = median([...normRecentForm.values()]);
  const trackHistoryFallback = median([...normTrackHistory.values()]);

  const scored = entries.map((e) => {
    const seasonPointsScore = normSeasonPoints.get(e.driverId) ?? seasonPointsFallback;
    const recentFormScore = normRecentForm.get(e.driverId) ?? recentFormFallback;
    const trackHistoryScore = normTrackHistory.get(e.driverId) ?? trackHistoryFallback;
    const score =
      AUTO_TIER_WEIGHTS.seasonPoints * seasonPointsScore +
      AUTO_TIER_WEIGHTS.recentForm * recentFormScore +
      AUTO_TIER_WEIGHTS.trackHistory * trackHistoryScore;
    return { driverId: e.driverId, driverName: e.driver.name, score };
  });
  scored.sort((a, b) => b.score - a.score);

  const tiers: AutoTierResult[] = scored.map((s, i) => ({
    ...s,
    tier: (i < TIER_A_SIZE ? "A" : i < TIER_A_SIZE + TIER_B_SIZE ? "B" : "C") as DriverTier,
  }));

  return { ok: true, tiers, warnings };
}

// Computes tiers and writes them as the current DriverTierAssignment for
// this race — the same rows the manual tiers page reads and edits, so a
// commissioner always reviews (and can override) the computed result
// there before it's used for anything.
export async function applyAutoTiers(raceId: string): Promise<AutoTierOutcome> {
  const outcome = await computeAutoTiers(raceId);
  if (!outcome.ok) return outcome;

  await prisma.$transaction(
    outcome.tiers.map((t) =>
      prisma.driverTierAssignment.upsert({
        where: { raceId_driverId: { raceId, driverId: t.driverId } },
        update: { tier: t.tier },
        create: { raceId, driverId: t.driverId, tier: t.tier },
      }),
    ),
  );

  return outcome;
}
