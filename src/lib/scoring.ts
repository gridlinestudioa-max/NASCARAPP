// Pick'em scoring engine. A league's RuleSet.config holds a
// PickemRuleSetConfig; this module parses it safely, ships two presets,
// and computes points from it. Finish points come from one of two modes:
// a fixed matrix (like real NASCAR points — 1st is always worth the same
// regardless of how many cars started), or a field-size-relative formula
// (1st is worth however many cars started, scaling down with the field).
// Stage points and the winner bonus are always fixed, in both modes.

export const MAX_FIELD_SIZE = 40;
export const MAX_STAGE_POSITIONS = 10;

export type PointsMode = "fixed" | "fieldSizeRelative";

// When picks lock for a race: "afterQualifying" (the default, and this
// league's original behavior) locks 5 minutes before the race starts, so
// picks can be informed by qualifying results. "beforeQualifying" locks
// blind, at the moment qualifying itself begins — a race with no
// qualifyingAt recorded falls back to the same 5-minutes-before-race-start
// cutoff either way.
export type LockTiming = "beforeQualifying" | "afterQualifying";

export type PickemRuleSetConfig = {
  // Editable Rules
  picksPerWeek: number;
  // null = unlimited.
  maxPicksPerDriverPerSeason: number | null;
  includeNonPointsRaces: boolean;
  lockTiming: LockTiming;

  // Points Rules
  pointsMode: PointsMode;
  includeStagePoints: boolean;
  includeWinnerBonus: boolean;
  winnerBonus: number;
  // Used when pointsMode is "fixed". Index 0 = 1st place ... index 39 =
  // 40th place. Ignored (but still stored, so switching modes doesn't
  // lose your edits) when pointsMode is "fieldSizeRelative".
  positionPoints: number[];
  // Index 0 = 1st in a stage ... index 9 = 10th. Only the top 10 in a
  // stage score, so this is deliberately shorter than positionPoints.
  // Always fixed, regardless of pointsMode.
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
    lockTiming: "afterQualifying",
    pointsMode: "fixed",
    includeStagePoints: true,
    includeWinnerBonus: false,
    winnerBonus: 0,
    positionPoints,
    stagePositionPoints,
  };
}

function buildOurDefaultPreset(): PickemRuleSetConfig {
  // This league's original formula: one point per position, scaled to
  // each race's actual field size (fieldSize + 1 - finishPosition), +10
  // for a win, +5 for a stage win only (not the rest of the stage top 10).
  // positionPoints is still populated (40 down to 1) as a sensible
  // starting point if the league switches to the fixed-matrix mode later.
  const positionPoints = Array.from({ length: MAX_FIELD_SIZE }, (_, i) => MAX_FIELD_SIZE - i);
  const stagePositionPoints = Array.from({ length: MAX_STAGE_POSITIONS }, (_, i) => (i === 0 ? 5 : 0));

  return {
    picksPerWeek: 1,
    maxPicksPerDriverPerSeason: null,
    includeNonPointsRaces: false,
    lockTiming: "afterQualifying",
    pointsMode: "fieldSizeRelative",
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

export function coerceMatrix(value: unknown, length: number, fallback: number[]): number[] {
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
    lockTiming: c?.lockTiming === "beforeQualifying" ? "beforeQualifying" : "afterQualifying",
    pointsMode: c?.pointsMode === "fieldSizeRelative" ? "fieldSizeRelative" : "fixed",
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

function computeBaseScore(finishPosition: number, fieldSize: number, config: PickemRuleSetConfig): number {
  if (config.pointsMode === "fieldSizeRelative") {
    return Math.max(0, fieldSize + 1 - finishPosition);
  }
  return pointsForPosition(finishPosition, config.positionPoints);
}

// stagePositions: this driver's finishing position in each stage they
// placed top-10 in (e.g. [4, 1] = 4th in stage 1, won stage 2). Omit a
// stage entirely if the driver didn't finish top 10 in it. fieldSize only
// matters when config.pointsMode is "fieldSizeRelative".
export function computeScore(
  finishPosition: number,
  fieldSize: number,
  stagePositions: number[],
  config: PickemRuleSetConfig,
): ScoreBreakdown {
  const baseScore = computeBaseScore(finishPosition, fieldSize, config);
  const winBonus = config.includeWinnerBonus && finishPosition === 1 ? config.winnerBonus : 0;
  const stageBonus = config.includeStagePoints
    ? stagePositions.reduce((sum, sp) => sum + pointsForPosition(sp, config.stagePositionPoints), 0)
    : 0;
  return { baseScore, winBonus, stageBonus, total: baseScore + winBonus + stageBonus };
}

// A real qualifying session is always within a couple weeks of the race
// it belongs to — anything further back than this is a bad value (the
// NASCAR feed has been seen sending a "1900-01-01" sentinel for a
// qualifying_date that hasn't been scheduled yet, which nascarFeed.ts now
// filters on the way in, but a race synced before that fix can still have
// it sitting in the database). Treating a value like that as real would
// lock "beforeQualifying" picks as of 1900 — i.e. immediately, forever.
const MAX_QUALIFYING_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;

function hasPlausibleQualifyingDate(race: { qualifyingAt: Date | null; date: Date }): boolean {
  return race.qualifyingAt != null && race.date.getTime() - race.qualifyingAt.getTime() <= MAX_QUALIFYING_LOOKBACK_MS;
}

// When picks lock for a given race, per the league's lockTiming setting.
// "beforeQualifying" locks the moment qualifying begins (blind picks); a
// race with no (plausible) qualifyingAt recorded, or a league using
// "afterQualifying", locks 5 minutes before the race itself starts.
export function pickemLockAt(race: { qualifyingAt: Date | null; date: Date }, lockTiming: LockTiming): Date {
  if (lockTiming === "beforeQualifying" && hasPlausibleQualifyingDate(race)) {
    return race.qualifyingAt!;
  }
  return new Date(race.date.getTime() - 5 * 60 * 1000);
}
