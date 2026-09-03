// TKDL LIVE — Story Engine: MILESTONE family detectors (handover doc
// Appendix A / section 9.4). Singles-only, same reasoning as
// story-detectors-result.ts's own header. Match-anchored — a milestone is
// reached in a specific match, the moment a career counter crosses a
// threshold.
//
// Appendix A gives CAREER_MATCH_MILESTONE an EXAMPLE ("e.g. 25/50/100")
// but no doc-specified number set for wins/180s/eliminations, and Appendix
// B's own config table has no milestone-threshold keys at all — so every
// threshold array below is this file's own reasonable extrapolation from
// that one example, not a doc transcription. 180_MILESTONE/
// ELIMINATION_MILESTONE are explicitly conditional in the doc itself
// ("only if reliable historical totals can be derived" / "only if existing
// counter supports claim") — story-engine.ts is expected to pass null for
// either counter when it can't stand behind the number, and this file
// simply never fires without one.
import { subjectKey } from "./story-engine-math.ts";
import type { StoryCandidate } from "./story-types.ts";

export type SinglesMilestoneFacts = {
  playerId: number;
  matchId: number;
  won: boolean;
  /** This player's total career matches played, AFTER this match. */
  careerGamesPlayedAfter: number;
  /** This player's total career wins, AFTER this match. */
  careerWinsAfter: number;
  /** This player's total career 180s thrown, AFTER this match — null if reliable historical totals can't be derived (Appendix A's own condition). */
  career180sAfter: number | null;
  /** 180s thrown in just this match — display context only, not the trigger itself. */
  matchThrown180s: number;
  /** This player's total career eliminations, AFTER this match — null if the existing counter doesn't reliably support the claim (Appendix A's own condition). */
  careerEliminationsAfter: number | null;
  justEliminatedThisMatch: boolean;
};

// This file's own extrapolation from Appendix A's "e.g. 25/50/100" example
// — no doc-given numbers exist for anything beyond CAREER_MATCH_MILESTONE.
const CAREER_MATCH_THRESHOLDS = [25, 50, 100, 150, 200, 250];
const CAREER_WIN_THRESHOLDS = [10, 25, 50, 100, 150];
const CAREER_180_THRESHOLDS = [10, 25, 50, 100];
const CAREER_ELIMINATION_THRESHOLDS = [3, 5, 10, 15];

function subjects(playerId: number): string[] {
  return [subjectKey("singles", playerId)];
}

function milestoneComponents(justCrossed: boolean) {
  return {
    competitiveImportance: 2,
    unexpectedness: 0,
    historicalSignificance: justCrossed ? 10 : 0,
    performanceAnomaly: 0,
    entertainmentValue: 3,
  };
}

// ── CAREER_MATCH_MILESTONE ────────────────────────────────────────────────
export function detectCareerMatchMilestone(facts: SinglesMilestoneFacts): StoryCandidate | null {
  if (!CAREER_MATCH_THRESHOLDS.includes(facts.careerGamesPlayedAfter)) return null;

  return {
    storyType: "CAREER_MATCH_MILESTONE",
    leagueType: "singles",
    subjectKeys: subjects(facts.playerId),
    anchorMatchId: facts.matchId,
    sentiment: "positive",
    tags: ["career_match_milestone"],
    facts: { playerId: facts.playerId, careerGamesPlayed: facts.careerGamesPlayedAfter },
    components: milestoneComponents(true),
  };
}

// ── CAREER_WIN_MILESTONE ──────────────────────────────────────────────────
export function detectCareerWinMilestone(facts: SinglesMilestoneFacts): StoryCandidate | null {
  if (!facts.won) return null; // a win milestone can only be crossed BY winning
  if (!CAREER_WIN_THRESHOLDS.includes(facts.careerWinsAfter)) return null;

  return {
    storyType: "CAREER_WIN_MILESTONE",
    leagueType: "singles",
    subjectKeys: subjects(facts.playerId),
    anchorMatchId: facts.matchId,
    sentiment: "positive",
    tags: ["career_win_milestone"],
    facts: { playerId: facts.playerId, careerWins: facts.careerWinsAfter },
    components: milestoneComponents(true),
  };
}

// ── 180_MILESTONE (Appendix A: only if reliable historical totals can be derived) ─
export function detect180Milestone(facts: SinglesMilestoneFacts): StoryCandidate | null {
  if (facts.career180sAfter === null) return null;
  if (!CAREER_180_THRESHOLDS.includes(facts.career180sAfter)) return null;

  return {
    storyType: "180_MILESTONE",
    leagueType: "singles",
    subjectKeys: subjects(facts.playerId),
    anchorMatchId: facts.matchId,
    sentiment: "positive",
    tags: ["180_milestone"],
    facts: { playerId: facts.playerId, career180s: facts.career180sAfter, matchThrown180s: facts.matchThrown180s },
    components: milestoneComponents(true),
  };
}

// ── ELIMINATION_MILESTONE (Appendix A: only if existing counter supports claim) ─
export function detectEliminationMilestone(facts: SinglesMilestoneFacts): StoryCandidate | null {
  if (!facts.justEliminatedThisMatch) return null;
  if (facts.careerEliminationsAfter === null) return null;
  if (!CAREER_ELIMINATION_THRESHOLDS.includes(facts.careerEliminationsAfter)) return null;

  return {
    storyType: "ELIMINATION_MILESTONE",
    leagueType: "singles",
    subjectKeys: subjects(facts.playerId),
    anchorMatchId: facts.matchId,
    sentiment: "neutral", // a running-joke milestone, not a straightforwardly happy one — commentary tone is a later phase's call
    tags: ["elimination_milestone", "cooldown_sensitive"],
    facts: { playerId: facts.playerId, careerEliminations: facts.careerEliminationsAfter },
    components: { ...milestoneComponents(true), entertainmentValue: 2 },
  };
}

export const MILESTONE_DETECTORS = [
  detectCareerMatchMilestone,
  detectCareerWinMilestone,
  detect180Milestone,
  detectEliminationMilestone,
] as const satisfies readonly ((facts: SinglesMilestoneFacts) => StoryCandidate | null)[];

export function detectMilestoneStories(facts: SinglesMilestoneFacts): StoryCandidate[] {
  return MILESTONE_DETECTORS.map(detector => detector(facts)).filter((c): c is StoryCandidate => c !== null);
}
