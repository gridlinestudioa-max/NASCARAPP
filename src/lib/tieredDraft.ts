// Tiered Lineup scoring/lock engine — the second league type, modeled on
// the old Yahoo Fantasy NASCAR "tiered draft" format. Unlike Pick'em's
// picksPerWeek/eligibility rules, this format's structure (3 fixed tiers,
// a fixed 8-slot roster, the lock timing) isn't league-editable — but the
// season start cap and every point value are.

import type { DriverTier, Prisma } from "@prisma/client";
import { MAX_FIELD_SIZE, coerceMatrix } from "@/lib/scoring";

export type { DriverTier };
export type PickRole = "STARTER" | "BENCH";

export type TieredLineupSlot = { pickNumber: number; tier: DriverTier; role: PickRole };

export const TIERS: DriverTier[] = ["A", "B", "C"];

// How many starters a lineup rosters from each tier — league-editable (see
// TieredDraftRuleSetConfig.tierComposition). Bench mirrors starters 1:1
// per tier (a bench driver is always a backup for that same tier), so this
// alone determines the whole roster shape.
export type TierComposition = { tier: DriverTier; starters: number };

export const DEFAULT_TIER_COMPOSITION: TierComposition[] = [
  { tier: "A", starters: 1 },
  { tier: "B", starters: 2 },
  { tier: "C", starters: 1 },
];

const MAX_STARTERS_PER_TIER = 10;

export function sanitizeTierComposition(value: unknown): TierComposition[] {
  const byTier = new Map<DriverTier, number>();
  if (Array.isArray(value)) {
    for (const entry of value) {
      const tier = (entry as Partial<TierComposition>)?.tier;
      const starters = (entry as Partial<TierComposition>)?.starters;
      if ((tier === "A" || tier === "B" || tier === "C") && typeof starters === "number" && starters >= 0) {
        byTier.set(tier, Math.min(MAX_STARTERS_PER_TIER, Math.floor(starters)));
      }
    }
  }
  return TIERS.map((tier) => ({
    tier,
    starters: byTier.get(tier) ?? DEFAULT_TIER_COMPOSITION.find((t) => t.tier === tier)!.starters,
  }));
}

// Derives the Pick.pickNumber -> {tier, role} mapping from a league's tier
// composition: every tier's starters get consecutive pickNumbers first (in
// tier order), then every tier's bench slots (same order, same counts) —
// this exactly reproduces the app's original fixed 1-8 mapping when
// tierComposition is DEFAULT_TIER_COMPOSITION, so existing Picks scored
// under the old hardcoded slots stay valid.
export function buildTieredLineupSlots(tierComposition: TierComposition[]): TieredLineupSlot[] {
  const slots: TieredLineupSlot[] = [];
  let pickNumber = 1;
  for (const tc of tierComposition) {
    for (let i = 0; i < tc.starters; i++) slots.push({ pickNumber: pickNumber++, tier: tc.tier, role: "STARTER" });
  }
  for (const tc of tierComposition) {
    for (let i = 0; i < tc.starters; i++) slots.push({ pickNumber: pickNumber++, tier: tc.tier, role: "BENCH" });
  }
  return slots;
}

// Slot groups that a late swap must preserve as a set — you can reassign
// which of a tier's rostered drivers is starting vs benched, but can't
// bring in a driver who wasn't already on your roster for that tier.
export function buildLateSwapGroups(slots: TieredLineupSlot[]): { tier: DriverTier; pickNumbers: number[] }[] {
  return TIERS.map((tier) => ({ tier, pickNumbers: slots.filter((s) => s.tier === tier).map((s) => s.pickNumber) }));
}

export function slotForPickNumber(pickNumber: number, slots: TieredLineupSlot[]): TieredLineupSlot | undefined {
  return slots.find((s) => s.pickNumber === pickNumber);
}

export const DEFAULT_MAX_STARTS_PER_DRIVER_PER_SEASON = 9;

// How many top qualifiers score qualifying points — league-editable; every
// rostered driver, starter or bench, earns these if they qualify inside
// this many positions.
export const DEFAULT_QUALIFYING_SCORED_COUNT = 4;
const MAX_QUALIFYING_SCORED_COUNT = 40;

export type TieredDraftRuleSetConfig = {
  // How many times any one driver may be started (not benched) across a
  // season by one owner.
  maxStartsPerDriverPerSeason: number;
  // How many starters (and, mirrored, bench slots) come from each tier.
  tierComposition: TierComposition[];
  // How many top qualifiers score qualifying points this league.
  qualifyingScoredCount: number;
  // Index 0 = 1st in qualifying ... index (qualifyingScoredCount-1) = last
  // scoring spot. Every rostered driver, starter or bench, earns these.
  qualifyingPositionPoints: number[];
  // Index 0 = 1st place ... index (MAX_FIELD_SIZE-1) = last. Only starters
  // earn these — bench drivers never score finish points.
  finishPositionPoints: number[];
};

