// TKDL LIVE — Story Engine: PERFORMANCE family detectors (handover doc
// Appendix A / section 9.4). Singles-only, same reasoning as the other
// story-detectors-*.ts files. Match-anchored, ONE player's own darts stats
// in ONE match evaluated against their own baseline and the league cohort
// — reuses predictor-math.ts's percentileRank()/scoringRate30() the same
// way match-predictor.ts's dartsFeature() already does, just for detection
// instead of prediction.
//
// SEASON_BEST/PERSONAL_BEST are the one pair here that can't be verified
// from a single match's own stats — "Only when historical data proves the
// claim" (9.4) means comparing against the player's ENTIRE season/career
// history, which only story-engine.ts (with real DB access) can actually
// scan; this file just consumes the already-verified boolean + the record
// value it produced, the same division of labour title-predictor.ts uses
// for its own DB-dependent inputs.
import { SCORE_MAX, subjectKey } from "./story-engine-math.ts";
import type { StoryCandidate } from "./story-types.ts";

export type SinglesPerformanceFacts = {
  playerId: number;
  matchId: number;
  won: boolean;
  checkoutAttempts: number;
  checkoutHits: number;
  /** This match's own scoringRate30 (predictor-math.ts's scoringEvents()/scoringRate30()). */
  scoringRate30: number;
  /** Aggregate checkout rate from this player's PRIOR matches only, or null with fewer than MIN_CHECKOUT_ATTEMPTS lifetime attempts to baseline against. */
  ownBaselineCheckoutRate: number | null;
  /** Aggregate scoringRate30 from this player's PRIOR matches only, or null with no detailed history yet. */
  ownBaselineScoringRate30: number | null;
  /** This match's checkout rate ranked within the same-game-type league cohort (predictor-math.ts's percentileRank()), or null with an empty cohort or insufficient attempts. */
  checkoutPercentile: number | null;
  /** This match's scoringRate30 ranked within the same-game-type league cohort, or null with an empty cohort. */
  scoringPercentile: number | null;
  /** story-engine.ts already scanned this player's full season history and confirmed this match sets a new season high on whichever metric recordMetricLabel names. */
  isVerifiedSeasonBest: boolean;
  /** Same, scanned against full career history. */
  isVerifiedPersonalBest: boolean;
  recordMetricLabel: string | null;
  recordMetricValue: number | null;
};

const MIN_CHECKOUT_ATTEMPTS_CLINICAL = 6;
const MIN_CHECKOUT_ATTEMPTS_TROUBLE = 8;
const MATERIAL_CHECKOUT_DELTA = 0.15;
const HIGH_CHECKOUT_PERCENTILE = 0.75;
const HIGH_SCORING_PERCENTILE = 0.85;
const LOW_CHECKOUT_PERCENTILE = 0.35;
const SCORING_WITHOUT_FINISHING_SCORING_PERCENTILE = 0.75;

function subjects(playerId: number): string[] {
  return [subjectKey("singles", playerId)];
}

// ── CLINICAL_FINISHING (9.4: >=6 attempts, rate above own baseline + league percentile) ─
export function detectClinicalFinishing(facts: SinglesPerformanceFacts): StoryCandidate | null {
  if (facts.checkoutAttempts < MIN_CHECKOUT_ATTEMPTS_CLINICAL) return null;
  if (facts.ownBaselineCheckoutRate === null || facts.checkoutPercentile === null) return null;

  const rate = facts.checkoutHits / facts.checkoutAttempts;
  const aboveOwnBaseline = rate - facts.ownBaselineCheckoutRate >= MATERIAL_CHECKOUT_DELTA;
  const aboveLeaguePercentile = facts.checkoutPercentile >= HIGH_CHECKOUT_PERCENTILE;
  if (!aboveOwnBaseline || !aboveLeaguePercentile) return null;

  return {
    storyType: "CLINICAL_FINISHING",
    leagueType: "singles",
    subjectKeys: subjects(facts.playerId),
    anchorMatchId: facts.matchId,
    sentiment: "positive",
    tags: ["clinical_finishing"],
    facts: {
      playerId: facts.playerId, checkoutRate: rate, checkoutAttempts: facts.checkoutAttempts,
      ownBaselineCheckoutRate: facts.ownBaselineCheckoutRate, checkoutPercentile: facts.checkoutPercentile,
    },
    components: {
      competitiveImportance: 3,
      unexpectedness: 0,
      historicalSignificance: 3,
      performanceAnomaly: SCORE_MAX.performanceAnomaly * Math.min(facts.checkoutPercentile, 1),
      entertainmentValue: 4,
    },
  };
}

