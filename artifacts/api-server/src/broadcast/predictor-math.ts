// TKDL LIVE — Non-Elo Match Predictor: pure math (handover doc section 7).
// Zero DB imports, unit tested directly (see __tests__/predictor-math.test.ts).
// Every formula here is transcribed straight from the doc; comments cite the
// exact subsection so a formula can be checked against the source without
// hunting for it.

// ── 7.2: smoothing formulas ──────────────────────────────────────────────
// smoothedRate(wins, games, priorGames) = (wins + 0.5*priorGames) / (games + priorGames)
// These priors deliberately pull small samples toward 50% — the right
// instinct at TKDL's real scale (10 players, ~1 match/day at most).
export const PRIOR_GAMES = {
  season: 4,
  career: 8,
  h2h: 4,
} as const;

export function smoothedRate(wins: number, games: number, priorGames: number): number {
  return (wins + 0.5 * priorGames) / (games + priorGames);
}

// ── 7.3: recent form ─────────────────────────────────────────────────────
// weights = [5,4,3,2,1] for newest -> oldest; recentForm = weightedWins /
// sum(weights actually available); if fewer than 2 matches, blend 50%
// recentForm + 50% seasonRate.
const RECENT_FORM_WEIGHTS = [5, 4, 3, 2, 1];

export function recentFormScore(recentResultsNewestFirst: ("W" | "L")[], seasonRate: number): number {
  const slice = recentResultsNewestFirst.slice(0, RECENT_FORM_WEIGHTS.length);
  if (slice.length === 0) return seasonRate;

  let weightedWins = 0;
  let weightSum = 0;
  for (let i = 0; i < slice.length; i++) {
    const w = RECENT_FORM_WEIGHTS[i];
    weightSum += w;
    if (slice[i] === "W") weightedWins += w;
  }
  const raw = weightedWins / weightSum;

  if (slice.length < 2) return 0.5 * raw + 0.5 * seasonRate;
  return raw;
}

// ── 7.4: Singles darts-performance factor ───────────────────────────────
// scoringEvents = 1.0*100s + 1.4*140s + 1.8*170s + 2.2*180s
// scoringRate30 = scoringEvents / max(dartsThrown/30, 1)
// checkoutRate = checkoutHits / checkoutAttempts (require >= 6 attempts)
// Each metric is converted to a 0..1 percentile inside the same game-type
// cohort (i.e. ranked against everyone else's aggregate, not the player's
// own history) before being combined 0.60/0.40.
export function scoringEvents(counts: { s100: number; s140: number; s170: number; s180: number }): number {
  return 1.0 * counts.s100 + 1.4 * counts.s140 + 1.8 * counts.s170 + 2.2 * counts.s180;
}

export function scoringRate30(events: number, dartsThrown: number): number {
  return events / Math.max(dartsThrown / 30, 1);
}

export const MIN_CHECKOUT_ATTEMPTS = 6;

/** Standard percentile rank: fraction of the cohort at or below `value`. Returns null on an empty cohort — nothing to rank against. */
export function percentileRank(value: number, cohort: number[]): number | null {
  if (cohort.length === 0) return null;
  const atOrBelow = cohort.filter(v => v <= value).length;
  return atOrBelow / cohort.length;
}

/**
 * Combines scoring + checkout percentiles per 7.4's 0.60/0.40 split.
 * If checkoutPercentile is null (insufficient checkout attempts, or no
 * checkout cohort to rank against), scoring is used alone — per the doc:
 * "If checkout data is insufficient, use scoring only." Never returns null
 * when a scoring percentile IS available; the whole feature is only
 * unavailable when the caller never had enough detailed matches to compute
 * scoringPercentile in the first place (handled one level up).
 */
export function dartsPerformanceScore(scoringPercentile: number, checkoutPercentile: number | null): number {
  if (checkoutPercentile === null) return scoringPercentile;
  return 0.60 * scoringPercentile + 0.40 * checkoutPercentile;
}

// ── Generic redistribution helper ────────────────────────────────────────
// Used by every feature-weighted-average in section 7 (Singles 7.1, Doubles
// 7.7, Shift Wars 7.8): "if a feature is unavailable, redistribute its
// weight proportionally across the other available features. Never
// substitute zero." This is the one general-purpose implementation of that
// rule, rather than each predictor re-deriving it slightly differently.
export type WeightedFeature = { weight: number; value: number | null };

export function weightedAverageWithRedistribution(features: WeightedFeature[]): number | null {
  const available = features.filter((f): f is { weight: number; value: number } => f.value !== null);
  const totalAvailableWeight = available.reduce((sum, f) => sum + f.weight, 0);
  if (totalAvailableWeight === 0) return null;
  return available.reduce((sum, f) => sum + (f.weight / totalAvailableWeight) * f.value, 0);
}

// ── 7.5: pair probability ────────────────────────────────────────────────
// rawP(A) = 1 / (1 + exp(-3.2 * delta)); p(A) = clamp(rawP(A), 0.10, 0.90)
const PAIR_PROBABILITY_STEEPNESS = 3.2;
const PAIR_PROBABILITY_MIN = 0.10;
const PAIR_PROBABILITY_MAX = 0.90;

export function pairProbability(strengthA: number, strengthB: number): { pA: number; pB: number } {
  const delta = strengthA - strengthB;
  const raw = 1 / (1 + Math.exp(-PAIR_PROBABILITY_STEEPNESS * delta));
  const pA = Math.min(PAIR_PROBABILITY_MAX, Math.max(PAIR_PROBABILITY_MIN, raw));
  return { pA, pB: 1 - pA };
}

// ── 7.6: confidence ───────────────────────────────────────────────────────
// confidenceScore = 30*min(seasonGames/10,1) + 20*min(careerGames/30,1)
//                  + 20*min(h2hGames/8,1) + 20*min(detailedMatches/8,1)
//                  + 10*min(recentGames/5,1)
// LOW < 45, MEDIUM 45..74, HIGH >= 75
export type ConfidenceInputs = {
  seasonGames: number;
  careerGames: number;
  h2hGames: number;
  detailedMatches: number;
  recentGames: number;
};

export function confidenceScore(inputs: ConfidenceInputs): number {
  return (
    30 * Math.min(inputs.seasonGames / 10, 1) +
    20 * Math.min(inputs.careerGames / 30, 1) +
    20 * Math.min(inputs.h2hGames / 8, 1) +
    20 * Math.min(inputs.detailedMatches / 8, 1) +
    10 * Math.min(inputs.recentGames / 5, 1)
  );
}

export type ConfidenceBand = "LOW" | "MEDIUM" | "HIGH";

export function confidenceBand(score: number): ConfidenceBand {
  if (score < 45) return "LOW";
  if (score < 75) return "MEDIUM";
  return "HIGH";
}
