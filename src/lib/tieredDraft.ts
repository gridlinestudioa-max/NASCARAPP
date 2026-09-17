// Tiered Lineup scoring/lock engine — the second league type, modeled on
// the old Yahoo Fantasy NASCAR "tiered draft" format. Unlike Pick'em, none
// of this format's structure is league-editable except the season start
// cap: 3 fixed tiers (A/B/C), a fixed 8-slot roster (4 starters + 4 bench),
// and fixed qualifying/finish points tables.

import type { DriverTier, Prisma } from "@prisma/client";

export type { DriverTier };
export type PickRole = "STARTER" | "BENCH";

export type TieredLineupSlot = { pickNumber: number; tier: DriverTier; role: PickRole };

// The fixed meaning of Pick.pickNumber for a Tiered Lineup league: slots
// 1-4 are the week's 4 starters (Tier A, Tier B x2, Tier C), 5-8 are the
// matching bench slots. The two Tier B starter/bench slots are otherwise
// interchangeable.
export const TIERED_LINEUP_SLOTS: TieredLineupSlot[] = [
  { pickNumber: 1, tier: "A", role: "STARTER" },
  { pickNumber: 2, tier: "B", role: "STARTER" },
  { pickNumber: 3, tier: "B", role: "STARTER" },
  { pickNumber: 4, tier: "C", role: "STARTER" },
  { pickNumber: 5, tier: "A", role: "BENCH" },
  { pickNumber: 6, tier: "B", role: "BENCH" },
  { pickNumber: 7, tier: "B", role: "BENCH" },
  { pickNumber: 8, tier: "C", role: "BENCH" },
];

export function slotForPickNumber(pickNumber: number): TieredLineupSlot | undefined {
  return TIERED_LINEUP_SLOTS.find((s) => s.pickNumber === pickNumber);
}

// Slot groups that a late swap must preserve as a set — you can reassign
// which of a tier's rostered drivers is starting vs benched, but can't
// bring in a driver who wasn't already on your roster for that tier.
export const LATE_SWAP_GROUPS: { tier: DriverTier; pickNumbers: number[] }[] = [
  { tier: "A", pickNumbers: [1, 5] },
  { tier: "B", pickNumbers: [2, 3, 6, 7] },
  { tier: "C", pickNumbers: [4, 8] },
];

export const DEFAULT_MAX_STARTS_PER_DRIVER_PER_SEASON = 9;

export type TieredDraftRuleSetConfig = {
  // How many times any one driver may be started (not benched) across a
  // season by one owner — the only editable rule for this league type.
  maxStartsPerDriverPerSeason: number;
};

export function buildTieredDraftDefaultConfig(): TieredDraftRuleSetConfig {
  return { maxStartsPerDriverPerSeason: DEFAULT_MAX_STARTS_PER_DRIVER_PER_SEASON };
}

export function parseTieredDraftRuleSetConfig(config: unknown): TieredDraftRuleSetConfig {
  const c = config as Partial<TieredDraftRuleSetConfig> | null;
  return {
    maxStartsPerDriverPerSeason:
      typeof c?.maxStartsPerDriverPerSeason === "number" && c.maxStartsPerDriverPerSeason >= 1
        ? Math.floor(c.maxStartsPerDriverPerSeason)
        : DEFAULT_MAX_STARTS_PER_DRIVER_PER_SEASON,
  };
}

// ---------- Scoring ----------

// Only the top 4 qualifiers score, and every rostered driver (starter or
// bench) earns these points regardless of how the race itself goes.
export function qualifyingPoints(qualifyingPosition: number | null | undefined): number {
  switch (qualifyingPosition) {
    case 1:
      return 10;
    case 2:
      return 5;
    case 3:
      return 3;
    case 4:
      return 1;
    default:
      return 0;
  }
}

// Race winner scores 90, decreasing by 2 per position down to 43rd (6).
// Only starters earn this — bench drivers score qualifying points only.
export function finishPoints(finishPosition: number | null | undefined): number {
  if (finishPosition == null) return 0;
  return Math.max(0, 90 - 2 * (finishPosition - 1));
}

