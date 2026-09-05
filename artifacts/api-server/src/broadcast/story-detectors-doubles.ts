// TKDL LIVE — Story Engine: DOUBLES family detectors (handover doc
// Appendix A). Doubles-only team equivalents of ideas Singles already
// covers under other families — PAIR_UPSET mirrors RESULT's UPSET,
// PAIR_ELIMINATED mirrors RESULT's ELIMINATION, UNBEATEN_PAIR mirrors
// FORM's WIN_STREAK, PAIR_SURGE mirrors FORM's QUIET_CLIMBER — using
// team-history-reconstruction.ts's TeamState (wins/losses/streaks/
// recentForm/isEliminated) instead of Singles' SinglesPlayerState.
//
// Genuinely two different shapes in this one small family, unlike every
// other family in this folder: PAIR_UPSET/PAIR_ELIMINATED are MATCH-
// anchored (one specific result), while UNBEATEN_PAIR/PAIR_SURGE are
// SUBJECT-anchored (an ongoing state about one team, re-detected after
// each of their matches) — so this file exposes two separate detector
// groups and two separate aggregator entry points rather than forcing
// both into one shared facts shape.
import type { TeamState } from "./team-timeline-replay";
import { SCORE_MAX, unexpectednessComponent, subjectKey } from "./story-engine-math.ts";
import type { StoryCandidate } from "./story-types.ts";

// ── PAIR_UPSET / PAIR_ELIMINATED (match-anchored) ─────────────────────────

export type DoublesMatchResultFacts = {
  matchId: number;
  playedAt: Date;
  winnerTeamId: number;
  loserTeamId: number;
  loserBefore: TeamState;
  loserAfter: TeamState;
  /** Pre-match probability of the actual winner (0..1), from predictDoublesMatch's pA with teamAId = winnerTeamId. */
  winnerProbability: number;
};

function matchSubjects(facts: DoublesMatchResultFacts): string[] {
  return [subjectKey("doubles", facts.winnerTeamId), subjectKey("doubles", facts.loserTeamId)];
}

// No MAJOR/MODEL-severity ladder here — Appendix A gives Doubles a single
// PAIR_UPSET type (unlike Singles' three-tier UPSET/MAJOR_UPSET/
// MODEL_SHOCK), so this reuses RESULT's own UPSET threshold (<40%) as
// PAIR_UPSET's sole bar.
const PAIR_UPSET_THRESHOLD = 0.40;

export function detectPairUpset(facts: DoublesMatchResultFacts): StoryCandidate | null {
  if (facts.winnerProbability >= PAIR_UPSET_THRESHOLD) return null;

  return {
    storyType: "PAIR_UPSET",
    leagueType: "doubles",
    subjectKeys: matchSubjects(facts),
    anchorMatchId: facts.matchId,
    sentiment: "positive",
    tags: ["pair_upset"],
    facts: { matchId: facts.matchId, playedAt: facts.playedAt.toISOString(), winnerTeamId: facts.winnerTeamId, loserTeamId: facts.loserTeamId, winnerProbability: facts.winnerProbability },
    components: {
      competitiveImportance: 10,
      unexpectedness: unexpectednessComponent(facts.winnerProbability),
      historicalSignificance: 4,
      performanceAnomaly: 0,
      entertainmentValue: 4,
    },
  };
}

export function detectPairEliminated(facts: DoublesMatchResultFacts): StoryCandidate | null {
  const justEliminated = facts.loserAfter.isEliminated && !facts.loserBefore.isEliminated;
  if (!justEliminated) return null;

  return {
    storyType: "PAIR_ELIMINATED",
    leagueType: "doubles",
    subjectKeys: matchSubjects(facts),
    anchorMatchId: facts.matchId,
    sentiment: "negative",
    tags: ["pair_eliminated"],
    facts: { matchId: facts.matchId, playedAt: facts.playedAt.toISOString(), winnerTeamId: facts.winnerTeamId, loserTeamId: facts.loserTeamId },
    components: {
      competitiveImportance: 18,
      unexpectedness: 0,
      historicalSignificance: 6,
      performanceAnomaly: 0,
      entertainmentValue: 2,
    },
  };
}

