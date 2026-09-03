// TKDL LIVE — Non-Elo Match Predictor for Singles (handover doc section 7).
// Combines the pure formulas in predictor-math.ts with the real facts
// history-reconstruction.ts gathers. See predictor-math.ts for the formula
// citations; this file is where they're wired to actual player data.
import { and, eq, lt, or } from "drizzle-orm";
import { db, matchesTable } from "@workspace/db";
import { buildPlayerBaselines, buildH2HBefore, SINGLES_ONLY, type PlayerBaselines } from "./history-reconstruction";
import {
  smoothedRate, PRIOR_GAMES, recentFormScore,
  scoringEvents, scoringRate30, percentileRank, dartsPerformanceScore, MIN_CHECKOUT_ATTEMPTS,
  weightedAverageWithRedistribution, pairProbability,
  confidenceScore, confidenceBand, type ConfidenceBand,
} from "./predictor-math";

// ── 7.1: feature weights ─────────────────────────────────────────────────
// Exported so title-predictor.ts (section 8) can build the exact same FIXED
// baseline pieces (career rate, darts-performance, opponent quality) it
// freezes for the Monte Carlo simulation — one shared definition rather
// than a second copy that could silently drift from this one.
export const WEIGHTS = {
  currentSeason: 0.25,
  recentForm: 0.20,
  career: 0.15,
  h2h: 0.15,
  dartsPerformance: 0.20,
  opponentQuality: 0.05,
} as const;

// Darts-performance requires at least 3 detailed matches before it counts
// fully (7.4). Rather than a hard on/off switch, this scales the feature's
// *weight* linearly up to that point — a player with 1 detailed match gets
// a little darts-performance signal, not none and not full — and lets
// weightedAverageWithRedistribution's renormalization do the rest: with
// less weight claimed here, the other features' shares grow to fill the
// gap, exactly per the doc's "redistribute proportionally" rule.
const DARTS_FULL_WEIGHT_MATCHES = 3;

// ── Game-type cohort for darts-performance percentiles (7.4) ────────────
// "Convert each metric to a 0..1 percentile inside the same game-type
// cohort" means ranked against every other performance in that game type,
// not the player's own history — so this gathers one sample per side of
// every matching match (both winner's and loser's own darts, since each
// throws independently).

export type GameTypeCohort = {
  scoringRates: number[];
  checkoutRates: number[];
};

export async function buildGameTypeCohort(gameType: string, cutoff: Date): Promise<GameTypeCohort> {
  const rows = await db
    .select({
      winnerDarts: matchesTable.winnerDarts, winner100s: matchesTable.winner100s, winner140s: matchesTable.winner140s,
      winner170s: matchesTable.winner170s, winner180s: matchesTable.winner180s,
      winnerCheckoutAttempts: matchesTable.winnerCheckoutAttempts, winnerCheckoutHits: matchesTable.winnerCheckoutHits,
      loserDarts: matchesTable.loserDarts, loser100s: matchesTable.loser100s, loser140s: matchesTable.loser140s,
      loser170s: matchesTable.loser170s, loser180s: matchesTable.loser180s,
      loserCheckoutAttempts: matchesTable.loserCheckoutAttempts, loserCheckoutHits: matchesTable.loserCheckoutHits,
    })
    .from(matchesTable)
    .where(and(SINGLES_ONLY, eq(matchesTable.gameType, gameType), lt(matchesTable.playedAt, cutoff)));

  const scoringRates: number[] = [];
  const checkoutRates: number[] = [];

  for (const r of rows) {
    if (r.winnerDarts != null) {
      scoringRates.push(scoringRate30(
        scoringEvents({ s100: r.winner100s ?? 0, s140: r.winner140s ?? 0, s170: r.winner170s ?? 0, s180: r.winner180s ?? 0 }),
        r.winnerDarts,
      ));
      if ((r.winnerCheckoutAttempts ?? 0) >= MIN_CHECKOUT_ATTEMPTS) {
        checkoutRates.push(r.winnerCheckoutHits! / r.winnerCheckoutAttempts!);
      }
    }
    if (r.loserDarts != null) {
      scoringRates.push(scoringRate30(
        scoringEvents({ s100: r.loser100s ?? 0, s140: r.loser140s ?? 0, s170: r.loser170s ?? 0, s180: r.loser180s ?? 0 }),
        r.loserDarts,
      ));
      if ((r.loserCheckoutAttempts ?? 0) >= MIN_CHECKOUT_ATTEMPTS) {
        checkoutRates.push(r.loserCheckoutHits! / r.loserCheckoutAttempts!);
      }
    }
  }

  return { scoringRates, checkoutRates };
}

