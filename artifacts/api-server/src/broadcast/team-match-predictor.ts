// TKDL LIVE — Non-Elo Match Predictor for Doubles Event (7.7) and Shift
// Wars (7.8). Mirrors match-predictor.ts's Singles structure — same
// smoothedRate/recentFormScore/pairProbability/confidence machinery from
// predictor-math.ts — but built on team state instead of player state.
import { desc, eq, sql } from "drizzle-orm";
import { db, seasonsTable } from "@workspace/db";
import { buildPlayerBaselines } from "./history-reconstruction";
import {
  buildDoublesTeamTimeline, buildDoublesTeamH2HBefore,
  buildShiftWarsTeamTimeline, buildShiftWarsTeamH2HBefore,
  teamStateAsOf, getShiftWarsStartingPoints, DOUBLES_STARTING_ELO,
  resolveShiftWarsSeasonWindow,
  type TeamState,
} from "./team-history-reconstruction";
import { DOUBLES_STARTING_POINTS } from "../lib/doublesDraw";
import {
  smoothedRate, PRIOR_GAMES, recentFormScore,
  weightedAverageWithRedistribution, pairProbability,
  confidenceScore, confidenceBand, type ConfidenceBand,
} from "./predictor-math";

export type TeamMatchPrediction = {
  teamAId: number;
  teamBId: number;
  cutoff: Date;
  pA: number;
  pB: number;
  confidence: number;
  confidenceBand: ConfidenceBand;
  h2h: { aWins: number; bWins: number; gamesPlayed: number };
};

export function teamRecordRate(state: TeamState): number {
  return smoothedRate(state.wins, state.wins + state.losses, PRIOR_GAMES.season);
}

// ── 7.7: Doubles Event ───────────────────────────────────────────────────
//
// Weights: 35% current-team season record, 25% recent team form, 15%
// current-season team H2H, 10% opponent quality, 15% aggregate underlying
// Singles strength of roster members — shrinking to 5% after 8 Doubles
// matches, with the freed 10% redistributed to team record/recent form.
//
// The doc says "redistribute the 10%" without specifying how to split it
// between those two features — this splits it proportionally to their own
// existing weights (35:25, i.e. 7:5), the same "don't invent an arbitrary
// split" principle behind the generic redistribution helper, just applied
// by hand here since it's a fixed doc-specified shift rather than a
// missing-feature case.
export const DOUBLES_BASE_WEIGHTS = { teamRecord: 0.35, recentForm: 0.25, h2h: 0.15, opponentQuality: 0.10, rosterStrength: 0.15 };
const DOUBLES_ROSTER_SHRINK_AFTER_MATCHES = 8;
const DOUBLES_ROSTER_SHRUNK_WEIGHT = 0.05;

export function doublesWeights(teamGamesPlayed: number) {
  if (teamGamesPlayed < DOUBLES_ROSTER_SHRINK_AFTER_MATCHES) return DOUBLES_BASE_WEIGHTS;
  const freed = DOUBLES_BASE_WEIGHTS.rosterStrength - DOUBLES_ROSTER_SHRUNK_WEIGHT; // 0.10
  const recordShare = DOUBLES_BASE_WEIGHTS.teamRecord / (DOUBLES_BASE_WEIGHTS.teamRecord + DOUBLES_BASE_WEIGHTS.recentForm);
  return {
    teamRecord: DOUBLES_BASE_WEIGHTS.teamRecord + freed * recordShare,
    recentForm: DOUBLES_BASE_WEIGHTS.recentForm + freed * (1 - recordShare),
    h2h: DOUBLES_BASE_WEIGHTS.h2h,
    opponentQuality: DOUBLES_BASE_WEIGHTS.opponentQuality,
    rosterStrength: DOUBLES_ROSTER_SHRUNK_WEIGHT,
  };
}

type DoublesTeamRow = { id: number; player1_id: number; player2_id: number; player3_id: number | null; season_id: number };

export async function getDoublesTeamRoster(teamId: number): Promise<number[]> {
  const [row] = (await db.execute(
    sql`SELECT id, player1_id, player2_id, player3_id, season_id FROM doubles_teams WHERE id = ${teamId}`,
  )).rows as DoublesTeamRow[];
  if (!row) throw new Error(`getDoublesTeamRoster: team ${teamId} not found`);
  return [row.player1_id, row.player2_id, row.player3_id].filter((id): id is number => id != null);
}