export const DOUBLES_MATCH_DETECTORS = [
  detectPairUpset,
  detectPairEliminated,
] as const satisfies readonly ((facts: DoublesMatchResultFacts) => StoryCandidate | null)[];

export function detectDoublesMatchStories(facts: DoublesMatchResultFacts): StoryCandidate[] {
  return DOUBLES_MATCH_DETECTORS.map(detector => detector(facts)).filter((c): c is StoryCandidate => c !== null);
}

// ── UNBEATEN_PAIR / PAIR_SURGE (subject-anchored) ─────────────────────────

export type DoublesTeamFormFacts = {
  teamId: number;
  state: TeamState;
  /** This team's standings position exactly `matches` of their OWN matches ago, or null if they haven't played that many yet — same shape as FORM's own positionWindow. */
  positionWindow: { matches: number; positionBefore: number } | null;
  currentPosition: number | null;
};

function formSubjects(teamId: number): string[] {
  return [subjectKey("doubles", teamId)];
}

const UNBEATEN_PAIR_MIN_MATCHES = 3;
const PAIR_SURGE_MIN_WIN_STREAK = 3;
const PAIR_SURGE_POSITION_MOVE_MIN = 2;
const PAIR_SURGE_POSITION_WINDOW_MIN_MATCHES = 3;

// ── UNBEATEN_PAIR (Appendix A: current drawn team unbeaten with >=3 matches) ─
export function detectUnbeatenPair(facts: DoublesTeamFormFacts): StoryCandidate | null {
  const { wins, losses } = facts.state;
  if (losses > 0) return null;
  if (wins < UNBEATEN_PAIR_MIN_MATCHES) return null;

  return {
    storyType: "UNBEATEN_PAIR",
    leagueType: "doubles",
    subjectKeys: formSubjects(facts.teamId),
    sentiment: "positive",
    tags: ["unbeaten_pair"],
    facts: { teamId: facts.teamId, wins },
    components: {
      competitiveImportance: 8,
      unexpectedness: 0,
      historicalSignificance: Math.min(wins / 10, 1) * SCORE_MAX.historicalSignificance,
      performanceAnomaly: 0,
      entertainmentValue: 4,
    },
  };
}

// ── PAIR_SURGE (Appendix A: strong recent team form OR table move) ───────
export function detectPairSurge(facts: DoublesTeamFormFacts): StoryCandidate | null {
  const strongForm = facts.state.currentWinStreak >= PAIR_SURGE_MIN_WIN_STREAK;

  const tableMove =
    facts.positionWindow !== null &&
    facts.currentPosition !== null &&
    facts.positionWindow.matches >= PAIR_SURGE_POSITION_WINDOW_MIN_MATCHES &&
    facts.positionWindow.positionBefore - facts.currentPosition >= PAIR_SURGE_POSITION_MOVE_MIN;

  if (!strongForm && !tableMove) return null;

  return {
    storyType: "PAIR_SURGE",
    leagueType: "doubles",
    subjectKeys: formSubjects(facts.teamId),
    sentiment: "positive",
    tags: ["pair_surge"],
    facts: {
      teamId: facts.teamId, currentWinStreak: facts.state.currentWinStreak,
      positionBefore: facts.positionWindow?.positionBefore ?? null, currentPosition: facts.currentPosition,
    },
    components: {
      competitiveImportance: 10,
      unexpectedness: 0,
      historicalSignificance: 0,
      performanceAnomaly: 0,
      entertainmentValue: 3,
    },
  };
}

export const DOUBLES_FORM_DETECTORS = [
  detectUnbeatenPair,
  detectPairSurge,
] as const satisfies readonly ((facts: DoublesTeamFormFacts) => StoryCandidate | null)[];

export function detectDoublesFormStories(facts: DoublesTeamFormFacts): StoryCandidate[] {
  return DOUBLES_FORM_DETECTORS.map(detector => detector(facts)).filter((c): c is StoryCandidate => c !== null);
}