export function dartsFeature(baselines: PlayerBaselines, cohort: GameTypeCohort): { weight: number; value: number | null } {
  const n = baselines.detailedMatches.length;
  if (n === 0) return { weight: WEIGHTS.dartsPerformance, value: null };

  let totalScoringEvents = 0, totalDarts = 0, totalCheckoutHits = 0, totalCheckoutAttempts = 0;
  for (const m of baselines.detailedMatches) {
    totalScoringEvents += scoringEvents({ s100: m.scoring100s, s140: m.scoring140s, s170: m.scoring170s, s180: m.scoring180s });
    totalDarts += m.darts;
    totalCheckoutHits += m.checkoutHits;
    totalCheckoutAttempts += m.checkoutAttempts;
  }

  const aggregateScoringRate = scoringRate30(totalScoringEvents, totalDarts);
  const scoringPercentile = percentileRank(aggregateScoringRate, cohort.scoringRates);
  if (scoringPercentile === null) {
    // No cohort to rank against yet (e.g. nobody's played this game type
    // before) — the feature genuinely can't be computed, not just "low".
    return { weight: WEIGHTS.dartsPerformance, value: null };
  }

  let checkoutPercentile: number | null = null;
  if (totalCheckoutAttempts >= MIN_CHECKOUT_ATTEMPTS) {
    const aggregateCheckoutRate = totalCheckoutHits / totalCheckoutAttempts;
    checkoutPercentile = percentileRank(aggregateCheckoutRate, cohort.checkoutRates);
  }

  const value = dartsPerformanceScore(scoringPercentile, checkoutPercentile);
  const scaledWeight = WEIGHTS.dartsPerformance * Math.min(n / DARTS_FULL_WEIGHT_MATCHES, 1);
  return { weight: scaledWeight, value };
}

// ── Opponent quality (7.1's 5% feature) ──────────────────────────────────
// "Average pre-match smoothed win strength of opponents already faced in
// the current season" — computed point-in-time: each opponent's OWN
// smoothed season win rate as it stood right before that particular
// meeting, not their current rate. At TKDL's real scale (a handful of
// matches per player per season) this is cheap to compute properly rather
// than approximate.
export async function computeOpponentQuality(playerId: number, seasonId: number, cutoff: Date): Promise<number | null> {
  const rows = await db
    .select({ winnerId: matchesTable.winnerId, loserId: matchesTable.loserId, playedAt: matchesTable.playedAt })
    .from(matchesTable)
    .where(and(
      SINGLES_ONLY,
      eq(matchesTable.seasonId, seasonId),
      lt(matchesTable.playedAt, cutoff),
      or(eq(matchesTable.winnerId, playerId), eq(matchesTable.loserId, playerId)),
    ));

  if (rows.length === 0) return null;

  const strengths: number[] = [];
  for (const r of rows) {
    const opponentId = r.winnerId === playerId ? r.loserId : r.winnerId;
    const opponentBaselines = await buildPlayerBaselines(opponentId, r.playedAt);
    const season = opponentBaselines.currentSeason;
    strengths.push(season ? smoothedRate(season.wins, season.gamesPlayed, PRIOR_GAMES.season) : 0.5);
  }

  return strengths.reduce((sum, s) => sum + s, 0) / strengths.length;
}

// ── Combine into one player's overall "strength" (0..1) ──────────────────