function buildDefaultFinishPositionPoints(): number[] {
  // The winner scores 90, decreasing by 2 per position.
  return Array.from({ length: MAX_FIELD_SIZE }, (_, i) => Math.max(0, 90 - 2 * i));
}

export function buildTieredDraftDefaultConfig(): TieredDraftRuleSetConfig {
  return {
    maxStartsPerDriverPerSeason: DEFAULT_MAX_STARTS_PER_DRIVER_PER_SEASON,
    tierComposition: DEFAULT_TIER_COMPOSITION.map((t) => ({ ...t })),
    qualifyingScoredCount: DEFAULT_QUALIFYING_SCORED_COUNT,
    qualifyingPositionPoints: [10, 5, 3, 1],
    finishPositionPoints: buildDefaultFinishPositionPoints(),
  };
}

export function parseTieredDraftRuleSetConfig(config: unknown): TieredDraftRuleSetConfig {
  const c = config as Partial<TieredDraftRuleSetConfig> | null;
  const fallback = buildTieredDraftDefaultConfig();
  const qualifyingScoredCount =
    typeof c?.qualifyingScoredCount === "number" && c.qualifyingScoredCount >= 1
      ? Math.min(MAX_QUALIFYING_SCORED_COUNT, Math.floor(c.qualifyingScoredCount))
      : DEFAULT_QUALIFYING_SCORED_COUNT;
  const qualifyingFallback = Array.from(
    { length: qualifyingScoredCount },
    (_, i) => fallback.qualifyingPositionPoints[i] ?? 0,
  );
  return {
    maxStartsPerDriverPerSeason:
      typeof c?.maxStartsPerDriverPerSeason === "number" && c.maxStartsPerDriverPerSeason >= 1
        ? Math.floor(c.maxStartsPerDriverPerSeason)
        : DEFAULT_MAX_STARTS_PER_DRIVER_PER_SEASON,
    tierComposition: sanitizeTierComposition(c?.tierComposition),
    qualifyingScoredCount,
    qualifyingPositionPoints: coerceMatrix(c?.qualifyingPositionPoints, qualifyingScoredCount, qualifyingFallback),
    finishPositionPoints: coerceMatrix(c?.finishPositionPoints, MAX_FIELD_SIZE, fallback.finishPositionPoints),
  };
}

// ---------- Scoring ----------

function pointsForPosition(position: number | null | undefined, matrix: number[]): number {
  if (position == null) return 0;
  const idx = position - 1;
  return idx >= 0 && idx < matrix.length ? matrix[idx] : 0;
}

// Only the top 4 qualifiers score, and every rostered driver (starter or
// bench) earns these points regardless of how the race itself goes.
export function qualifyingPoints(qualifyingPosition: number | null | undefined, config: TieredDraftRuleSetConfig): number {
  return pointsForPosition(qualifyingPosition, config.qualifyingPositionPoints);
}

// Only starters earn this — bench drivers score qualifying points only.
export function finishPoints(finishPosition: number | null | undefined, config: TieredDraftRuleSetConfig): number {
  return pointsForPosition(finishPosition, config.finishPositionPoints);
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

// `hour`:00 Pacific on the calendar date (as observed in Pacific time) that
// `instant` falls on. Samples the UTC offset at midday on that date rather
// than at `hour` itself, which sidesteps the one date a year (the DST
// spring-forward transition) where a literal wall-clock time doesn't exist.
function pacificHourOnDateOf(instant: Date, hour: number): Date {
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
  return new Date(Date.UTC(y, m - 1, d, hour, 0, 0) - offsetMinutes * 60000);
}

export function pacific2amOnDateOf(instant: Date): Date {
  return pacificHourOnDateOf(instant, 2);
}

export function lateSwapEndAt(race: { date: Date }): Date {
  return new Date(race.date.getTime() - 5 * 60 * 1000);
}

// A real qualifying session is always within a few days of the race it
// belongs to — anything further back than this is a bad value (e.g. a
// feed sentinel/placeholder date that slipped past nascarFeed.ts's own
// sanitizing, or a manual-entry typo), not an actual qualifying time.
// Treating it as real once caused initialLockAt to read as already-passed
// and silently freeze auto-tier refresh for the whole week — see
// nascarFeed.ts's parseQualifyingDate for the original bug.
const MAX_QUALIFYING_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;

function hasPlausibleQualifyingDate(race: { qualifyingAt: Date | null; date: Date }): boolean {
  return race.qualifyingAt != null && race.date.getTime() - race.qualifyingAt.getTime() <= MAX_QUALIFYING_LOOKBACK_MS;
}

// The initial lineup lock — 2am Pacific on qualifying day. A race with no
// (plausible) qualifyingAt recorded falls back to the late-swap cutoff
// itself, so lineups for it aren't left open indefinitely.
export function initialLockAt(race: { qualifyingAt: Date | null; date: Date }): Date {
  if (hasPlausibleQualifyingDate(race)) return pacific2amOnDateOf(race.qualifyingAt!);
  return lateSwapEndAt(race);
}

const PACIFIC_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Midnight Pacific on the Tuesday of this race's week — NASCAR's entry
// list (and this app's auto-tier assignment off it) is expected to have
// populated by then, so lineups have no business being settable before it
// regardless of whether tiers happen to already be assigned (e.g. an
// admin set them early by hand). If the race itself falls on a Tuesday,
// that's the Tuesday of the *following* week's race, so this looks back a
// full 7 days rather than treating the race's own day as its unlock.
export function entryListUnlockAt(race: { date: Date }): Date {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short" }).format(
    race.date,
  );
  const weekdayIndex = PACIFIC_WEEKDAYS.indexOf(weekday);
  const daysBack = ((weekdayIndex - 2 + 7) % 7) || 7;
  const approxTargetDate = new Date(race.date.getTime() - daysBack * 24 * 60 * 60 * 1000);
  return pacificHourOnDateOf(approxTargetDate, 0);
}

