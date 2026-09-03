// Pure singles-timeline replay logic — zero DB imports, so it can be unit
// tested directly with Node's built-in test runner (see
// __tests__/timeline-replay.test.ts), following the same pattern as
// lib/singles-champion.ts. history-reconstruction.ts is the only caller —
// it fetches the real rows and hands them to replaySinglesTimeline().
//
// This exists for TKDL LIVE (see the handover doc, section 6: "Historical
// Reconstruction and Baseline Layer"). Many broadcast claims need the state
// immediately *before* a historical result — whether it was an upset, the
// pre-match streak, the pre-match points gap — and the players table can't
// answer that retrospectively because it only holds each player's current
// totals, already including every later match.
//
// Reconstruction rules, straight from section 6.4:
//   - Chronological order is the CALLER's responsibility (playedAt asc, id
//     asc as a deterministic tie-break for same-timestamp matches) — this
//     function trusts the order it's given rather than re-sorting, so
//     history-reconstruction.ts's query is the one source of truth for it.
//   - Real stake transfers only — reuses the same applyWager() every live
//     match submission uses, never reconstructs points from Elo.
//   - A player's running state starts at the season's starting balance the
//     first time they're seen in this season's match list. Singles' value
//     (25) is hardcoded to match performSeasonReset()'s reset value — there
//     is no "season roster" to read a starting balance from otherwise.
//   - Elimination is sticky: once a loss drops someone to 0 points,
//     matches.ts refuses to let them play again until the next season
//     reset, so once isEliminated flips true here it just carries forward.
// Extensioned import: this file is loaded directly by Node's native test
// runner (see __tests__/timeline-replay.test.ts), which requires explicit
// extensions on relative ESM specifiers — the bundler used for the real
// build resolves either form fine. See lib/singles-champion.ts for the
// same gotcha hit earlier in this codebase.
import { applyWager } from "../lib/wager.ts";

export type SinglesReplayMatch = {
  id: number;
  playedAt: Date;
  winnerId: number;
  loserId: number;
  stake: number;
};

export type SinglesPlayerState = {
  points: number;
  seasonWins: number;
  seasonLosses: number;
  seasonGamesPlayed: number;
  currentWinStreak: number;
  currentLossStreak: number;
  /** Most recent result first ("W"/"L"), capped at RECENT_FORM_CAP entries. */
  recentForm: ("W" | "L")[];
  isEliminated: boolean;
};

export type SinglesMatchState = {
  matchId: number;
  playedAt: Date;
  winnerId: number;
  loserId: number;
  stake: number;
  winnerBefore: SinglesPlayerState;
  loserBefore: SinglesPlayerState;
  winnerAfter: SinglesPlayerState;
  loserAfter: SinglesPlayerState;
};

// Matches performSeasonReset()'s reset value (lib/seasonReset.ts) — every
// active player is set to 25 points at the start of a new Singles season.
export const SINGLES_SEASON_STARTING_POINTS = 25;

const RECENT_FORM_CAP = 10;

function initialState(): SinglesPlayerState {
  return {
    points: SINGLES_SEASON_STARTING_POINTS,
    seasonWins: 0,
    seasonLosses: 0,
    seasonGamesPlayed: 0,
    currentWinStreak: 0,
    currentLossStreak: 0,
    recentForm: [],
    isEliminated: false,
  };
}

function clone(s: SinglesPlayerState): SinglesPlayerState {
  return { ...s, recentForm: [...s.recentForm] };
}

/**
 * Replays a season's singles matches in order, returning the full
 * before/after state for both participants at every match.
 *
 * `matches` MUST already be in the order they were actually played
 * (playedAt asc, id asc) — see the module header for why that's the
 * caller's job, not this function's.
 */
export function replaySinglesTimeline(matches: SinglesReplayMatch[]): SinglesMatchState[] {
  const state = new Map<number, SinglesPlayerState>();
  const getState = (playerId: number): SinglesPlayerState => {
    let s = state.get(playerId);
    if (!s) { s = initialState(); state.set(playerId, s); }
    return s;
  };

  const timeline: SinglesMatchState[] = [];

  for (const m of matches) {
    const winnerBefore = clone(getState(m.winnerId));
    const loserBefore = clone(getState(m.loserId));

    const { newWinnerPoints, newLoserPoints, loserEliminated } = applyWager(
      m.stake,
      { points: winnerBefore.points },
      { points: loserBefore.points },
    );

    const winnerAfter: SinglesPlayerState = {
      points: newWinnerPoints,
      seasonWins: winnerBefore.seasonWins + 1,
      seasonLosses: winnerBefore.seasonLosses,
      seasonGamesPlayed: winnerBefore.seasonGamesPlayed + 1,
      currentWinStreak: winnerBefore.currentWinStreak + 1,
      currentLossStreak: 0,
      recentForm: ["W" as const, ...winnerBefore.recentForm].slice(0, RECENT_FORM_CAP),
      isEliminated: winnerBefore.isEliminated,
    };

    const loserAfter: SinglesPlayerState = {
      points: newLoserPoints,
      seasonWins: loserBefore.seasonWins,
      seasonLosses: loserBefore.seasonLosses + 1,
      seasonGamesPlayed: loserBefore.seasonGamesPlayed + 1,
      currentWinStreak: 0,
      currentLossStreak: loserBefore.currentLossStreak + 1,
      recentForm: ["L" as const, ...loserBefore.recentForm].slice(0, RECENT_FORM_CAP),
      isEliminated: loserBefore.isEliminated || loserEliminated,
    };

    state.set(m.winnerId, winnerAfter);
    state.set(m.loserId, loserAfter);

    timeline.push({
      matchId: m.id,
      playedAt: m.playedAt,
      winnerId: m.winnerId,
      loserId: m.loserId,
      stake: m.stake,
      winnerBefore, loserBefore, winnerAfter, loserAfter,
    });
  }

  return timeline;
}
