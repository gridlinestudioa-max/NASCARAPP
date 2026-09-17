// Shared scoring formula — used by manual result entry today, and reusable
// as-is once results come from a real NASCAR data feed instead.

export type ScoringConfig = {
  winBonus: number;
};

export function parseScoringConfig(config: unknown): ScoringConfig {
  const scoring = (config as { scoring?: { winBonus?: unknown } } | null)?.scoring;
  const winBonus = typeof scoring?.winBonus === "number" ? scoring.winBonus : 0;
  return { winBonus };
}

// Stage bonus isn't computed here — entering results doesn't capture stage
// winners yet, so it's always 0 for a freshly-scored race (unlike the
// historical import, which had it recorded directly in the source data).
export function computeScore(finishPosition: number, fieldSize: number, config: ScoringConfig) {
  const baseScore = fieldSize + 1 - finishPosition;
  const winBonus = finishPosition === 1 ? config.winBonus : 0;
  const stageBonus = 0;
  return { baseScore, winBonus, stageBonus, total: baseScore + winBonus + stageBonus };
}