export async function computeDoublesOpponentQuality(teamId: number, seasonId: number, cutoff: Date): Promise<number | null> {
  const rows = (await db.execute(sql`
    SELECT winner_team_id, loser_team_id, played_at FROM doubles_matches
    WHERE season_id = ${seasonId} AND played_at < ${cutoff}
      AND (winner_team_id = ${teamId} OR loser_team_id = ${teamId})
  `)).rows as { winner_team_id: number; loser_team_id: number; played_at: string | Date }[];
  if (rows.length === 0) return null;

  const timeline = await buildDoublesTeamTimeline(seasonId);
  const strengths: number[] = [];
  for (const r of rows) {
    const opponentId = r.winner_team_id === teamId ? r.loser_team_id : r.winner_team_id;
    const opponentState = teamStateAsOf(timeline, opponentId, new Date(r.played_at), {
      points: DOUBLES_STARTING_POINTS, elo: DOUBLES_STARTING_ELO,
      wins: 0, losses: 0, currentWinStreak: 0, currentLossStreak: 0, recentForm: [], isEliminated: false,
    });
    strengths.push(teamRecordRate(opponentState));
  }
  return strengths.reduce((sum, s) => sum + s, 0) / strengths.length;
}

async function computeDoublesTeamStrength(
  teamId: number, seasonId: number, cutoff: Date,
  h2hWins: number, h2hGames: number,
): Promise<{ strength: number; confidence: number; gamesPlayed: number }> {
  const timeline = await buildDoublesTeamTimeline(seasonId);
  const state = teamStateAsOf(timeline, teamId, cutoff, {
    points: DOUBLES_STARTING_POINTS, elo: DOUBLES_STARTING_ELO,
    wins: 0, losses: 0, currentWinStreak: 0, currentLossStreak: 0, recentForm: [], isEliminated: false,
  });
  const gamesPlayed = state.wins + state.losses;

  const recordRate = teamRecordRate(state);
  const recentForm = recentFormScore(state.recentForm, recordRate);
  const h2hRate = h2hGames > 0 ? smoothedRate(h2hWins, h2hGames, PRIOR_GAMES.h2h) : null;
  const opponentQuality = await computeDoublesOpponentQuality(teamId, seasonId, cutoff);

  const roster = await getDoublesTeamRoster(teamId);
  const rosterBaselines = await Promise.all(roster.map(playerId => buildPlayerBaselines(playerId, cutoff)));
  const rosterStrength = rosterBaselines.length > 0
    ? rosterBaselines.reduce((sum, b) => sum + smoothedRate(b.career.wins, b.career.gamesPlayed, PRIOR_GAMES.career), 0) / rosterBaselines.length
    : null;

  const weights = doublesWeights(gamesPlayed);
  const strength = weightedAverageWithRedistribution([
    { weight: weights.teamRecord, value: recordRate },
    { weight: weights.recentForm, value: recentForm },
    { weight: weights.h2h, value: h2hRate },
    { weight: weights.opponentQuality, value: opponentQuality },
    { weight: weights.rosterStrength, value: rosterStrength },
  ]) ?? 0.5;

  // Confidence reuses the 7.6 formula with team-appropriate substitutions:
  // "seasonGames" is the team's own current-season games (there's no
  // separate "career" axis for an ephemeral per-season team, so careerGames
  // mirrors seasonGames rather than double-counting a nonexistent history),
  // "detailedMatches" has no team-level equivalent so it's held at the
  // roster's average detailed-match count as the closest available proxy.
  const avgDetailed = rosterBaselines.length > 0
    ? rosterBaselines.reduce((sum, b) => sum + b.detailedMatches.length, 0) / rosterBaselines.length
    : 0;
  const confidence = confidenceScore({
    seasonGames: gamesPlayed,
    careerGames: gamesPlayed,
    h2hGames,
    detailedMatches: avgDetailed,
    recentGames: state.recentForm.length,
  });

  return { strength, confidence, gamesPlayed };
}

export async function predictDoublesMatch(
  teamAId: number, teamBId: number, seasonId: number, opts?: { cutoff?: Date },
): Promise<TeamMatchPrediction> {
  const cutoff = opts?.cutoff ?? new Date();
  const h2h = await buildDoublesTeamH2HBefore(teamAId, teamBId, cutoff, seasonId);

  const [a, b] = await Promise.all([
    computeDoublesTeamStrength(teamAId, seasonId, cutoff, h2h.aWins, h2h.gamesPlayed),
    computeDoublesTeamStrength(teamBId, seasonId, cutoff, h2h.bWins, h2h.gamesPlayed),
  ]);

  const { pA, pB } = pairProbability(a.strength, b.strength);
  const confidence = Math.min(a.confidence, b.confidence);

  return {
    teamAId, teamBId, cutoff, pA, pB,
    confidence, confidenceBand: confidenceBand(confidence),
    h2h: { aWins: h2h.aWins, bWins: h2h.bWins, gamesPlayed: h2h.gamesPlayed },
  };
}

