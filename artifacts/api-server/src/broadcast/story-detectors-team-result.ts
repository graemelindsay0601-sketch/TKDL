import { subjectKey } from "./story-engine-math.ts";
import type { StoryCandidate } from "./story-types.ts";
import type { LeagueType } from "@workspace/db/schema";

/** A completed result whose shape is wider than a normal 1v1: uneven
 * player teams, combined official teams, a 3+-team elimination match, or a
 * Shift Wars result. Names are captured from the result row at detection
 * time so commentary describes the whole side rather than one captain. */
export type TeamResultFacts = {
  resultRef: string;
  resultKind: string;
  leagueType: LeagueType;
  matchId: number;
  anchorMatchId: number;
  seasonId: number | null;
  playedAt: Date;
  winnerName: string;
  loserName: string;
  winnerEntityIds: number[];
  loserEntityIds: number[];
  stake: number;
};

export function detectTeamResult(facts: TeamResultFacts): StoryCandidate {
  const entityIds = [...new Set([...facts.winnerEntityIds, ...facts.loserEntityIds])];
  return {
    storyType: "TEAM_RESULT",
    leagueType: facts.leagueType,
    subjectKeys: entityIds.map(id => subjectKey(facts.leagueType, id)),
    anchorMatchId: facts.anchorMatchId,
    sentiment: "neutral",
    tags: ["result", "team_result", facts.resultKind],
    facts: {
      resultRef: facts.resultRef,
      resultKind: facts.resultKind,
      matchId: facts.matchId,
      playedAt: facts.playedAt.toISOString(),
      winnerName: facts.winnerName,
      loserName: facts.loserName,
      winnerEntityIds: facts.winnerEntityIds,
      loserEntityIds: facts.loserEntityIds,
      // Plain counts, kept alongside the id arrays above — commentary-
      // engine.ts's buildGraphicFacts() REPLACES any "*Ids"-suffixed array
      // with a resolved "*NamesJoined" string before a graphic ever sees
      // this object (its own header: "a raw id left in here shows up to a
      // viewer as a literal database number"), so a graphic component
      // reading winnerEntityIds.length directly (as team-result-graphic.ts
      // used to) would always see an empty array in production and under-
      // count every side as 1. Non-id-shaped names, so they pass through
      // that resolution untouched.
      winnerCount: facts.winnerEntityIds.length,
      loserCount: facts.loserEntityIds.length,
      stake: facts.stake,
    },
    components: {
      competitiveImportance: Math.min(8, Math.max(2, facts.stake)),
      unexpectedness: 0,
      historicalSignificance: facts.resultKind.includes("multi") ? 3 : 0,
      performanceAnomaly: 0,
      entertainmentValue: facts.resultKind.includes("multi") || facts.resultKind.includes("combined") ? 3 : 2,
    },
  };
}