// ── DOUBLE_TROUBLE (9.4: >=8 attempts, rate materially below own baseline) ─
// "Never use after a single poor finish" is satisfied structurally by the
// 8-attempt minimum itself — a single bad finish is exactly 1 attempt, 0
// hits, which can't reach 8 attempts on its own; this only fires once
// there's a real SAMPLE of struggling, not one unlucky dart.
export function detectDoubleTrouble(facts: SinglesPerformanceFacts): StoryCandidate | null {
  if (facts.checkoutAttempts < MIN_CHECKOUT_ATTEMPTS_TROUBLE) return null;
  if (facts.ownBaselineCheckoutRate === null) return null;

  const rate = facts.checkoutHits / facts.checkoutAttempts;
  const belowOwnBaseline = facts.ownBaselineCheckoutRate - rate >= MATERIAL_CHECKOUT_DELTA;
  if (!belowOwnBaseline) return null;

  return {
    storyType: "DOUBLE_TROUBLE",
    leagueType: "singles",
    subjectKeys: subjects(facts.playerId),
    anchorMatchId: facts.matchId,
    sentiment: "negative",
    tags: ["double_trouble", "cooldown_sensitive"],
    facts: {
      playerId: facts.playerId, checkoutRate: rate, checkoutAttempts: facts.checkoutAttempts,
      ownBaselineCheckoutRate: facts.ownBaselineCheckoutRate,
    },
    components: {
      competitiveImportance: 2,
      unexpectedness: 0,
      historicalSignificance: 2,
      performanceAnomaly: SCORE_MAX.performanceAnomaly * Math.min((facts.ownBaselineCheckoutRate - rate) / 0.4, 1),
      entertainmentValue: 1,
    },
  };
}

// ── SCORING_POWER (Appendix A: high scoringRate30 percentile) ─────────────
export function detectScoringPower(facts: SinglesPerformanceFacts): StoryCandidate | null {
  if (facts.scoringPercentile === null) return null;
  if (facts.scoringPercentile < HIGH_SCORING_PERCENTILE) return null;

  return {
    storyType: "SCORING_POWER",
    leagueType: "singles",
    subjectKeys: subjects(facts.playerId),
    anchorMatchId: facts.matchId,
    sentiment: "positive",
    tags: ["scoring_power"],
    facts: { playerId: facts.playerId, scoringRate30: facts.scoringRate30, scoringPercentile: facts.scoringPercentile },
    components: {
      competitiveImportance: 3,
      unexpectedness: 0,
      historicalSignificance: 3,
      performanceAnomaly: SCORE_MAX.performanceAnomaly * facts.scoringPercentile,
      entertainmentValue: 4,
    },
  };
}