export type TieredScoreBreakdown = {
  baseScore: number;
  qualifyingBonus: number;
  total: number;
};

export function computeTieredScore(
  role: PickRole,
  qualifyingPosition: number | null,
  finishPosition: number | null,
): TieredScoreBreakdown {
  const qualifyingBonus = qualifyingPoints(qualifyingPosition);
  const baseScore = role === "STARTER" ? finishPoints(finishPosition) : 0;
  return { baseScore, qualifyingBonus, total: baseScore + qualifyingBonus };
}

// ---------- Lineup locking ----------

// Returns the UTC offset (in minutes) America/Los_Angeles observes at the
// given instant — e.g. -480 for PST, -420 for PDT.
function pacificOffsetMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    timeZoneName: "shortOffset",
  }).formatToParts(instant);
  const tzName = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT-8";
  const match = /GMT([+-]\d+)/.exec(tzName);
  return (match ? parseInt(match[1], 10) : -8) * 60;
}

// 2:00 AM Pacific on the calendar date (as observed in Pacific time) that
// `instant` falls on. Samples the UTC offset at midday on that date rather
// than at 2am itself, which sidesteps the one date a year (the DST
// spring-forward transition) where a literal 2am Pacific doesn't exist.
export function pacific2amOnDateOf(instant: Date): Date {
  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const y = Number(dateParts.find((p) => p.type === "year")!.value);
  const m = Number(dateParts.find((p) => p.type === "month")!.value);
  const d = Number(dateParts.find((p) => p.type === "day")!.value);

  const offsetMinutes = pacificOffsetMinutes(new Date(Date.UTC(y, m - 1, d, 10, 0, 0)));
  return new Date(Date.UTC(y, m - 1, d, 2, 0, 0) - offsetMinutes * 60000);
}

export function lateSwapEndAt(race: { date: Date }): Date {
  return new Date(race.date.getTime() - 5 * 60 * 1000);
}

// The initial lineup lock — 2am Pacific on qualifying day. A race with no
// qualifyingAt recorded falls back to the late-swap cutoff itself, so
// lineups for it aren't left open indefinitely.
export function initialLockAt(race: { qualifyingAt: Date | null; date: Date }): Date {
  if (race.qualifyingAt) return pacific2amOnDateOf(race.qualifyingAt);
  return lateSwapEndAt(race);
}

export type LineupLockPhase = "open" | "lateSwapOnly" | "locked";

export function lineupLockPhase(race: { qualifyingAt: Date | null; date: Date }, now: number): LineupLockPhase {
  if (now >= lateSwapEndAt(race).getTime()) return "locked";
  if (now >= initialLockAt(race).getTime()) return "lateSwapOnly";
  return "open";
}

// ---------- Carry-over lineups ----------

// "If you didn't touch your lineup, it just carried over from the previous
// week." For every Tiered Lineup league taking part in this race's season,
// copies forward the most recent prior race's lineup for any member who
// hasn't set one of their own for this race yet — driver by driver, only
// where that driver's tier assignment this week still matches the slot it
// carries into (a driver reassigned to a different tier since simply drops
// out of that slot rather than carrying over into a slot it's no longer
// eligible for). Called right before scoring a race's results, so scoring
// always has a definitive lineup to work from even if nobody opened the
// league's page this week.
export async function materializeCarriedOverLineups(tx: Prisma.TransactionClient, raceId: string): Promise<void> {
  const race = await tx.race.findUnique({ where: { id: raceId } });
  if (!race) return;

  const tieredLeagueSeasons = await tx.leagueSeason.findMany({
    where: { seasonId: race.seasonId, league: { type: "TIERED_DRAFT" } },
    include: { league: { include: { memberships: true } } },
  });
  if (tieredLeagueSeasons.length === 0) return;

  const tierAssignments = await tx.driverTierAssignment.findMany({ where: { raceId } });
  const tierByDriverId = new Map(tierAssignments.map((a) => [a.driverId, a.tier]));

  for (const leagueSeason of tieredLeagueSeasons) {
    const priorRaces = await tx.race.findMany({
      where: { seasonId: race.seasonId, week: { lt: race.week } },
      orderBy: { week: "desc" },
      select: { id: true },
    });
    if (priorRaces.length === 0) continue;

    for (const membership of leagueSeason.league.memberships) {
      const existingPicks = await tx.pick.count({
        where: { leagueId: leagueSeason.leagueId, userId: membership.userId, raceId },
      });
      if (existingPicks > 0) continue;

      let priorPicks: { pickNumber: number; driverId: string }[] = [];
      for (const priorRace of priorRaces) {
        priorPicks = await tx.pick.findMany({
          where: { leagueId: leagueSeason.leagueId, userId: membership.userId, raceId: priorRace.id },
          select: { pickNumber: true, driverId: true },
        });
        if (priorPicks.length > 0) break;
      }
      if (priorPicks.length === 0) continue;

      for (const p of priorPicks) {
        const slot = slotForPickNumber(p.pickNumber);
        if (!slot) continue;
        // Only carries into this week's lineup if the driver is still
        // eligible for that exact slot's tier this week.
        if (tierByDriverId.get(p.driverId) !== slot.tier) continue;
        await tx.pick.create({
          data: { leagueId: leagueSeason.leagueId, userId: membership.userId, raceId, pickNumber: p.pickNumber, driverId: p.driverId },
        });
      }
    }
  }
}

