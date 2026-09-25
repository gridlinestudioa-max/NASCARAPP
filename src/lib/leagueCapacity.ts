// Feasibility math for both league types: can this many distinct drivers,
// under this repeat-pick/repeat-start cap, actually fill every week of the
// season? Surfaced live in the rules editor so a commissioner sees a
// warning (and, for Tiered Lineup, a per-tier "leftover" count) before
// saving a config that quietly runs out of legal drivers partway through
// the season.

import type { PickemRuleSetConfig } from "./scoring";
import type { DriverTier, TieredDraftRuleSetConfig } from "./tieredDraft";
import { TIER_A_SIZE, TIER_B_SIZE } from "./tierSizes";

export type CapacityResult = {
  feasible: boolean;
  // Weeks of unique-enough picks this driver pool + cap can sustain.
  // null = unlimited (no repeat-pick cap set).
  weeksSupported: number | null;
  weeksNeeded: number;
  message: string;
};

export function checkPickemCapacity(
  config: Pick<PickemRuleSetConfig, "picksPerWeek" | "maxPicksPerDriverPerSeason">,
  { driverPoolSize, scorableWeeks }: { driverPoolSize: number; scorableWeeks: number },
): CapacityResult {
  const { picksPerWeek, maxPicksPerDriverPerSeason } = config;

  if (driverPoolSize < picksPerWeek) {
    return {
      feasible: false,
      weeksSupported: 0,
      weeksNeeded: scorableWeeks,
      message: `Only ${driverPoolSize} drivers exist, but ${picksPerWeek} are needed in a single week — lower "drivers picked per week" or add drivers.`,
    };
  }

  if (maxPicksPerDriverPerSeason == null) {
    return {
      feasible: true,
      weeksSupported: null,
      weeksNeeded: scorableWeeks,
      message: "Unlimited repeat picks — this pool always has enough drivers.",
    };
  }

  const weeksSupported = Math.floor((driverPoolSize * maxPicksPerDriverPerSeason) / picksPerWeek);
  const feasible = weeksSupported >= scorableWeeks;
  return {
    feasible,
    weeksSupported,
    weeksNeeded: scorableWeeks,
    message: feasible
      ? `This pool supports ${weeksSupported} week(s) of picks under this cap — enough for the ${scorableWeeks}-week season.`
      : `Not enough drivers: ${picksPerWeek} pick(s)/week at ${maxPicksPerDriverPerSeason}x/driver/season only covers about ${weeksSupported} of the season's ${scorableWeeks} weeks. Raise the repeat-pick limit, lower picks/week, or the pool needs to grow.`,
  };
}

export type TierCapacityRow = {
  tier: DriverTier;
  starters: number;
  poolSize: number;
  slotsNeeded: number;
  slotsAvailable: number;
  leftover: number;
  feasible: boolean;
};

export type TieredCapacityResult = {
  feasible: boolean;
  rows: TierCapacityRow[];
};

// Approximation, not a season simulation: real weekly tier membership
// shifts with performance, so this treats each tier's site-wide bucket
// size (TIER_A_SIZE/TIER_B_SIZE, remainder for C) as a stable pool of that
// many distinct drivers cycling through it all season. Good enough to
// catch a roster requirement that's structurally impossible (e.g. needing
// more Tier A starts across the season than the bucket could ever supply).
export function checkTieredCapacity(
  config: Pick<TieredDraftRuleSetConfig, "tierComposition" | "maxStartsPerDriverPerSeason">,
  { driverPoolSize, scorableWeeks }: { driverPoolSize: number; scorableWeeks: number },
): TieredCapacityResult {
  const poolByTier: Record<DriverTier, number> = {
    A: Math.min(TIER_A_SIZE, driverPoolSize),
    B: Math.min(TIER_B_SIZE, Math.max(0, driverPoolSize - TIER_A_SIZE)),
    C: Math.max(0, driverPoolSize - TIER_A_SIZE - TIER_B_SIZE),
  };

  const rows: TierCapacityRow[] = config.tierComposition.map((tc) => {
    const poolSize = poolByTier[tc.tier];
    const slotsNeeded = tc.starters * scorableWeeks;
    const slotsAvailable = poolSize * config.maxStartsPerDriverPerSeason;
    return {
      tier: tc.tier,
      starters: tc.starters,
      poolSize,
      slotsNeeded,
      slotsAvailable,
      leftover: slotsAvailable - slotsNeeded,
      feasible: tc.starters === 0 || (poolSize >= tc.starters && slotsAvailable >= slotsNeeded),
    };
  });

  return { feasible: rows.every((r) => r.feasible), rows };
}
