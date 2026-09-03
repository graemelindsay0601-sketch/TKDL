// TKDL LIVE — Open-Wager Title Predictor: pure math (handover doc section 8).
// Zero DB imports, unit tested directly (see __tests__/title-predictor-math.test.ts).
// Comments cite the exact subsection so a formula can be checked against the
// source without hunting for it. This file only covers the parts of section
// 8 that are genuinely pure functions of numbers already gathered elsewhere
// (mostly by buildLeagueActivityProfile in history-reconstruction.ts); the
// DB-facing orchestration — gathering real state, running 2,500 simulations,
// resolving tiebreaks — lives in title-predictor.ts / team-title-predictor.ts.

// ── Europe/London calendar-month arithmetic (8.3) ───────────────────────
// "daysRemaining = hours until Europe/London month end / 24" — the club's
// month (and Shift Wars' monthly reset, lib/seasonReset.ts) runs on UK
// wall-clock time, which crosses the BST/GMT boundary twice a year. Getting
// this right means converting a LOCAL wall-clock instant (midnight on the
// 1st of next month, in London) to the correct UTC instant for that
// specific date — not assuming a fixed UTC offset, which would be off by an
// hour for roughly half the year.
const LONDON_TZ = "Europe/London";

/** The UTC offset (minutes) of `timeZone` at the instant `at` — e.g. +60 during BST. */
function tzOffsetMinutes(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {} as Record<string, string>);
  // Intl formats local midnight as hour "24" rather than "00" in some engines — normalize.
  const hour = parts.hour === "24" ? 0 : Number(parts.hour);
  const asUTC = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hour, Number(parts.minute), Number(parts.second));
  return (asUTC - at.getTime()) / 60000;
}

/** The UTC instant corresponding to `y-m-d 00:00:00` LOCAL wall-clock time in `timeZone`. */
function localMidnightUTC(y: number, m: number, d: number, timeZone: string): Date {
  const guess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const offset = tzOffsetMinutes(guess, timeZone);
  return new Date(guess.getTime() - offset * 60000);
}

/** The UTC instant of the first moment of the calendar month AFTER `referenceNow`, reckoned on the Europe/London wall clock. */
export function londonMonthEndUTC(referenceNow: Date): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: LONDON_TZ, year: "numeric", month: "2-digit",
  }).formatToParts(referenceNow).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {} as Record<string, string>);
  const year = Number(parts.year);
  const month = Number(parts.month); // 1-12, the CURRENT London month
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return localMidnightUTC(nextYear, nextMonth, 1, LONDON_TZ);
}

/** Handover 8.3: daysRemaining = hours until Europe/London month end / 24. Floored at 0 — never negative even a moment after rollover. */
export function daysRemainingInMonth(referenceNow: Date): number {
  const end = londonMonthEndUTC(referenceNow);
  const hours = (end.getTime() - referenceNow.getTime()) / (1000 * 60 * 60);
  return Math.max(hours, 0) / 24;
}

// ── 8.3: remaining activity model ────────────────────────────────────────
// leagueDailyRate = 0.70*currentDailyRate + 0.30*historicalDailyRate, or
// currentDailyRate alone if there's no season history yet.
export function leagueDailyRate(currentDailyRate: number, historicalDailyRate: number | null): number {
  if (historicalDailyRate === null) return currentDailyRate;
  return 0.70 * currentDailyRate + 0.30 * historicalDailyRate;
}

// futureMatchCount ~ Poisson(leagueDailyRate * daysRemaining).
export const DEFAULT_SIMULATION_COUNT = 2500;

/**
 * Knuth's algorithm — O(lambda) per draw, fine for the small lambdas TKDL's
 * real match volume ever produces (well under 100 expected future matches
 * in a month even at a generous daily rate). `rng` is injectable so tests
 * can drive it deterministically instead of asserting on random output.
 */
export function poissonSample(lambda: number, rng: () => number = Math.random): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L);
  return k - 1;
}

// ── 8.4: participant selection ───────────────────────────────────────────
// "Activity propensity is based on current-season appearances with a
// one-appearance smoothing prior." The doc doesn't spell out the exact
// formula. Read the same way every other smoothing prior in this codebase
// is read (predictor-math.ts's smoothedRate: a virtual head start, not a
// multiplier) — a participant with zero real appearances this season still
// gets sampled sometimes, ramping up smoothly as they actually play, rather
// than either "0 appearances = 0% chance" or "everyone weighted equally
// regardless of real activity."
export function activityPropensity(matchesPlayed: number): number {
  return matchesPlayed + 1;
}

