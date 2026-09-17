// Pick'em scoring engine. A league's RuleSet.config holds a
// PickemRuleSetConfig; this module parses it safely, ships two presets,
// and computes points from it. Position values are fixed slots (like real
// NASCAR points — 1st is always worth the same regardless of how many cars
// started), not relative to a given race's field size.

export const MAX_FIELD_SIZE = 40;
export const MAX_STAGE_POSITIONS = 10;

export type PickemRuleSetConfig = {
  // Editable Rules
  picksPerWeek: number;
  // null = unlimited.
  maxPicksPerDriverPerSeason: number | null;
  includeNonPointsRaces: boolean;

  // Points Rules
  includeStagePoints: boolean;
  includeWinnerBonus: boolean;
  winnerBonus: number;
  // Index 0 = 1st place ... index 39 = 40th place.
  positionPoints: number[];
  // Index 0 = 1st in a stage ... index 9 = 10th. Only the top 10 in a
  // stage score, so this is deliberately shorter than positionPoints.
  stagePositionPoints: number[];
};

function buildNascarOfficialPreset(): PickemRuleSetConfig {
  // Real 2026 Cup Series points: winner 55, 2nd 35, then down by 1 per
  // position (3rd=34 ... 35th=2), 36th-40th all worth 1. There's no
  // separate "winner bonus" line item in the real system — the win's
  // extra value is baked into the 55-vs-35 gap itself.
  const positionPoints = Array.from({ length: MAX_FIELD_SIZE }, (_, i) => {
    const position = i + 1;
    if (position === 1) return 55;
    if (position === 2) return 35;
    if (position <= 35) return 37 - position;
    return 1;
  });
  const stagePositionPoints = Array.from({ length: MAX_STAGE_POSITIONS }, (_, i) => MAX_STAGE_POSITIONS - i);

  return {
    picksPerWeek: 1,
    maxPicksPerDriverPerSeason: null,
    includeNonPointsRaces: false,
    includeStagePoints: true,
    includeWinnerBonus: false,
    winnerBonus: 0,
    positionPoints,
    stagePositionPoints,
  };
}

function buildOurDefaultPreset(): PickemRuleSetConfig {
  // This league's original formula: one point per position (40 down to 1),
  // +10 for a win, +5 for a stage win only (not the rest of the stage top 10).
  const positionPoints = Array.from({ length: MAX_FIELD_SIZE }, (_, i) => MAX_FIELD_SIZE - i);
  const stagePositionPoints = Array.from({ length: MAX_STAGE_POSITIONS }, (_, i) => (i === 0 ? 5 : 0));

  return {
    picksPerWeek: 1,
    maxPicksPerDriverPerSeason: null,
    includeNonPointsRaces: false,
    includeStagePoints: true,
    includeWinnerBonus: true,
    winnerBonus: 10,
    positionPoints,
    stagePositionPoints,
  };
}

export const PRESETS = {
  nascarOfficial: buildNascarOfficialPreset(),
  ourDefault: buildOurDefaultPreset(),
};

function coerceMatrix(value: unknown, length: number, fallback: number[]): number[] {
  if (!Array.isArray(value) || value.length !== length) return fallback;
  return value.map((n) => (typeof n === "number" && Number.isFinite(n) ? n : 0));
}

// Reads a RuleSet.config JSON value (untyped from Prisma) into a validated
// PickemRuleSetConfig, falling back field-by-field to OUR_DEFAULT for
// anything missing or malformed rather than failing scoring outright.
export function parseRuleSetConfig(config: unknown): PickemRuleSetConfig {
  const c = config as Partial<PickemRuleSetConfig> | null;
  const fallback = PRESETS.ourDefault;

  return {
    picksPerWeek: typeof c?.picksPerWeek === "number" && c.picksPerWeek >= 1 ? Math.floor(c.picksPerWeek) : 1,
    maxPicksPerDriverPerSeason:
      typeof c?.maxPicksPerDriverPerSeason === "number" && c.maxPicksPerDriverPerSeason >= 1
        ? Math.floor(c.maxPicksPerDriverPerSeason)
        : null,
    includeNonPointsRaces: c?.includeNonPointsRaces === true,
    includeStagePoints: c?.includeStagePoints !== false,
    includeWinnerBonus: c?.includeWinnerBonus === true,
    winnerBonus: typeof c?.winnerBonus === "number" ? c.winnerBonus : 0,
    positionPoints: coerceMatrix(c?.positionPoints, MAX_FIELD_SIZE, fallback.positionPoints),
    stagePositionPoints: coerceMatrix(c?.stagePositionPoints, MAX_STAGE_POSITIONS, fallback.stagePositionPoints),
  };
}

export type ScoreBreakdown = {
  baseScore: number;
  winBonus: number;
  stageBonus: number;
  total: number;
};

function pointsForPosition(position: number, matrix: number[]): number {
  const idx = position - 1;
  return idx >= 0 && idx < matrix.length ? matrix[idx] : 0;
}

// stagePositions: this driver's finishing position in each stage they
// placed top-10 in (e.g. [4, 1] = 4th in stage 1, won stage 2). Omit a
// stage entirely if the driver didn't finish top 10 in it.
export function computeScore(
  finishPosition: number,
  stagePositions: number[],
  config: PickemRuleSetConfig,
): ScoreBreakdown {
  const baseScore = pointsForPosition(finishPosition, config.positionPoints);
  const winBonus = config.includeWinnerBonus && finishPosition === 1 ? config.winnerBonus : 0;
  const stageBonus = config.includeStagePoints
    ? stagePositions.reduce((sum, sp) => sum + pointsForPosition(sp, config.stagePositionPoints), 0)
    : 0;
  return { baseScore, winBonus, stageBonus, total: baseScore + winBonus + stageBonus };
}