export type LineupLockPhase = "notYetOpen" | "open" | "lateSwapOnly" | "locked";

export function lineupLockPhase(race: { qualifyingAt: Date | null; date: Date }, now: number): LineupLockPhase {
  if (now >= lateSwapEndAt(race).getTime()) return "locked";
  if (now >= initialLockAt(race).getTime()) return "lateSwapOnly";
  if (now < entryListUnlockAt(race).getTime()) return "notYetOpen";
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
    include: { league: { include: { memberships: true } }, ruleSet: true },
  });
  if (tieredLeagueSeasons.length === 0) return;

  const tierAssignments = await tx.driverTierAssignment.findMany({ where: { raceId } });
  const tierByDriverId = new Map(tierAssignments.map((a) => [a.driverId, a.tier]));

  for (const leagueSeason of tieredLeagueSeasons) {
    const slots = buildTieredLineupSlots(parseTieredDraftRuleSetConfig(leagueSeason.ruleSet.config).tierComposition);
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
        const slot = slotForPickNumber(p.pickNumber, slots);
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
// qualifying points regardless of how the race itself goes. configByLeagueId
// covers every TIERED_DRAFT league taking part in this race's season, since
// each scores under its own point values.
export async function scoreTieredQualifying(
  tx: Prisma.TransactionClient,
  raceId: string,
  qualifyingPositions: Map<string, number>,
  configByLeagueId: Map<string, TieredDraftRuleSetConfig>,
): Promise<void> {
  const picks = await tx.pick.findMany({
    where: { raceId, driverId: { in: [...qualifyingPositions.keys()] }, league: { type: "TIERED_DRAFT" } },
    include: { score: true },
  });
  for (const pick of picks) {
    const config = configByLeagueId.get(pick.leagueId);
    if (!config) continue;
    const qualifyingPosition = qualifyingPositions.get(pick.driverId) ?? null;
    const qualifyingBonus = qualifyingPoints(qualifyingPosition, config);
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
// whatever qualifying points they already have. configByLeagueId covers
// every TIERED_DRAFT league taking part in this race's season.
export async function scoreTieredFinish(
  tx: Prisma.TransactionClient,
  raceId: string,
  finishPositions: Map<string, number>,
  configByLeagueId: Map<string, TieredDraftRuleSetConfig>,
): Promise<void> {
  const picks = await tx.pick.findMany({
    where: { raceId, driverId: { in: [...finishPositions.keys()] }, league: { type: "TIERED_DRAFT" } },
    include: { score: true },
  });
  const slotsByLeagueId = new Map<string, TieredLineupSlot[]>();
  for (const pick of picks) {
    const config = configByLeagueId.get(pick.leagueId);
    if (!config) continue;
    let slots = slotsByLeagueId.get(pick.leagueId);
    if (!slots) {
      slots = buildTieredLineupSlots(config.tierComposition);
      slotsByLeagueId.set(pick.leagueId, slots);
    }
    const slot = slotForPickNumber(pick.pickNumber, slots);
    const role: PickRole = slot?.role ?? "BENCH";
    const finishPosition = finishPositions.get(pick.driverId) ?? null;
    const baseScore = role === "STARTER" ? finishPoints(finishPosition, config) : 0;
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
