// TKDL LIVE — Story Engine: H2H family detectors (handover doc Appendix A
// / section 9.4). Singles-only, same reasoning as the other
// story-detectors-*.ts files. Subject-anchored on BOTH players in the
// pair — a rivalry is a fact about the two of them together, not either
// one alone — using story-engine-math.ts's subjectAnchoredStoryKey() with
// both subject keys (sorted, so re-detection resolves to the same row
// regardless of which player's "side" a caller happened to pass first).
//
// Every detector here operates on the FULL career head-to-head record as
// of the detection cutoff (buildH2HBefore(playerA, playerB, now) — same
// shape match-predictor.ts and story-detectors-result.ts already use, just
// called with "now" instead of a specific match's playedAt), not a single
// match — story-engine.ts is expected to run these once per pair who have
// actually met, not once per match.
import { subjectKey } from "./story-engine-math.ts";
import type { StoryCandidate } from "./story-types.ts";

export type SinglesH2HFacts = {
  playerAId: number;
  playerBId: number;
  aWins: number;
  bWins: number;
  gamesPlayed: number;
  /** Newest first, capped at 10 — H2HRecord.recentMeetings as-is. */
  recentMeetings: { matchId: number; playedAt: Date; winnerId: number; stake: number }[];
};

function subjects(facts: SinglesH2HFacts): string[] {
  return [subjectKey("singles", facts.playerAId), subjectKey("singles", facts.playerBId)];
}

// ── H2H_DOMINANCE (9.4: >=4 meetings and >=75% wins) ──────────────────────
const H2H_DOMINANCE_MIN_MEETINGS = 4;
const H2H_DOMINANCE_MIN_SHARE = 0.75;

export function detectH2HDominance(facts: SinglesH2HFacts): StoryCandidate | null {
  if (facts.gamesPlayed < H2H_DOMINANCE_MIN_MEETINGS) return null;

  const [dominantId, dominantWins, dominatedId] =
    facts.aWins >= facts.bWins
      ? [facts.playerAId, facts.aWins, facts.playerBId]
      : [facts.playerBId, facts.bWins, facts.playerAId];

  const share = dominantWins / facts.gamesPlayed;
  if (share < H2H_DOMINANCE_MIN_SHARE) return null;

  return {
    storyType: "H2H_DOMINANCE",
    leagueType: "singles",
    subjectKeys: subjects(facts),
    sentiment: "positive",
    tags: ["h2h_dominance"],
    facts: { dominantPlayerId: dominantId, dominatedPlayerId: dominatedId, wins: dominantWins, gamesPlayed: facts.gamesPlayed, share },
    components: {
      competitiveImportance: 5,
      unexpectedness: 0,
      historicalSignificance: Math.min(facts.gamesPlayed / 10, 1) * 12,
      performanceAnomaly: 0,
      entertainmentValue: 3,
    },
  };
}

// ── RIVALRY (9.4: >=5 meetings, neither side above 70% career share) ─────
const RIVALRY_MIN_MEETINGS = 5;
const RIVALRY_MAX_SHARE = 0.70;

export function detectRivalry(facts: SinglesH2HFacts): StoryCandidate | null {
  if (facts.gamesPlayed < RIVALRY_MIN_MEETINGS) return null;

  const topShare = Math.max(facts.aWins, facts.bWins) / facts.gamesPlayed;
  if (topShare > RIVALRY_MAX_SHARE) return null;

  return {
    storyType: "RIVALRY",
    leagueType: "singles",
    subjectKeys: subjects(facts),
    sentiment: "neutral",
    tags: ["rivalry"],
    facts: { playerAId: facts.playerAId, playerBId: facts.playerBId, aWins: facts.aWins, bWins: facts.bWins, gamesPlayed: facts.gamesPlayed },
    components: {
      competitiveImportance: 6,
      unexpectedness: 0,
      historicalSignificance: Math.min(facts.gamesPlayed / 10, 1) * 13,
      performanceAnomaly: 0,
      entertainmentValue: 4,
    },
  };
}

// ── RIVALRY_SWING (Appendix A: recent H2H reverses longer-term direction) ─
const RIVALRY_SWING_MIN_CAREER_MEETINGS = 5;
const RIVALRY_SWING_RECENT_WINDOW = 5;
const RIVALRY_SWING_MIN_RECENT_MEETINGS = 3;

function leaderOf(aWins: number, bWins: number, playerAId: number, playerBId: number): number | null {
  if (aWins === bWins) return null; // tied, no clear leader either way
  return aWins > bWins ? playerAId : playerBId;
}

export function detectRivalrySwing(facts: SinglesH2HFacts): StoryCandidate | null {
  if (facts.gamesPlayed < RIVALRY_SWING_MIN_CAREER_MEETINGS) return null;

  const careerLeader = leaderOf(facts.aWins, facts.bWins, facts.playerAId, facts.playerBId);
  if (careerLeader === null) return null;

  const recentWindow = facts.recentMeetings.slice(0, RIVALRY_SWING_RECENT_WINDOW);
  if (recentWindow.length < RIVALRY_SWING_MIN_RECENT_MEETINGS) return null;

  let recentAWins = 0, recentBWins = 0;
  for (const meeting of recentWindow) {
    if (meeting.winnerId === facts.playerAId) recentAWins++;
    else if (meeting.winnerId === facts.playerBId) recentBWins++;
  }
  const recentLeader = leaderOf(recentAWins, recentBWins, facts.playerAId, facts.playerBId);
  if (recentLeader === null || recentLeader === careerLeader) return null;

  return {
    storyType: "RIVALRY_SWING",
    leagueType: "singles",
    subjectKeys: subjects(facts),
    sentiment: "neutral",
    tags: ["rivalry_swing"],
    facts: {
      careerLeaderPlayerId: careerLeader, recentLeaderPlayerId: recentLeader,
      recentWindowSize: recentWindow.length, aWins: facts.aWins, bWins: facts.bWins,
    },
    components: {
      competitiveImportance: 6,
      unexpectedness: 0,
      historicalSignificance: 10,
      performanceAnomaly: 0,
      entertainmentValue: 4,
    },
  };
}

export const H2H_DETECTORS = [
  detectH2HDominance,
  detectRivalry,
  detectRivalrySwing,
] as const satisfies readonly ((facts: SinglesH2HFacts) => StoryCandidate | null)[];

export function detectH2HStories(facts: SinglesH2HFacts): StoryCandidate[] {
  return H2H_DETECTORS.map(detector => detector(facts)).filter((c): c is StoryCandidate => c !== null);
}
