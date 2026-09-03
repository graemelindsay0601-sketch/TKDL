// TKDL LIVE — Story Engine: ARCHIVE family detectors (handover doc
// Appendix A): LAST_MEETING, HISTORICAL_H2H, SEASON_COMPARISON. Cross-
// league, like LEAGUE — retrospective context is meaningful for Singles
// pairs and Shift Wars departments (fixed entities that recur across
// seasons) alike; Doubles pairs are redrawn every season (see
// team-history-reconstruction.ts's own header), so an orchestrator only
// has real H2H/season-comparison history to offer there within a single
// season, not across one — these detectors don't need to know that, they
// simply produce nothing when the facts they're handed don't show enough
// history.
//
// LAST_MEETING and HISTORICAL_H2H are both "evergreen" rather than
// triggered by something changing — Appendix A itself says as much
// ("historical context, not future fixture" / "evergreen validated H2H
// context"). They exist to be available as SUPPORTING context 9.6's story
// merging can attach to a bigger primary narrative, which is why both
// score modestly here by design rather than competing for airtime as
// primary stories in their own right.
import { subjectKey } from "./story-engine-math.ts";
import type { StoryCandidate } from "./story-types.ts";
import type { LeagueType } from "@workspace/db/schema";

export type ArchiveH2HFacts = {
  leagueType: LeagueType;
  entityAId: number;
  entityBId: number;
  aWins: number;
  bWins: number;
  gamesPlayed: number;
  /** The single most recent prior meeting between these two entities, or null if they've never met. */
  lastMeeting: { matchId: number; playedAt: Date; winnerId: number; stake: number } | null;
};

const HISTORICAL_H2H_MIN_MEETINGS = 3; // "evergreen validated" reads as a real sample, not a single coincidental meeting

function h2hSubjects(facts: ArchiveH2HFacts): string[] {
  return [subjectKey(facts.leagueType, facts.entityAId), subjectKey(facts.leagueType, facts.entityBId)];
}

// ── LAST_MEETING (Appendix A: historical context, not future fixture) ────
export function detectLastMeeting(facts: ArchiveH2HFacts): StoryCandidate | null {
  if (!facts.lastMeeting) return null;

  return {
    storyType: "LAST_MEETING",
    leagueType: facts.leagueType,
    subjectKeys: h2hSubjects(facts),
    sentiment: "neutral",
    tags: ["last_meeting", "archive_context"],
    facts: {
      entityAId: facts.entityAId, entityBId: facts.entityBId,
      lastMeetingMatchId: facts.lastMeeting.matchId, lastMeetingWinnerId: facts.lastMeeting.winnerId,
      lastMeetingPlayedAt: facts.lastMeeting.playedAt.toISOString(), lastMeetingStake: facts.lastMeeting.stake,
    },
    components: {
      competitiveImportance: 2,
      unexpectedness: 0,
      historicalSignificance: 4,
      performanceAnomaly: 0,
      entertainmentValue: 2,
    },
  };
}

// ── HISTORICAL_H2H (Appendix A: evergreen validated H2H context) ─────────
export function detectHistoricalH2H(facts: ArchiveH2HFacts): StoryCandidate | null {
  if (facts.gamesPlayed < HISTORICAL_H2H_MIN_MEETINGS) return null;

  return {
    storyType: "HISTORICAL_H2H",
    leagueType: facts.leagueType,
    subjectKeys: h2hSubjects(facts),
    sentiment: "neutral",
    tags: ["historical_h2h", "archive_context"],
    facts: { entityAId: facts.entityAId, entityBId: facts.entityBId, aWins: facts.aWins, bWins: facts.bWins, gamesPlayed: facts.gamesPlayed },
    components: {
      competitiveImportance: 2,
      unexpectedness: 0,
      historicalSignificance: Math.min(facts.gamesPlayed / 10, 1) * 8,
      performanceAnomaly: 0,
      entertainmentValue: 2,
    },
  };
}

export const ARCHIVE_H2H_DETECTORS = [
  detectLastMeeting,
  detectHistoricalH2H,
] as const satisfies readonly ((facts: ArchiveH2HFacts) => StoryCandidate | null)[];

export function detectArchiveH2HStories(facts: ArchiveH2HFacts): StoryCandidate[] {
  return ARCHIVE_H2H_DETECTORS.map(detector => detector(facts)).filter((c): c is StoryCandidate => c !== null);
}

// ── SEASON_COMPARISON (Appendix A: current position/form vs previous completed season) ─

export type SeasonComparisonFacts = {
  leagueType: LeagueType;
  entityId: number;
  currentSeasonWinRate: number;
  /** From the most recent COMPLETED prior season for this same entity/league, or null if none exists yet (this is the entity's first season). */
  previousSeasonWinRate: number | null;
  currentSeasonPosition: number | null;
  previousSeasonFinalPosition: number | null;
};

const SEASON_COMPARISON_MATERIAL_WIN_RATE_DELTA = 0.15; // same "material" bar ABOVE_BASELINE uses
const SEASON_COMPARISON_MATERIAL_POSITION_DELTA = 2; // same bar QUIET_CLIMBER/FREEFALL use

export function detectSeasonComparison(facts: SeasonComparisonFacts): StoryCandidate | null {
  if (facts.previousSeasonWinRate === null) return null; // no prior completed season to compare against

  const winRateDelta = facts.currentSeasonWinRate - facts.previousSeasonWinRate;
  const positionDelta =
    facts.currentSeasonPosition !== null && facts.previousSeasonFinalPosition !== null
      ? facts.previousSeasonFinalPosition - facts.currentSeasonPosition // positive = improved (lower number is better)
      : null;

  const materialWinRateChange = Math.abs(winRateDelta) >= SEASON_COMPARISON_MATERIAL_WIN_RATE_DELTA;
  const materialPositionChange = positionDelta !== null && Math.abs(positionDelta) >= SEASON_COMPARISON_MATERIAL_POSITION_DELTA;
  if (!materialWinRateChange && !materialPositionChange) return null;

  const improved = winRateDelta > 0 || (positionDelta !== null && positionDelta > 0);

  return {
    storyType: "SEASON_COMPARISON",
    leagueType: facts.leagueType,
    subjectKeys: [subjectKey(facts.leagueType, facts.entityId)],
    sentiment: improved ? "positive" : "neutral",
    tags: ["season_comparison"],
    facts: {
      entityId: facts.entityId,
      currentSeasonWinRate: facts.currentSeasonWinRate, previousSeasonWinRate: facts.previousSeasonWinRate,
      currentSeasonPosition: facts.currentSeasonPosition, previousSeasonFinalPosition: facts.previousSeasonFinalPosition,
    },
    components: {
      competitiveImportance: 4,
      unexpectedness: 0,
      historicalSignificance: 6,
      performanceAnomaly: 0,
      entertainmentValue: 3,
    },
  };
}