/**
 * "Pair weight is the geometric mean of the two participant propensities,
 * multiplied by a small historical pair-frequency factor (maximum +25%)."
 * The doc doesn't say how "historical pair frequency" maps onto that +25%
 * ceiling, so this scales linearly against whichever pair in the pool has
 * met most often historically — the single most-frequent real-world
 * pairing gets the full +25% nudge, and every other pair gets a
 * proportionally smaller one, rather than an arbitrary fixed step per
 * meeting (which would have no natural cap).
 */
export function pairFrequencyFactor(pairMeetings: number, maxPairMeetingsInPool: number): number {
  if (maxPairMeetingsInPool <= 0) return 1;
  return 1 + 0.25 * (pairMeetings / maxPairMeetingsInPool);
}

export function pairWeight(propensityA: number, propensityB: number, frequencyFactor: number): number {
  return Math.sqrt(propensityA * propensityB) * frequencyFactor;
}

export type WeightedPair = { a: number; b: number; weight: number };

/** Roulette-wheel selection over every candidate pair's weight. Falls back to a uniform pick only in the degenerate case of every weight being <= 0, which can't happen given propensities are always >= 1. */
export function sampleWeightedPair(pairs: WeightedPair[], rng: () => number = Math.random): { a: number; b: number } | null {
  if (pairs.length === 0) return null;
  const total = pairs.reduce((sum, p) => sum + p.weight, 0);
  if (total <= 0) {
    const idx = Math.floor(rng() * pairs.length);
    return { a: pairs[idx].a, b: pairs[idx].b };
  }
  let r = rng() * total;
  for (const p of pairs) {
    r -= p.weight;
    if (r <= 0) return { a: p.a, b: p.b };
  }
  const last = pairs[pairs.length - 1]; // floating-point fallback — r can land exactly on the boundary
  return { a: last.a, b: last.b };
}

// ── 8.5: stake simulation ────────────────────────────────────────────────
/**
 * Samples one stake from the empirical positive-stake history (never a
 * fitted distribution, per the doc), falling back to 1 when no positive
 * history exists at all, then clamps to `maxStake` (= getMaxStake of the
 * two simulated balances, from lib/wager.ts). A clamp result of 0 is a
 * defensive floor for the case where a simulated participant's balance
 * has hit 0 — it should not occur in practice, since a participant who's
 * hit 0 is eliminated and excluded from selection before a stake is ever
 * sampled for them (see title-predictor.ts's simulation loop).
 */
export function sampleStake(positiveStakes: number[], maxStake: number, rng: () => number = Math.random): number {
  const raw = positiveStakes.length > 0
    ? positiveStakes[Math.floor(rng() * positiveStakes.length)]
    : 1;
  return Math.max(0, Math.min(raw, maxStake));
}

// ── 8.8: model confidence ────────────────────────────────────────────────
// The doc gives no formula for Title Predictor confidence, only the
// intent: "based primarily on remaining time, amount of match history and
// activity-model stability... early-month probabilities should normally
// be less confident than late-month probabilities." This combines three
// 0..1 factors reflecting exactly that intent — timeProgress (how much of
// the month has actually happened, the doc's own explicit example),
// historyFactor (how many real matches this season already give the
// simulation something to work with) and stabilityFactor (how closely the
// current pace matches the historical pace — a season running wildly
// faster or slower than history is a less trustworthy activity model,
// even late in the month) — then reuses predictor-math.ts's
// confidenceBand() thresholds for the LOW/MEDIUM/HIGH label so both
// predictors report bands on the same scale.
const TITLE_CONFIDENCE_MATCH_HISTORY_CAP = 20; // "plenty of history" at TKDL's real scale (10 players)

export type TitleConfidenceInputs = {
  elapsedDays: number;
  daysRemaining: number;
  matchesThisSeason: number;
  currentDailyRate: number;
  historicalDailyRate: number | null;
};

export function titleConfidenceScore(inputs: TitleConfidenceInputs): number {
  const totalDays = inputs.elapsedDays + inputs.daysRemaining;
  const timeProgress = totalDays > 0 ? inputs.elapsedDays / totalDays : 0;

  const historyFactor = Math.min(inputs.matchesThisSeason / TITLE_CONFIDENCE_MATCH_HISTORY_CAP, 1);

  let stabilityFactor: number;
  if (inputs.historicalDailyRate === null) {
    // No prior seasons to compare against — there's genuinely no way yet
    // to tell whether the current pace is "normal," so this sits at a
    // fixed midpoint rather than claiming either high or low stability.
    stabilityFactor = 0.5;
  } else {
    const reference = Math.max(inputs.historicalDailyRate, 0.1);
    const deviation = Math.abs(inputs.currentDailyRate - inputs.historicalDailyRate) / reference;
    stabilityFactor = 1 - Math.min(deviation, 1);
  }

  return 100 * (0.40 * timeProgress + 0.30 * historyFactor + 0.30 * stabilityFactor);
}
