// Pure team-vs-team timeline replay — the Doubles Event / Shift Wars
// counterpart to timeline-replay.ts's Singles replay. Zero DB imports, unit
// tested directly (see __tests__/team-timeline-replay.test.ts).
//
// Doubles and Shift Wars share the same underlying mechanic (applyWager
// moves points between two teams on every match) but differ in two ways
// this module has to account for:
//   - Doubles teams track Elo (applyEloChange, same as every Singles
//     match); Shift Wars teams don't have an Elo column at all.
//   - Doubles teams all start a season at the same fixed 50 points
//     (DOUBLES_STARTING_POINTS in lib/doublesDraw.ts); Shift Wars teams
//     each have their own admin-configurable starting_points, so there's
//     no single starting-balance constant — the caller supplies a
//     per-team starting state instead.
// One generic replayTeamTimeline() covers both by taking that starting
// state as a config callback rather than a hardcoded number.
import { applyWager } from "../lib/wager.ts";
import { applyEloChange } from "../lib/elo.ts";

export type TeamReplayMatch = {
  id: number;
  playedAt: Date;
  winnerTeamId: number;
  loserTeamId: number;
  stake: number;
};

export type TeamState = {
  points: number;
  /** null for leagues that don't track Elo (Shift Wars). */
  elo: number | null;
  wins: number;
  losses: number;
  currentWinStreak: number;
  currentLossStreak: number;
  /** Most recent result first, capped at RECENT_FORM_CAP entries. */
  recentForm: ("W" | "L")[];
  isEliminated: boolean;
};

export type TeamMatchState = {
  matchId: number;
  playedAt: Date;
  winnerTeamId: number;
  loserTeamId: number;
  stake: number;
  winnerBefore: TeamState;
  loserBefore: TeamState;
  winnerAfter: TeamState;
  loserAfter: TeamState;
};

export type TeamReplayConfig = {
  /** Called once, the first time a team is seen in the match list. */
  initialState: (teamId: number) => { points: number; elo: number | null };
  trackElo: boolean;
};

const RECENT_FORM_CAP = 10;

function clone(s: TeamState): TeamState {
  return { ...s, recentForm: [...s.recentForm] };
}

export function replayTeamTimeline(matches: TeamReplayMatch[], config: TeamReplayConfig): TeamMatchState[] {
  const state = new Map<number, TeamState>();
  const getState = (teamId: number): TeamState => {
    let s = state.get(teamId);
    if (!s) {
      const init = config.initialState(teamId);
      s = {
        points: init.points,
        elo: config.trackElo ? init.elo : null,
        wins: 0, losses: 0,
        currentWinStreak: 0, currentLossStreak: 0,
        recentForm: [], isEliminated: false,
      };
      state.set(teamId, s);
    }
    return s;
  };

  const timeline: TeamMatchState[] = [];

  for (const m of matches) {
    const winnerBefore = clone(getState(m.winnerTeamId));
    const loserBefore = clone(getState(m.loserTeamId));

    const { newWinnerPoints, newLoserPoints, loserEliminated } = applyWager(
      m.stake,
      { points: winnerBefore.points },
      { points: loserBefore.points },
    );

    let newWinnerElo: number | null = null;
    let newLoserElo: number | null = null;
    if (config.trackElo && winnerBefore.elo != null && loserBefore.elo != null) {
      const eloResult = applyEloChange(winnerBefore.elo, loserBefore.elo);
      newWinnerElo = eloResult.newWinnerElo;
      newLoserElo = eloResult.newLoserElo;
    }

    const winnerAfter: TeamState = {
      points: newWinnerPoints,
      elo: newWinnerElo,
      wins: winnerBefore.wins + 1,
      losses: winnerBefore.losses,
      currentWinStreak: winnerBefore.currentWinStreak + 1,
      currentLossStreak: 0,
      recentForm: ["W" as const, ...winnerBefore.recentForm].slice(0, RECENT_FORM_CAP),
      isEliminated: winnerBefore.isEliminated,
    };

    const loserAfter: TeamState = {
      points: newLoserPoints,
      elo: newLoserElo,
      wins: loserBefore.wins,
      losses: loserBefore.losses + 1,
      currentWinStreak: 0,
      currentLossStreak: loserBefore.currentLossStreak + 1,
      recentForm: ["L" as const, ...loserBefore.recentForm].slice(0, RECENT_FORM_CAP),
      isEliminated: loserBefore.isEliminated || loserEliminated,
    };

    state.set(m.winnerTeamId, winnerAfter);
    state.set(m.loserTeamId, loserAfter);

    timeline.push({
      matchId: m.id,
      playedAt: m.playedAt,
      winnerTeamId: m.winnerTeamId,
      loserTeamId: m.loserTeamId,
      stake: m.stake,
      winnerBefore, loserBefore, winnerAfter, loserAfter,
    });
  }

  return timeline;
}
