// TKDL LIVE — Story Engine: RESULT family detectors (handover doc Appendix
// A / section 9.4). Singles-only by design — see story-types.ts's own
// header for why Doubles/Shift Wars get their own team-shaped families
// instead of reusing these.
//
// Every detector here is a pure function of a single match's already-
// gathered facts (SinglesResultMatchFacts below) to a StoryCandidate or
// null — no DB access, unit tested directly. Assembling those facts (H2H
// lookups, the pre-match Predictor call, who held the points lead) is
// story-engine.ts's job, reusing history-reconstruction.ts/
// match-predictor.ts exactly the way title-predictor.ts already does.
//
// `import type` only from DB-facing modules (history-reconstruction.ts) —
// erased before module resolution, so this file stays runnable by `node
// --test` directly like every other pure file in this folder.
import type { SinglesPlayerState } from "./timeline-replay";
import type { H2HRecord } from "./history-reconstruction";
// Extensioned import: this file is loaded directly by Node's native test
// runner, which requires explicit extensions on relative ESM specifiers for
// a real (non-type-only) import — the bundler used for the real build
// resolves either form fine. See timeline-replay.ts's own header for the
// same gotcha hit earlier in this codebase.
import {
  SCORE_MAX,
  unexpectednessComponent,
  subjectKey,
} from "./story-engine-math.ts";
import type { StoryCandidate } from "./story-types.ts";

export type SinglesResultMatchFacts = {
  matchId: number;
  playedAt: Date;
  winnerId: number;
  loserId: number;
  stake: number;
  winnerBefore: SinglesPlayerState;
  winnerAfter?: SinglesPlayerState;
  loserBefore: SinglesPlayerState;
  loserAfter: SinglesPlayerState;
  /** Pre-match probability of the actual winner winning (0..1), from predictSinglesMatch's pA with playerAId = winnerId. */
  winnerProbability: number;
  /** buildH2HBefore(winnerId, loserId, playedAt) — "a" side is this match's winner, so aWins is the winner's prior wins over this specific opponent. */
  h2hBeforeMatch: H2HRecord;
  /** True if the loser held the outright points lead among active players immediately before this match (story-engine.ts's own "who's leading" computation, from the same timeline this match came from). */
  wasLoserLeaderBefore: boolean;
  /** story-engine-math.ts's highStakeThreshold(), computed once per league per Edition from that league's LeagueActivityProfile.positiveStakes. */
  highStakeThreshold: number;
  /** 0 at the start of the calendar month, 1 at its end (title-predictor-math.ts's daysRemainingInMonth, inverted) — competitiveImportance reads "stronger late in month" per 9.2. */
  monthProgress: number;
};

// ── shared competitive-importance helper ─────────────────────────────────
// All eleven RESULT types share the same underlying "how much did this
// result actually matter" question (9.2: "Points/title/elimination
// consequence; stronger late in month") — a stake-size component (how
// large a wager changed hands, relative to this league's own high-stake
// bar), an elimination bonus (a knockout is the single most consequential
// outcome a match can have), a leader-beaten bonus, and a late-month
// multiplier. HIGH_STAKE_WIN/HIGH_STAKE_LOSS/ELIMINATION/LEADER_BEATEN
// don't need a SEPARATE formula — their own trigger condition already
// guarantees one of these components is near its max, which is exactly
// the outcome you'd want from a shared formula rather than a coincidence
// to work around.
function singlesResultConsequence(facts: {
  stake: number;
  highStakeThreshold: number;
  loserEliminatedThisMatch: boolean;
  wasLoserLeaderBefore: boolean;
  monthProgress: number;
}): number {
  const stakeFraction = facts.highStakeThreshold > 0
    ? Math.min(facts.stake / facts.highStakeThreshold, 1)
    : 0;

  const base =
    SCORE_MAX.competitiveImportance * 0.35 * stakeFraction +
    (facts.loserEliminatedThisMatch ? SCORE_MAX.competitiveImportance * 0.35 : 0) +
    (facts.wasLoserLeaderBefore ? SCORE_MAX.competitiveImportance * 0.20 : 0);

  const lateMonthMultiplier = 1 + 0.10 * Math.max(0, Math.min(1, facts.monthProgress));
  return Math.min(base * lateMonthMultiplier, SCORE_MAX.competitiveImportance);
}

function loserEliminatedThisMatch(facts: SinglesResultMatchFacts): boolean {
  return facts.loserAfter.isEliminated && !facts.loserBefore.isEliminated;
}