// ── SCORING_WITHOUT_FINISHING (Appendix A: strong scoring + weak checkout + poor/close outcome) ─
// "Poor/close outcome" — with only a win/loss result available (no leg-by-
// leg score margin in this schema, per history-reconstruction.ts's own
// DetailedMatchStat shape), the concrete, checkable proxy used here is
// simply that this player did NOT win despite the strong scoring — the
// available signal closest to "the finishing let them down."
export function detectScoringWithoutFinishing(facts: SinglesPerformanceFacts): StoryCandidate | null {
  if (facts.scoringPercentile === null || facts.checkoutPercentile === null) return null;
  if (facts.scoringPercentile < SCORING_WITHOUT_FINISHING_SCORING_PERCENTILE) return null;
  if (facts.checkoutPercentile > LOW_CHECKOUT_PERCENTILE) return null;
  if (facts.won) return null;

  return {
    storyType: "SCORING_WITHOUT_FINISHING",
    leagueType: "singles",
    subjectKeys: subjects(facts.playerId),
    anchorMatchId: facts.matchId,
    sentiment: "negative",
    tags: ["scoring_without_finishing", "cooldown_sensitive"],
    facts: {
      playerId: facts.playerId, scoringPercentile: facts.scoringPercentile, checkoutPercentile: facts.checkoutPercentile,
    },
    components: {
      competitiveImportance: 3,
      unexpectedness: 0,
      historicalSignificance: 2,
      performanceAnomaly: SCORE_MAX.performanceAnomaly * 0.6,
      entertainmentValue: 2,
    },
  };
}

// ── SEASON_BEST / PERSONAL_BEST (9.4: only when historical data proves the claim) ─
export function detectSeasonBest(facts: SinglesPerformanceFacts): StoryCandidate | null {
  if (!facts.isVerifiedSeasonBest) return null;

  return {
    storyType: "SEASON_BEST",
    leagueType: "singles",
    subjectKeys: subjects(facts.playerId),
    anchorMatchId: facts.matchId,
    sentiment: "positive",
    tags: ["season_best"],
    // verifiedRecordClaim: true — not a placeholder value, it's literally what
    // the `isVerifiedSeasonBest` guard above already proved before this
    // candidate could exist. Exposed as a fact (rather than left implicit) so
    // the Commentary Engine's mechanical record-claim rule (17.2) can require
    // it on any phrase using "best"/"record"/"highest"-type language, per the
    // fact firewall's own rule that nothing may be interpolated that isn't
    // traceable to a real, already-verified query result.
    facts: { playerId: facts.playerId, metric: facts.recordMetricLabel, value: facts.recordMetricValue, verifiedRecordClaim: true },
    components: {
      competitiveImportance: 4,
      unexpectedness: 0,
      historicalSignificance: 8,
      performanceAnomaly: SCORE_MAX.performanceAnomaly * 0.5,
      entertainmentValue: 4,
    },
  };
}

export function detectPersonalBest(facts: SinglesPerformanceFacts): StoryCandidate | null {
  if (!facts.isVerifiedPersonalBest) return null;

  return {
    storyType: "PERSONAL_BEST",
    leagueType: "singles",
    subjectKeys: subjects(facts.playerId),
    anchorMatchId: facts.matchId,
    sentiment: "positive",
    tags: ["personal_best"],
    // See detectSeasonBest's own comment just above for why this is a real
    // fact and not a placeholder.
    facts: { playerId: facts.playerId, metric: facts.recordMetricLabel, value: facts.recordMetricValue, verifiedRecordClaim: true },
    components: {
      competitiveImportance: 5,
      unexpectedness: 0,
      historicalSignificance: SCORE_MAX.historicalSignificance, // a career record is about as historically significant as a Singles moment gets
      performanceAnomaly: SCORE_MAX.performanceAnomaly,
      entertainmentValue: 5,
    },
  };
}

export const PERFORMANCE_DETECTORS = [
  detectClinicalFinishing,
  detectDoubleTrouble,
  detectScoringPower,
  detectScoringWithoutFinishing,
  detectSeasonBest,
  detectPersonalBest,
] as const satisfies readonly ((facts: SinglesPerformanceFacts) => StoryCandidate | null)[];

export function detectPerformanceStories(facts: SinglesPerformanceFacts): StoryCandidate[] {
  return PERFORMANCE_DETECTORS.map(detector => detector(facts)).filter((c): c is StoryCandidate => c !== null);
}