// ── 7.8: Shift Wars ──────────────────────────────────────────────────────
//
// Weights: 40% current-month team record, 25% recent team form, 20%
// historical (career-wide) department H2H, 15% opponent quality/current-
// month momentum. Unlike Singles/Doubles' "opponent quality" (an average
// over every opponent already faced this period), Shift Wars only ever has
// 1-2 possible opponents and the specific matchup being predicted is
// always known — so this reads as the ACTUAL opponent's own current-month
// record, not an aggregate over past opponents. No roster-strength
// analogue exists here (section 7.8: "do not attribute a team match to
// individual players").
export const SHIFT_WARS_WEIGHTS = { teamRecord: 0.40, recentForm: 0.25, h2h: 0.20, opponentQuality: 0.15 };

/**
 * Resolves cutoff to the shift_wars season whose window actually contains
 * it — NOT just "whichever season is flagged is_active today". A caller
 * predicting a real, right-now match always gets the active season back
 * (cutoff ≈ now falls inside its still-open window), but a caller that
 * passes a past cutoff — e.g. a future Story Engine narrating an
 * already-played match — correctly resolves to the season that was really
 * running then instead of silently defaulting to today's season. Mirrors
 * getShiftWarsPreMatchContext's own window-matching pattern in
 * team-history-reconstruction.ts.
 */
export async function resolveShiftWarsSeasonForCutoff(cutoff: Date): Promise<number> {
  const seasons = await db
    .select()
    .from(seasonsTable)
    .where(eq(seasonsTable.leagueType, "shift_wars"))
    .orderBy(desc(seasonsTable.id));

  const owning = seasons.find(s => {
    const { start, end } = resolveShiftWarsSeasonWindow(s, new Date());
    return cutoff >= start && cutoff < end;
  });
  if (!owning) {
    throw new Error(`resolveShiftWarsSeasonForCutoff: no shift_wars season covers ${cutoff.toISOString()}`);
  }
  return owning.id;
}

async function computeShiftWarsTeamStrength(
  teamId: number, opponentTeamId: number, seasonId: number, cutoff: Date,
  h2hWins: number, h2hGames: number,
): Promise<{ strength: number; confidence: number }> {
  const timeline = await buildShiftWarsTeamTimeline(seasonId, cutoff);
  const startingPoints = await getShiftWarsStartingPoints();
  const fallback = (id: number): TeamState => ({
    points: startingPoints.get(id) ?? 0, elo: null,
    wins: 0, losses: 0, currentWinStreak: 0, currentLossStreak: 0, recentForm: [], isEliminated: false,
  });

  const state = teamStateAsOf(timeline, teamId, cutoff, fallback(teamId));
  const opponentState = teamStateAsOf(timeline, opponentTeamId, cutoff, fallback(opponentTeamId));
  const gamesPlayed = state.wins + state.losses;

  const recordRate = teamRecordRate(state);
  const recentForm = recentFormScore(state.recentForm, recordRate);
  const h2hRate = h2hGames > 0 ? smoothedRate(h2hWins, h2hGames, PRIOR_GAMES.h2h) : null;
  const opponentMomentum = teamRecordRate(opponentState);

  const strength = weightedAverageWithRedistribution([
    { weight: SHIFT_WARS_WEIGHTS.teamRecord, value: recordRate },
    { weight: SHIFT_WARS_WEIGHTS.recentForm, value: recentForm },
    { weight: SHIFT_WARS_WEIGHTS.h2h, value: h2hRate },
    { weight: SHIFT_WARS_WEIGHTS.opponentQuality, value: opponentMomentum },
  ]) ?? 0.5;

  // Same team-appropriate substitution as Doubles: no separate "career" or
  // "detailed matches" axis exists for a team, so seasonGames doubles for
  // careerGames and detailedMatches is held at 0 (never available at team
  // granularity) rather than fabricating a number.
  const confidence = confidenceScore({
    seasonGames: gamesPlayed, careerGames: gamesPlayed,
    h2hGames, detailedMatches: 0, recentGames: state.recentForm.length,
  });

  return { strength, confidence };
}

export async function predictShiftWarsMatch(
  teamAId: number, teamBId: number, opts?: { cutoff?: Date; seasonId?: number },
): Promise<TeamMatchPrediction> {
  const cutoff = opts?.cutoff ?? new Date();
  const seasonId = opts?.seasonId ?? await resolveShiftWarsSeasonForCutoff(cutoff);
  const h2h = await buildShiftWarsTeamH2HBefore(teamAId, teamBId, cutoff);

  const [a, b] = await Promise.all([
    computeShiftWarsTeamStrength(teamAId, teamBId, seasonId, cutoff, h2h.aWins, h2h.gamesPlayed),
    computeShiftWarsTeamStrength(teamBId, teamAId, seasonId, cutoff, h2h.bWins, h2h.gamesPlayed),
  ]);

  const { pA, pB } = pairProbability(a.strength, b.strength);
  const confidence = Math.min(a.confidence, b.confidence);

  return {
    teamAId, teamBId, cutoff, pA, pB,
    confidence, confidenceBand: confidenceBand(confidence),
    h2h: { aWins: h2h.aWins, bWins: h2h.bWins, gamesPlayed: h2h.gamesPlayed },
  };
}