function baseComponents(facts: SinglesResultMatchFacts) {
  return {
    competitiveImportance: singlesResultConsequence({
      stake: facts.stake,
      highStakeThreshold: facts.highStakeThreshold,
      loserEliminatedThisMatch: loserEliminatedThisMatch(facts),
      wasLoserLeaderBefore: facts.wasLoserLeaderBefore,
      monthProgress: facts.monthProgress,
    }),
    unexpectedness: unexpectednessComponent(facts.winnerProbability),
    // Owned by the PERFORMANCE family (deviation from a darts-performance
    // baseline) — a RESULT story doesn't independently claim one; 9.6's
    // story merging is what lets a genuine performance anomaly ride along
    // as a supporting fact on the same anchor match.
    performanceAnomaly: 0,
  };
}

function subjects(facts: SinglesResultMatchFacts): string[] {
  return [subjectKey("singles", facts.winnerId), subjectKey("singles", facts.loserId)];
}

function matchIdentityFacts(facts: SinglesResultMatchFacts) {
  return { matchId: facts.matchId, playedAt: facts.playedAt.toISOString() };
}

/** Every completed match is news, even when none of the exceptional-result
 * detectors below fires. Kept deliberately low-scoring so a genuine upset,
 * elimination or milestone remains the primary narrative for the match. */
export function detectMatchResult(facts: SinglesResultMatchFacts): StoryCandidate {
  return {
    storyType: "MATCH_RESULT",
    leagueType: "singles",
    subjectKeys: subjects(facts),
    anchorMatchId: facts.matchId,
    sentiment: "neutral",
    tags: ["result", "baseline"],
    facts: {
      resultKind: "singles",
      ...matchIdentityFacts(facts),
      winnerId: facts.winnerId,
      loserId: facts.loserId,
      stake: facts.stake,
      winnerPointsBefore: facts.winnerBefore.points,
      winnerPointsAfter: facts.winnerAfter?.points ?? facts.winnerBefore.points + facts.stake,
      loserPointsBefore: facts.loserBefore.points,
      loserPointsAfter: facts.loserAfter.points,
    },
    components: {
      competitiveImportance: Math.min(6, Math.max(1, facts.stake)),
      unexpectedness: 0,
      historicalSignificance: 0,
      performanceAnomaly: 0,
      entertainmentValue: 1,
    },
  };
}

// ── UPSET / MAJOR_UPSET / MODEL_SHOCK ────────────────────────────────────
// Three severity tiers of the SAME underlying fact (how unlikely the
// actual winner was), not three independent triggers — a 10%-probability
// winner is a MODEL_SHOCK, not a MODEL_SHOCK *and* a MAJOR_UPSET *and* an
// UPSET all at once, which would just be the same event triple-counted.
// This picks the single most severe applicable tier, mirroring how the
// doc presents the three thresholds together as a ladder (9.4) rather
// than as unrelated boolean checks.
export function detectUpsetTier(facts: SinglesResultMatchFacts): StoryCandidate | null {
  const p = facts.winnerProbability;
  let storyType: "MODEL_SHOCK" | "MAJOR_UPSET" | "UPSET";
  if (p < 0.15) storyType = "MODEL_SHOCK";
  else if (p < 0.25) storyType = "MAJOR_UPSET";
  else if (p < 0.40) storyType = "UPSET";
  else return null;

  const historicalSignificance = Math.min(facts.h2hBeforeMatch.gamesPlayed / 10, 1) * (SCORE_MAX.historicalSignificance * 0.4);
  const entertainmentValue = storyType === "MODEL_SHOCK" ? 5 : storyType === "MAJOR_UPSET" ? 4 : 3;

  return {
    storyType,
    leagueType: "singles",
    subjectKeys: subjects(facts),
    anchorMatchId: facts.matchId,
    sentiment: "positive",
    tags: ["upset"],
    facts: {
      ...matchIdentityFacts(facts), winnerId: facts.winnerId, loserId: facts.loserId,
      winnerProbability: facts.winnerProbability, stake: facts.stake,
    },
    components: { ...baseComponents(facts), historicalSignificance, entertainmentValue },
  };
}

