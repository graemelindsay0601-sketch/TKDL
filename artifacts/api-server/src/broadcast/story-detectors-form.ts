// TKDL LIVE — Story Engine: FORM family detectors (handover doc Appendix
// A / section 9.4). Singles-only, same reasoning as story-detectors-result.ts.
//
// Unlike RESULT, these are SUBJECT-ANCHORED, not match-anchored — a win
// streak or a table climb is an ONGOING situation about one player, re-
// detected fresh after every one of their matches, meant to update the
// SAME broadcast_stories row as it develops (story-engine-math.ts's
// subjectAnchoredStoryKey()) rather than spawn a new row every time.
// story-engine.ts is expected to run these once per player who played in
// the batch being processed, not once per match.
import type { PlayerBaselines } from "./history-reconstruction";
import {
  SCORE_MAX,
  subjectKey,
} from "./story-engine-math.ts";
import type { StoryCandidate } from "./story-types.ts";

export type SinglesFormFacts = {
  playerId: number;
  /** Newest result first, capped at 10 — PlayerBaselines.recentResults as-is. */
  recentResultsNewestFirst: PlayerBaselines["recentResults"];
  currentWinStreak: number;
  currentLossStreak: number;
  /** Smoothed current-season win rate (predictor-math.ts's smoothedRate + PRIOR_GAMES.season) — the "own baseline" ABOVE_BASELINE compares recent form against. */
  seasonRate: number;
  /** 1 = outright leader, among active (non-eliminated) players, as of the detection cutoff. */
  currentPosition: number;
  /** This player's standings position exactly `matches` of their OWN matches ago, or null if they haven't played that many yet — the window QUIET_CLIMBER/FREEFALL measure movement across. */
  positionWindow: { matches: number; positionBefore: number } | null;
  /** Whether a Major-treatment story already explains this player's recent position change (checked by story-engine.ts against this edition's own RESULT-family detections before running FORM) — QUIET_CLIMBER's own trigger explicitly excludes this case. */
  majorStoryAlreadyExplainsMove: boolean;
};

function subjects(playerId: number): string[] {
  return [subjectKey("singles", playerId)];
}

// ── WIN_STREAK (9.4: 3 noteworthy, 5 strong, 7+ major) ────────────────────
const WIN_STREAK_MIN = 3;
const WIN_STREAK_STRONG = 5;
const WIN_STREAK_MAJOR = 7;

export function detectWinStreak(facts: SinglesFormFacts): StoryCandidate | null {
  const streak = facts.currentWinStreak;
  if (streak < WIN_STREAK_MIN) return null;

  const tier: "noteworthy" | "strong" | "major" =
    streak >= WIN_STREAK_MAJOR ? "major" : streak >= WIN_STREAK_STRONG ? "strong" : "noteworthy";
  const tierFraction = tier === "major" ? 1 : tier === "strong" ? 0.65 : 0.35;

  return {
    storyType: "WIN_STREAK",
    leagueType: "singles",
    subjectKeys: subjects(facts.playerId),
    sentiment: "positive",
    tags: ["win_streak", tier],
    facts: { playerId: facts.playerId, currentWinStreak: streak, tier },
    components: {
      competitiveImportance: SCORE_MAX.competitiveImportance * 0.3 * tierFraction,
      unexpectedness: 0, // not a RESULT-family story — no single pre-match probability to derive this from
      historicalSignificance: SCORE_MAX.historicalSignificance * tierFraction,
      performanceAnomaly: 0,
      entertainmentValue: SCORE_MAX.entertainmentValue * tierFraction,
    },
  };
}

// ── LOSS_STREAK (9.4: 3 losses may be analytical; negative humour capped) ─
const LOSS_STREAK_MIN = 3;