async function computeSinglesStrength(
  playerId: number, seasonId: number, cutoff: Date,
  h2hWins: number, h2hGames: number,
  cohort: GameTypeCohort,
): Promise<{ strength: number; baselines: PlayerBaselines; confidence: number }> {
  const baselines = await buildPlayerBaselines(playerId, cutoff, seasonId);
  const seasonRate = baselines.currentSeason
    ? smoothedRate(baselines.currentSeason.wins, baselines.currentSeason.gamesPlayed, PRIOR_GAMES.season)
    : 0.5;
  const careerRate = smoothedRate(baselines.career.wins, baselines.career.gamesPlayed, PRIOR_GAMES.career);
  const h2hRate = h2hGames > 0 ? smoothedRate(h2hWins, h2hGames, PRIOR_GAMES.h2h) : null;
  const recentForm = recentFormScore(baselines.recentResults, seasonRate);
  const opponentQuality = await computeOpponentQuality(playerId, seasonId, cutoff);
  const darts = dartsFeature(baselines, cohort);

  const strength = weightedAverageWithRedistribution([
    { weight: WEIGHTS.currentSeason, value: seasonRate },
    { weight: WEIGHTS.recentForm, value: recentForm },
    { weight: WEIGHTS.career, value: careerRate },
    { weight: WEIGHTS.h2h, value: h2hRate },
    { weight: darts.weight, value: darts.value },
    { weight: WEIGHTS.opponentQuality, value: opponentQuality },
  ]);

  // strength is only null if literally every feature came back null, which
  // can't happen here — seasonRate/careerRate/recentForm always resolve to
  // at least the 50%-prior default. The `?? 0.5` is a defensive floor, not
  // an expected path.
  const confidence = confidenceScore({
    seasonGames: baselines.currentSeason?.gamesPlayed ?? 0,
    careerGames: baselines.career.gamesPlayed,
    h2hGames,
    detailedMatches: baselines.detailedMatches.length,
    recentGames: baselines.recentResults.length,
  });

  return { strength: strength ?? 0.5, baselines, confidence };
}

// ── Public entry point ────────────────────────────────────────────────────

export type SinglesMatchPrediction = {
  playerAId: number;
  playerBId: number;
  cutoff: Date;
  gameType: string;
  pA: number;
  pB: number;
  /**
   * The lower of the two players' individual confidence scores — a
   * prediction naming a probability for a match is only as trustworthy as
   * its LESS-KNOWN participant, so this doesn't average the two away. The
   * handover's confidence formula (7.6) is written per-entity; combining
   * two entities into one prediction is this file's own reasonable
   * reading of it, not something the doc states explicitly — flagging
   * that as a real judgment call rather than a literal spec transcription.
   */
  confidence: number;
  confidenceBand: ConfidenceBand;
  h2h: { aWins: number; bWins: number; gamesPlayed: number };
};

export async function predictSinglesMatch(
  playerAId: number, playerBId: number, seasonId: number,
  opts?: { cutoff?: Date; gameType?: string },
): Promise<SinglesMatchPrediction> {
  const cutoff = opts?.cutoff ?? new Date();
  const gameType = opts?.gameType ?? "501";

  const [h2h, cohort] = await Promise.all([
    buildH2HBefore(playerAId, playerBId, cutoff),
    buildGameTypeCohort(gameType, cutoff),
  ]);

  const [a, b] = await Promise.all([
    computeSinglesStrength(playerAId, seasonId, cutoff, h2h.aWins, h2h.gamesPlayed, cohort),
    computeSinglesStrength(playerBId, seasonId, cutoff, h2h.bWins, h2h.gamesPlayed, cohort),
  ]);

  const { pA, pB } = pairProbability(a.strength, b.strength);
  const confidence = Math.min(a.confidence, b.confidence);

  return {
    playerAId, playerBId, cutoff, gameType,
    pA, pB,
    confidence, confidenceBand: confidenceBand(confidence),
    h2h: { aWins: h2h.aWins, bWins: h2h.bWins, gamesPlayed: h2h.gamesPlayed },
  };
}