// ── HIGH_STAKE_WIN ────────────────────────────────────────────────────────
export function detectHighStakeWin(facts: SinglesResultMatchFacts): StoryCandidate | null {
  if (facts.stake < facts.highStakeThreshold) return null;

  return {
    storyType: "HIGH_STAKE_WIN",
    leagueType: "singles",
    subjectKeys: subjects(facts),
    anchorMatchId: facts.matchId,
    sentiment: "positive",
    tags: ["high_stake"],
    facts: {
      ...matchIdentityFacts(facts), winnerId: facts.winnerId, loserId: facts.loserId,
      stake: facts.stake, highStakeThreshold: facts.highStakeThreshold,
    },
    components: { ...baseComponents(facts), historicalSignificance: 0, entertainmentValue: 3 },
  };
}

// ── HIGH_STAKE_LOSS ───────────────────────────────────────────────────────
// "Contender loses high stake" (Appendix A) — this file's own reading of
// "contender" is a player not yet eliminated by this loss (a genuinely
// live entity in the season, as opposed to someone already knocked out
// taking on a token match) and not already effectively out of the running.
// Since v1 has no separate "title contention" fact wired into this input,
// "not eliminated by this result" is the concrete, checkable proxy used
// here — flagged as a judgment call, not a doc transcription.
export function detectHighStakeLoss(facts: SinglesResultMatchFacts): StoryCandidate | null {
  if (facts.stake < facts.highStakeThreshold) return null;
  if (loserEliminatedThisMatch(facts)) return null; // that's ELIMINATION's story, not this one

  return {
    storyType: "HIGH_STAKE_LOSS",
    leagueType: "singles",
    subjectKeys: subjects(facts),
    anchorMatchId: facts.matchId,
    sentiment: "negative",
    tags: ["high_stake"],
    facts: {
      ...matchIdentityFacts(facts), winnerId: facts.winnerId, loserId: facts.loserId,
      stake: facts.stake, highStakeThreshold: facts.highStakeThreshold,
    },
    components: { ...baseComponents(facts), historicalSignificance: 0, entertainmentValue: 2 },
  };
}

// ── ELIMINATION ───────────────────────────────────────────────────────────
export function detectElimination(facts: SinglesResultMatchFacts): StoryCandidate | null {
  if (!loserEliminatedThisMatch(facts)) return null;

  return {
    storyType: "ELIMINATION",
    leagueType: "singles",
    subjectKeys: subjects(facts),
    anchorMatchId: facts.matchId,
    sentiment: "negative",
    tags: ["elimination"],
    facts: {
      ...matchIdentityFacts(facts), winnerId: facts.winnerId, loserId: facts.loserId,
      stake: facts.stake,
    },
    components: { ...baseComponents(facts), historicalSignificance: 0, entertainmentValue: 2 },
  };
}

// ── LEADER_BEATEN ─────────────────────────────────────────────────────────
export function detectLeaderBeaten(facts: SinglesResultMatchFacts): StoryCandidate | null {
  if (!facts.wasLoserLeaderBefore) return null;

  return {
    storyType: "LEADER_BEATEN",
    leagueType: "singles",
    subjectKeys: subjects(facts),
    anchorMatchId: facts.matchId,
    sentiment: "positive",
    tags: ["leader_beaten"],
    facts: {
      ...matchIdentityFacts(facts), winnerId: facts.winnerId, loserId: facts.loserId,
      leaderPointsBefore: facts.loserBefore.points, stake: facts.stake,
    },
    components: { ...baseComponents(facts), historicalSignificance: SCORE_MAX.historicalSignificance * 0.3, entertainmentValue: 3 },
  };
}

// ── STREAK_BREAKER ────────────────────────────────────────────────────────
const STREAK_BREAKER_MIN_LENGTH = 4;

export function detectStreakBreaker(facts: SinglesResultMatchFacts): StoryCandidate | null {
  const brokenStreak = facts.loserBefore.currentWinStreak;
  if (brokenStreak < STREAK_BREAKER_MIN_LENGTH) return null;

  // Longer streak broken -> more historically significant, capped so an
  // extreme outlier streak doesn't blow past the component's own max.
  const historicalSignificance = Math.min(brokenStreak / 10, 1) * SCORE_MAX.historicalSignificance;

  return {
    storyType: "STREAK_BREAKER",
    leagueType: "singles",
    subjectKeys: subjects(facts),
    anchorMatchId: facts.matchId,
    sentiment: "positive",
    tags: ["streak_breaker"],
    facts: {
      ...matchIdentityFacts(facts), winnerId: facts.winnerId, loserId: facts.loserId,
      brokenWinStreak: brokenStreak, stake: facts.stake,
    },
    components: { ...baseComponents(facts), historicalSignificance, entertainmentValue: 3 },
  };
}

// ── DROUGHT_ENDED ─────────────────────────────────────────────────────────
const DROUGHT_ENDED_MIN_LENGTH = 3;