// ---------- Writing scores ----------

// Scores (or re-scores) every Tiered Lineup pick for the given drivers'
// qualifying results — every rostered driver, starter or bench, earns
// qualifying points regardless of how the race itself goes.
export async function scoreTieredQualifying(
  tx: Prisma.TransactionClient,
  raceId: string,
  qualifyingPositions: Map<string, number>,
): Promise<void> {
  const picks = await tx.pick.findMany({
    where: { raceId, driverId: { in: [...qualifyingPositions.keys()] }, league: { type: "TIERED_DRAFT" } },
    include: { score: true },
  });
  for (const pick of picks) {
    const qualifyingPosition = qualifyingPositions.get(pick.driverId) ?? null;
    const qualifyingBonus = qualifyingPoints(qualifyingPosition);
    const baseScore = pick.score?.baseScore ?? 0;
    const stageBonus = pick.score?.stageBonus ?? 0;
    const total = baseScore + stageBonus + qualifyingBonus;
    await tx.score.upsert({
      where: { pickId: pick.id },
      update: { qualifyingPosition, qualifyingBonus, total },
      create: {
        pickId: pick.id,
        qualifyingPosition,
        qualifyingBonus,
        baseScore: 0,
        stageBonus: 0,
        total,
      },
    });
  }
}

// Scores (or re-scores) every Tiered Lineup pick for the given drivers'
// race results — only starters earn finish points; bench picks keep
// whatever qualifying points they already have.
export async function scoreTieredFinish(
  tx: Prisma.TransactionClient,
  raceId: string,
  finishPositions: Map<string, number>,
): Promise<void> {
  const picks = await tx.pick.findMany({
    where: { raceId, driverId: { in: [...finishPositions.keys()] }, league: { type: "TIERED_DRAFT" } },
    include: { score: true },
  });
  for (const pick of picks) {
    const slot = slotForPickNumber(pick.pickNumber);
    const role: PickRole = slot?.role ?? "BENCH";
    const finishPosition = finishPositions.get(pick.driverId) ?? null;
    const baseScore = role === "STARTER" ? finishPoints(finishPosition) : 0;
    const qualifyingBonus = pick.score?.qualifyingBonus ?? 0;
    const qualifyingPosition = pick.score?.qualifyingPosition ?? null;
    const stageBonus = pick.score?.stageBonus ?? 0;
    const total = baseScore + stageBonus + qualifyingBonus;
    await tx.score.upsert({
      where: { pickId: pick.id },
      update: { finishPosition, baseScore, qualifyingBonus, qualifyingPosition, total },
      create: {
        pickId: pick.id,
        finishPosition,
        baseScore,
        qualifyingBonus,
        qualifyingPosition,
        stageBonus: 0,
        total,
      },
    });
  }
}