export function detectLossStreak(facts: SinglesFormFacts): StoryCandidate | null {
  const streak = facts.currentLossStreak;
  if (streak < LOSS_STREAK_MIN) return null;

  // Deliberately modest entertainmentValue and a "cooldown_sensitive" tag —
  // 12.7's negative-player cooldown/max-per-Edition guardrails are the
  // Presenter/Commentary Engine's job (section 12, a later phase), but this
  // detector should mark the story so that machinery has something to key
  // off once it exists, rather than silently producing a plain LOSS_STREAK
  // indistinguishable from any other negative story.
  const historicalSignificance = Math.min(streak / 10, 1) * (SCORE_MAX.historicalSignificance * 0.5);

  return {
    storyType: "LOSS_STREAK",
    leagueType: "singles",
    subjectKeys: subjects(facts.playerId),
    sentiment: "negative",
    tags: ["loss_streak", "cooldown_sensitive"],
    facts: { playerId: facts.playerId, currentLossStreak: streak },
    components: {
      competitiveImportance: SCORE_MAX.competitiveImportance * 0.2,
      unexpectedness: 0,
      historicalSignificance,
      performanceAnomaly: 0,
      entertainmentValue: 1,
    },
  };
}

// ── FORM_REVERSAL (Appendix A: recent five materially better/worse than prior five) ─
const FORM_REVERSAL_MIN_GAMES = 10; // needs both a full recent-5 and a full prior-5
const FORM_REVERSAL_MATERIAL_DELTA = 0.4; // a 2-of-5-game swing, the smallest change that isn't just noise

function winRate(results: ("W" | "L")[]): number {
  if (results.length === 0) return 0;
  return results.filter(r => r === "W").length / results.length;
}

export function detectFormReversal(facts: SinglesFormFacts): StoryCandidate | null {
  if (facts.recentResultsNewestFirst.length < FORM_REVERSAL_MIN_GAMES) return null;

  const recentFive = facts.recentResultsNewestFirst.slice(0, 5);
  const priorFive = facts.recentResultsNewestFirst.slice(5, 10);
  const delta = winRate(recentFive) - winRate(priorFive);
  if (Math.abs(delta) < FORM_REVERSAL_MATERIAL_DELTA) return null;

  const direction = delta > 0 ? "improving" : "declining";

  return {
    storyType: "FORM_REVERSAL",
    leagueType: "singles",
    subjectKeys: subjects(facts.playerId),
    sentiment: direction === "improving" ? "positive" : "neutral",
    tags: ["form_reversal", direction],
    facts: {
      playerId: facts.playerId, direction,
      recentFiveWins: recentFive.filter(r => r === "W").length,
      priorFiveWins: priorFive.filter(r => r === "W").length,
    },
    components: {
      competitiveImportance: SCORE_MAX.competitiveImportance * 0.15,
      unexpectedness: 0,
      historicalSignificance: SCORE_MAX.historicalSignificance * Math.min(Math.abs(delta), 1),
      performanceAnomaly: 0,
      entertainmentValue: 2,
    },
  };
}

// ── QUIET_CLIMBER / FREEFALL (Appendix A: +/-2 positions over >=3 matches) ─
const POSITION_MOVE_MIN = 2;
const POSITION_WINDOW_MIN_MATCHES = 3;

export function detectQuietClimber(facts: SinglesFormFacts): StoryCandidate | null {
  if (!facts.positionWindow) return null;
  if (facts.positionWindow.matches < POSITION_WINDOW_MIN_MATCHES) return null;
  if (facts.majorStoryAlreadyExplainsMove) return null; // this IS the trigger's own exclusion, not a scoring nicety

  // Lower position number = better standing, so climbing is a DECREASE.
  const improvement = facts.positionWindow.positionBefore - facts.currentPosition;
  if (improvement < POSITION_MOVE_MIN) return null;

  return {
    storyType: "QUIET_CLIMBER",
    leagueType: "singles",
    subjectKeys: subjects(facts.playerId),
    sentiment: "positive",
    tags: ["quiet_climber"],
    facts: {
      playerId: facts.playerId, positionBefore: facts.positionWindow.positionBefore,
      currentPosition: facts.currentPosition, matches: facts.positionWindow.matches,
    },
    components: {
      competitiveImportance: SCORE_MAX.competitiveImportance * 0.4,
      unexpectedness: 0,
      historicalSignificance: 0,
      performanceAnomaly: 0,
      entertainmentValue: 3,
    },
  };
}