export function detectDroughtEnded(facts: SinglesResultMatchFacts): StoryCandidate | null {
  const endedStreak = facts.winnerBefore.currentLossStreak;
  if (endedStreak < DROUGHT_ENDED_MIN_LENGTH) return null;

  const historicalSignificance = Math.min(endedStreak / 10, 1) * SCORE_MAX.historicalSignificance;

  return {
    storyType: "DROUGHT_ENDED",
    leagueType: "singles",
    subjectKeys: subjects(facts),
    anchorMatchId: facts.matchId,
    sentiment: "positive",
    tags: ["drought_ended"],
    facts: {
      ...matchIdentityFacts(facts), winnerId: facts.winnerId, loserId: facts.loserId,
      endedLossStreak: endedStreak, stake: facts.stake,
    },
    components: { ...baseComponents(facts), historicalSignificance, entertainmentValue: 3 },
  };
}

// ── FIRST_H2H_WIN ─────────────────────────────────────────────────────────
const FIRST_H2H_WIN_MIN_PRIOR_LOSSES = 3;

export function detectFirstH2HWin(facts: SinglesResultMatchFacts): StoryCandidate | null {
  const { aWins: winnerPriorWins, bWins: loserPriorWins } = facts.h2hBeforeMatch;
  if (winnerPriorWins !== 0) return null;
  if (loserPriorWins < FIRST_H2H_WIN_MIN_PRIOR_LOSSES) return null;

  const historicalSignificance = Math.min(loserPriorWins / 8, 1) * SCORE_MAX.historicalSignificance;

  return {
    storyType: "FIRST_H2H_WIN",
    leagueType: "singles",
    subjectKeys: subjects(facts),
    anchorMatchId: facts.matchId,
    sentiment: "positive",
    tags: ["first_h2h_win"],
    facts: {
      ...matchIdentityFacts(facts), winnerId: facts.winnerId, loserId: facts.loserId,
      priorLossesToThisOpponent: loserPriorWins, stake: facts.stake,
    },
    components: { ...baseComponents(facts), historicalSignificance, entertainmentValue: 4 },
  };
}

// ── REVENGE ───────────────────────────────────────────────────────────────
// "Reverses previous meeting; stronger if repeated losses" — the most
// recent meeting (h2hBeforeMatch.recentMeetings[0], already sorted newest
// first and strictly before this match) must have been won by today's
// LOSER for today's win to read as a reversal. "Stronger if repeated
// losses" scales historicalSignificance by how many of the most recent
// consecutive meetings (capped at the 10 recentMeetings actually holds)
// were also won by today's loser — a reversal after five straight losses
// reads as a much bigger moment than a reversal after just one.
export function detectRevenge(facts: SinglesResultMatchFacts): StoryCandidate | null {
  const meetings = facts.h2hBeforeMatch.recentMeetings;
  if (meetings.length === 0) return null;
  if (meetings[0].winnerId !== facts.loserId) return null;

  let consecutivePriorLosses = 0;
  for (const meeting of meetings) {
    if (meeting.winnerId === facts.loserId) consecutivePriorLosses++;
    else break;
  }

  const historicalSignificance = Math.min(consecutivePriorLosses / 5, 1) * SCORE_MAX.historicalSignificance;

  return {
    storyType: "REVENGE",
    leagueType: "singles",
    subjectKeys: subjects(facts),
    anchorMatchId: facts.matchId,
    sentiment: "positive",
    tags: ["revenge"],
    facts: {
      ...matchIdentityFacts(facts), winnerId: facts.winnerId, loserId: facts.loserId,
      consecutivePriorLosses, stake: facts.stake,
    },
    components: { ...baseComponents(facts), historicalSignificance, entertainmentValue: 4 },
  };
}

// ── all RESULT detectors, run together per match ─────────────────────────
export const RESULT_DETECTORS = [
  detectUpsetTier,
  detectHighStakeWin,
  detectHighStakeLoss,
  detectElimination,
  detectLeaderBeaten,
  detectStreakBreaker,
  detectDroughtEnded,
  detectFirstH2HWin,
  detectRevenge,
] as const satisfies readonly ((facts: SinglesResultMatchFacts) => StoryCandidate | null)[];

export function detectResultStories(facts: SinglesResultMatchFacts): StoryCandidate[] {
  return [
    detectMatchResult(facts),
    ...RESULT_DETECTORS.map(detector => detector(facts)).filter((c): c is StoryCandidate => c !== null),
  ];
}
