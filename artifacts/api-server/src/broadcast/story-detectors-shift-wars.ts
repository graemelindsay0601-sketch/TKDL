// TKDL LIVE — Story Engine: SHIFT_WARS family detectors (handover doc
// Appendix A). Shift-Wars-only department team standings — SHIFT_LEAD_
// CHANGE/SHIFT_MOMENTUM/SHIFT_COMEBACK/SHIFT_DOMINANCE.
//
// JUDGMENT CALL worth flagging explicitly: SHIFT_LEAD_CHANGE covers
// exactly the same ground LEAGUE's own NEW_LEADER already covers generically
// across all three leagues (story-detectors-league.ts), and SHIFT_MOMENTUM
// overlaps LEAGUE's LEAD_TIGHTENS/LEAD_WIDENS. Appendix A still lists
// these as their OWN separate SHIFT_WARS-family types rather than folding
// Shift Wars into LEAGUE's coverage, so this file keeps them distinct
// rather than silently assuming the doc meant to de-duplicate them. The
// two families CAN both fire for the same underlying points-leader change
// in a shift_wars Edition — that's intentional overlap for 9.6's story
// merging (or the not-yet-built Director, section 10) to reconcile by
// picking one primary narrative, not a bug in either detector file.
//
// Deliberately simpler inputs than LEAGUE's LeagueEntityStanding: no
// titleProbability here, since none of these four types are about title
// chances — SHIFT_WARS stories are about the raw department points table
// itself (team-timeline-replay.ts's TeamState.points/wins/losses).
import { SCORE_MAX, subjectKey } from "./story-engine-math.ts";
import type { StoryCandidate } from "./story-types.ts";

export type ShiftWarsTeamStanding = {
  teamId: number;
  points: number;
  wins: number;
  losses: number;
};

export type ShiftWarsDeficitWindow = {
  teamId: number;
  matches: number;
  /** This team's points gap BEHIND the current leader, `matches` of their own matches ago. */
  deficitBefore: number;
  /** The same gap now. */
  deficitNow: number;
};

export type ShiftWarsStandingsFacts = {
  current: ShiftWarsTeamStanding[];
  /** From the previous Edition's stored snapshot, or null if this is the season's first Edition. */
  previous: ShiftWarsTeamStanding[] | null;
  /** One entry per team story-engine.ts judged worth checking for a recovered deficit — typically just teams currently trailing. */
  deficitRecoveryWindows: ShiftWarsDeficitWindow[];
};

const LEAD_GAP_MATERIAL_DELTA = 3; // same reasoning as story-detectors-league.ts's own constant — small-integer-stakes points table
const DEFICIT_RECOVERY_MIN_MATCHES = 3;
const DEFICIT_RECOVERY_MATERIAL_DELTA = 3;
const DOMINANCE_MIN_GAMES = 8;
const DOMINANCE_MIN_WIN_SHARE = 0.75;

function byPointsDesc(standings: ShiftWarsTeamStanding[]): ShiftWarsTeamStanding[] {
  return [...standings].sort((a, b) => b.points - a.points);
}

function leaderGap(standings: ShiftWarsTeamStanding[]): number | null {
  const sorted = byPointsDesc(standings);
  if (sorted.length < 2) return null;
  return sorted[0].points - sorted[1].points;
}

// ── SHIFT_LEAD_CHANGE (Appendix A: department points leader changes) ─────
export function detectShiftLeadChange(facts: ShiftWarsStandingsFacts): StoryCandidate[] {
  if (!facts.previous) return [];

  const currentLeader = byPointsDesc(facts.current)[0];
  const previousLeader = byPointsDesc(facts.previous)[0];
  if (!currentLeader || !previousLeader) return [];
  if (currentLeader.teamId === previousLeader.teamId) return [];

  return [{
    storyType: "SHIFT_LEAD_CHANGE",
    leagueType: "shift_wars",
    subjectKeys: [subjectKey("shift_wars", currentLeader.teamId), subjectKey("shift_wars", previousLeader.teamId)],
    sentiment: "positive",
    tags: ["shift_lead_change"],
    facts: { newLeaderTeamId: currentLeader.teamId, previousLeaderTeamId: previousLeader.teamId, points: currentLeader.points },
    components: {
      competitiveImportance: 18,
      unexpectedness: 0,
      historicalSignificance: 6,
      performanceAnomaly: 0,
      entertainmentValue: 4,
    },
  }];
}