export function detectFreefall(facts: SinglesFormFacts): StoryCandidate | null {
  if (!facts.positionWindow) return null;
  if (facts.positionWindow.matches < POSITION_WINDOW_MIN_MATCHES) return null;
  // "Sustained losses" — a slide down the table without an active losing
  // run isn't a freefall, just normal table churn.
  if (facts.currentLossStreak < 2) return null;

  const decline = facts.currentPosition - facts.positionWindow.positionBefore;
  if (decline < POSITION_MOVE_MIN) return null;

  return {
    storyType: "FREEFALL",
    leagueType: "singles",
    subjectKeys: subjects(facts.playerId),
    sentiment: "neutral", // explicit per Appendix A — a slide reported straight, not piled on
    tags: ["freefall"],
    facts: {
      playerId: facts.playerId, positionBefore: facts.positionWindow.positionBefore,
      currentPosition: facts.currentPosition, matches: facts.positionWindow.matches,
      currentLossStreak: facts.currentLossStreak,
    },
    components: {
      competitiveImportance: SCORE_MAX.competitiveImportance * 0.4,
      unexpectedness: 0,
      historicalSignificance: 0,
      performanceAnomaly: 0,
      entertainmentValue: 1,
    },
  };
}

// ── ABOVE_BASELINE (Appendix A: performance materially above own baseline) ─
const ABOVE_BASELINE_MIN_GAMES = 3;
const ABOVE_BASELINE_MATERIAL_DELTA = 0.15;

// predictor-math.ts's own recentFormScore() needs a Match Predictor-style
// call (weights + a season-rate blend for small samples) — rather than
// re-import that formula into a FORM-family file that has no other reason
// to touch match-predictor.ts, this reads "recent form" the same simple
// way FORM_REVERSAL already does above: plain win rate over the same
// capped recent window, compared against the smoothed season rate the
// caller already computed. A simpler, self-contained measure of the same
// underlying idea (recent performance vs season baseline), not a
// duplication of the Predictor's own smoothing formula.
export function detectAboveBaseline(facts: SinglesFormFacts): StoryCandidate | null {
  if (facts.recentResultsNewestFirst.length < ABOVE_BASELINE_MIN_GAMES) return null;

  const recentRate = winRate(facts.recentResultsNewestFirst);
  const delta = recentRate - facts.seasonRate;
  if (delta < ABOVE_BASELINE_MATERIAL_DELTA) return null;

  return {
    storyType: "ABOVE_BASELINE",
    leagueType: "singles",
    subjectKeys: subjects(facts.playerId),
    sentiment: "positive",
    tags: ["above_baseline"],
    facts: { playerId: facts.playerId, recentRate, seasonRate: facts.seasonRate },
    components: {
      competitiveImportance: SCORE_MAX.competitiveImportance * 0.15,
      unexpectedness: 0,
      historicalSignificance: 0,
      performanceAnomaly: SCORE_MAX.performanceAnomaly * Math.min(delta / 0.4, 1),
      entertainmentValue: 2,
    },
  };
}

export const FORM_DETECTORS = [
  detectWinStreak,
  detectLossStreak,
  detectFormReversal,
  detectQuietClimber,
  detectFreefall,
  detectAboveBaseline,
] as const satisfies readonly ((facts: SinglesFormFacts) => StoryCandidate | null)[];

export function detectFormStories(facts: SinglesFormFacts): StoryCandidate[] {
  return FORM_DETECTORS.map(detector => detector(facts)).filter((c): c is StoryCandidate => c !== null);
}