// ── SHIFT_MOMENTUM (Appendix A: recent team results materially swing gap) ─
// Unlike LEAGUE's LEAD_TIGHTENS/LEAD_WIDENS split, Appendix A gives Shift
// Wars a single MOMENTUM type covering a material swing in EITHER
// direction — the doc's own "momentum" framing reads as being about which
// way things are trending right now more than a tightens-vs-widens split.
export function detectShiftMomentum(facts: ShiftWarsStandingsFacts): StoryCandidate[] {
  if (!facts.previous) return [];
  const currentGap = leaderGap(facts.current);
  const previousGap = leaderGap(facts.previous);
  if (currentGap === null || previousGap === null) return [];

  const delta = currentGap - previousGap;
  if (Math.abs(delta) < LEAD_GAP_MATERIAL_DELTA) return [];

  const leader = byPointsDesc(facts.current)[0];
  const direction = delta > 0 ? "widening" : "tightening";

  return [{
    storyType: "SHIFT_MOMENTUM",
    leagueType: "shift_wars",
    subjectKeys: [subjectKey("shift_wars", leader.teamId)],
    sentiment: "neutral",
    tags: ["shift_momentum", direction],
    facts: { leaderTeamId: leader.teamId, previousGap, currentGap, direction },
    components: {
      competitiveImportance: 14,
      unexpectedness: 0,
      historicalSignificance: 4,
      performanceAnomaly: 0,
      entertainmentValue: 3,
    },
  }];
}

// ── SHIFT_COMEBACK (Appendix A: deficit materially recovered across multiple results) ─
export function detectShiftComeback(facts: ShiftWarsStandingsFacts): StoryCandidate[] {
  const results: StoryCandidate[] = [];

  for (const window of facts.deficitRecoveryWindows) {
    if (window.matches < DEFICIT_RECOVERY_MIN_MATCHES) continue;
    const recovered = window.deficitBefore - window.deficitNow;
    if (recovered < DEFICIT_RECOVERY_MATERIAL_DELTA) continue;

    results.push({
      storyType: "SHIFT_COMEBACK",
      leagueType: "shift_wars",
      subjectKeys: [subjectKey("shift_wars", window.teamId)],
      sentiment: "positive",
      tags: ["shift_comeback"],
      facts: { teamId: window.teamId, deficitBefore: window.deficitBefore, deficitNow: window.deficitNow, matches: window.matches },
      components: {
        competitiveImportance: 15,
        unexpectedness: 0,
        historicalSignificance: Math.min(recovered / 10, 1) * SCORE_MAX.historicalSignificance,
        performanceAnomaly: 0,
        entertainmentValue: 4,
      },
    });
  }

  return results;
}

// ── SHIFT_DOMINANCE (Appendix A: sustained high win share with adequate matches) ─
export function detectShiftDominance(facts: ShiftWarsStandingsFacts): StoryCandidate[] {
  const results: StoryCandidate[] = [];

  for (const team of facts.current) {
    const gamesPlayed = team.wins + team.losses;
    if (gamesPlayed < DOMINANCE_MIN_GAMES) continue;
    const winShare = team.wins / gamesPlayed;
    if (winShare < DOMINANCE_MIN_WIN_SHARE) continue;

    results.push({
      storyType: "SHIFT_DOMINANCE",
      leagueType: "shift_wars",
      subjectKeys: [subjectKey("shift_wars", team.teamId)],
      sentiment: "positive",
      tags: ["shift_dominance"],
      facts: { teamId: team.teamId, wins: team.wins, losses: team.losses, winShare },
      components: {
        competitiveImportance: 12,
        unexpectedness: 0,
        historicalSignificance: Math.min(gamesPlayed / 20, 1) * SCORE_MAX.historicalSignificance,
        performanceAnomaly: 0,
        entertainmentValue: 4,
      },
    });
  }

  return results;
}

export const SHIFT_WARS_DETECTORS = [
  detectShiftLeadChange,
  detectShiftMomentum,
  detectShiftComeback,
  detectShiftDominance,
] as const satisfies readonly ((facts: ShiftWarsStandingsFacts) => StoryCandidate[])[];

export function detectShiftWarsStories(facts: ShiftWarsStandingsFacts): StoryCandidate[] {
  return SHIFT_WARS_DETECTORS.flatMap(detector => detector(facts));
}
