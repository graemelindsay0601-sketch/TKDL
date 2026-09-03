// TKDL LIVE — Open-Wager Title Predictor for Doubles Event (7.7 weights)
// and Shift Wars (7.8 weights), handover doc section 8. Mirrors
// title-predictor.ts's Singles simulation structure — same Monte Carlo
// loop, participant-selection and stake machinery from title-predictor-
// math.ts — but built on team state instead of player state, same split as
// match-predictor.ts / team-match-predictor.ts.
//
// FIXED vs DYNAMIC, per 8.6, applied the same way title-predictor.ts reads
// it for Singles:
//   Doubles FIXED: roster strength (career Singles rate of each team
//   member — a player's career record doesn't change from a hypothetical
//   future team result). Opponent quality is also frozen at its
//   pre-simulation snapshot, same judgment call as Singles, for the same
//   reason (recomputing it from simulated opponents compounds error for a
//   feature the doc's fixed/dynamic list is silent on).
//   Doubles DYNAMIC: team record, recent form, team H2H — plus the 15%→5%
//   roster-strength shrink rule, which is itself keyed off the team's
//   dynamically-growing simulated game count.
//   Shift Wars has no fixed component at all (no roster/darts equivalent)
//   — every one of its four features is dynamic, including "opponent
//   quality/momentum," which team-match-predictor.ts already defines as
//   simply the actual specific opponent's own current-record rate. The
//   shared simulation engine below always hands `simulatedStrength` BOTH
//   sides' simulated state for exactly this reason — Doubles ignores the
//   opponent argument, Shift Wars uses it directly.
import { eq, sql } from "drizzle-orm";
import { db, seasonsTable } from "@workspace/db";
import { applyWager, getMaxStake } from "../lib/wager";
import {
  buildPlayerBaselines, buildLeagueActivityProfile,
  buildDoublesTeamTimeline, buildDoublesTeamH2HBefore,
  buildShiftWarsTeamTimeline, buildShiftWarsTeamH2HBefore,
} from "./history-reconstruction";
import { teamStateAsOf, getShiftWarsStartingPoints, DOUBLES_STARTING_ELO, type TeamState } from "./team-history-reconstruction";
import { DOUBLES_STARTING_POINTS } from "../lib/doublesDraw";
import {
  doublesWeights, getDoublesTeamRoster, computeDoublesOpponentQuality,
  SHIFT_WARS_WEIGHTS, resolveShiftWarsSeasonForCutoff,
} from "./team-match-predictor";
import {
  smoothedRate, PRIOR_GAMES, recentFormScore,
  weightedAverageWithRedistribution, pairProbability,
  confidenceBand, type ConfidenceBand,
} from "./predictor-math";
import {
  DEFAULT_SIMULATION_COUNT, daysRemainingInMonth, leagueDailyRate, poissonSample,
  activityPropensity, pairFrequencyFactor, pairWeight, sampleWeightedPair,
  sampleStake, titleConfidenceScore,
  type WeightedPair,
} from "./title-predictor-math";

function pairKey(lowId: number, highId: number): string {
  return `${lowId}-${highId}`;
}

// A team's dynamic in-simulation state — same shape for both leagues, since
// both ultimately replay the same applyWager mechanic (see
// team-timeline-replay.ts, which this mirrors for the same reason: a
// uniform points/wins/losses/recentForm/isEliminated model, regardless of
// whether the live app itself acts on isEliminated for that league).
type SimTeamState = {
  points: number;
  wins: number;
  losses: number;
  recentForm: ("W" | "L")[]; // newest first, capped at 10
  isEliminated: boolean;
};

type PairH2HState = { lowWins: number; highWins: number; games: number };

/**
 * Combines a team's own dynamic record/form/H2H with whatever
 * league-specific fixed/opponent features `simulatedStrength` supplies.
 * Always receives BOTH sides' current simulated state — Shift Wars' own
 * "opponent quality" feature needs the actual opponent's simulated record,
 * which nothing else in this shared shape would otherwise expose.
 */
type SimulatedStrengthFn = (
  teamId: number, sim: SimTeamState, opponent: SimTeamState,
  h2hWins: number, h2hGames: number, simGamesPlayed: number,
) => number;

export type TitleProbability = {
  teamId: number;
  name: string;
  probability: number;
  displayPercentage: number;
};

export type TeamTitlePrediction = {
  seasonId: number;
  generatedAt: Date;
  simulationCount: number;
  daysRemaining: number;
  leagueDailyRate: number;
  probabilities: TitleProbability[];
  confidence: number;
  confidenceBand: ConfidenceBand;
};

/**
 * Generic Monte Carlo title simulation shared by Doubles and Shift Wars —
 * everything that differs between the two leagues (weights, whether a
 * fixed roster-strength feature exists, how opponent quality is computed)
 * is supplied by the caller as `simulatedStrength`; this function owns only
 * the mechanics common to both: activity-weighted pair selection, stake
 * sampling via the real lib/wager.ts mechanic, dynamic state/H2H updates,
 * and 8.7's end-state championship credit (including the two-way tiebreak
 * and 3+-way equal split).
 */
async function runTeamTitleSimulation(params: {
  seasonId: number;
  cutoff: Date;
  simulationCount: number;
  rng: () => number;
  teams: { id: number; name: string; startingPoints: number; startingWins: number; startingLosses: number; startingRecentForm: ("W" | "L")[]; startingEliminated: boolean }[];
  activityProfile: { currentDailyRate: number; historicalDailyRate: number | null; elapsedDays: number; matchesThisSeason: number; positiveStakes: number[]; participantAppearances: { participantId: number; matchesPlayed: number }[] };
  h2hSeedFor: (lowId: number, highId: number) => Promise<PairH2HState>;
  simulatedStrength: SimulatedStrengthFn;
}): Promise<TeamTitlePrediction> {
  const { seasonId, cutoff, simulationCount, rng, teams, activityProfile, simulatedStrength } = params;
  if (teams.length < 2) {
    throw new Error("runTeamTitleSimulation: need at least 2 teams to simulate a title race");
  }

  const teamIds = teams.map(t => t.id).sort((a, b) => a - b);
  const teamById = new Map(teams.map(t => [t.id, t]));

  const daysRemaining = daysRemainingInMonth(cutoff);
  const dailyRate = leagueDailyRate(activityProfile.currentDailyRate, activityProfile.historicalDailyRate);

  const h2hSeed = new Map<string, PairH2HState>();
  let maxPairMeetings = 0;
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      const lowId = teamIds[i], highId = teamIds[j];
      const seed = await params.h2hSeedFor(lowId, highId);
      h2hSeed.set(pairKey(lowId, highId), seed);
      if (seed.games > maxPairMeetings) maxPairMeetings = seed.games;
    }
  }

  const propensities = new Map<number, number>();
  for (const a of activityProfile.participantAppearances) propensities.set(a.participantId, activityPropensity(a.matchesPlayed));
  for (const id of teamIds) if (!propensities.has(id)) propensities.set(id, activityPropensity(0));

  const championshipCredits = new Map<number, number>(teamIds.map(id => [id, 0]));

  for (let simIdx = 0; simIdx < simulationCount; simIdx++) {
    const state = new Map<number, SimTeamState>();
    for (const t of teams) {
      state.set(t.id, {
        points: t.startingPoints, wins: t.startingWins, losses: t.startingLosses,
        recentForm: [...t.startingRecentForm], isEliminated: t.startingEliminated,
      });
    }
    const h2h = new Map<string, PairH2HState>();
    for (const [k, v] of h2hSeed) h2h.set(k, { ...v });

    const futureMatchCount = poissonSample(dailyRate * daysRemaining, rng);

    for (let m = 0; m < futureMatchCount; m++) {
      const activeParticipants = teamIds.filter(id => !state.get(id)!.isEliminated);
      if (activeParticipants.length < 2) break;

      const pairs: WeightedPair[] = [];
      for (let i = 0; i < activeParticipants.length; i++) {
        for (let j = i + 1; j < activeParticipants.length; j++) {
          const lowId = activeParticipants[i], highId = activeParticipants[j];
          const meetings = h2h.get(pairKey(lowId, highId))?.games ?? 0;
          const factor = pairFrequencyFactor(meetings, maxPairMeetings);
          pairs.push({ a: lowId, b: highId, weight: pairWeight(propensities.get(lowId)!, propensities.get(highId)!, factor) });
        }
      }
      const picked = sampleWeightedPair(pairs, rng);
      if (!picked) break;
      const { a: lowId, b: highId } = picked;

      const seed = h2h.get(pairKey(lowId, highId))!;
      const lowState = state.get(lowId)!, highState = state.get(highId)!;
      const strengthLow = simulatedStrength(lowId, lowState, highState, seed.lowWins, seed.games, lowState.wins + lowState.losses);
      const strengthHigh = simulatedStrength(highId, highState, lowState, seed.highWins, seed.games, highState.wins + highState.losses);
      const { pA } = pairProbability(strengthLow, strengthHigh);
      const lowWinsMatch = rng() < pA;

      const winnerId = lowWinsMatch ? lowId : highId;
      const loserId = lowWinsMatch ? highId : lowId;
      const winnerState = state.get(winnerId)!;
      const loserState = state.get(loserId)!;

      const maxStake = getMaxStake(winnerState, loserState);
      const stake = sampleStake(activityProfile.positiveStakes, maxStake, rng);
      const { newWinnerPoints, newLoserPoints, loserEliminated } = applyWager(stake, winnerState, loserState);

      winnerState.points = newWinnerPoints;
      loserState.points = newLoserPoints;
      loserState.isEliminated = loserState.isEliminated || loserEliminated;
      winnerState.wins++;
      loserState.losses++;
      winnerState.recentForm = (["W", ...winnerState.recentForm] as ("W" | "L")[]).slice(0, 10);
      loserState.recentForm = (["L", ...loserState.recentForm] as ("W" | "L")[]).slice(0, 10);

      if (winnerId === lowId) seed.lowWins++; else seed.highWins++;
      seed.games++;
    }

    let maxPoints = -Infinity;
    for (const id of teamIds) maxPoints = Math.max(maxPoints, state.get(id)!.points);
    const leaders = teamIds.filter(id => state.get(id)!.points === maxPoints);

    if (leaders.length === 1) {
      championshipCredits.set(leaders[0], championshipCredits.get(leaders[0])! + 1);
    } else if (leaders.length === 2) {
      const [lowId, highId] = leaders[0] < leaders[1] ? [leaders[0], leaders[1]] : [leaders[1], leaders[0]];
      const seed = h2h.get(pairKey(lowId, highId))!;
      const lowState = state.get(lowId)!, highState = state.get(highId)!;
      const strengthLow = simulatedStrength(lowId, lowState, highState, seed.lowWins, seed.games, lowState.wins + lowState.losses);
      const strengthHigh = simulatedStrength(highId, highState, lowState, seed.highWins, seed.games, highState.wins + highState.losses);
      const { pA } = pairProbability(strengthLow, strengthHigh);
      const winner = rng() < pA ? lowId : highId;
      championshipCredits.set(winner, championshipCredits.get(winner)! + 1);
    } else {
      const share = 1 / leaders.length;
      for (const id of leaders) championshipCredits.set(id, championshipCredits.get(id)! + share);
    }
  }

  const probabilities: TitleProbability[] = teamIds
    .map(id => {
      const probability = championshipCredits.get(id)! / simulationCount;
      return { teamId: id, name: teamById.get(id)!.name, probability, displayPercentage: Math.round(probability * 100) };
    })
    .sort((x, y) => y.probability - x.probability);

  const confidence = titleConfidenceScore({
    elapsedDays: activityProfile.elapsedDays,
    daysRemaining,
    matchesThisSeason: activityProfile.matchesThisSeason,
    currentDailyRate: activityProfile.currentDailyRate,
    historicalDailyRate: activityProfile.historicalDailyRate,
  });

  return {
    seasonId, generatedAt: cutoff, simulationCount, daysRemaining,
    leagueDailyRate: dailyRate, probabilities,
    confidence, confidenceBand: confidenceBand(confidence),
  };
}

// ── Doubles Event ────────────────────────────────────────────────────────

type DoublesTeamRow = { id: number; team_name: string };

function initialDoublesTeamState(): TeamState {
  return {
    points: DOUBLES_STARTING_POINTS, elo: DOUBLES_STARTING_ELO,
    wins: 0, losses: 0, currentWinStreak: 0, currentLossStreak: 0, recentForm: [], isEliminated: false,
  };
}

export async function predictDoublesTitle(
  seasonId: number,
  opts?: { simulationCount?: number; cutoff?: Date; rng?: () => number },
): Promise<TeamTitlePrediction> {
  const cutoff = opts?.cutoff ?? new Date();
  const simulationCount = opts?.simulationCount ?? DEFAULT_SIMULATION_COUNT;
  const rng = opts?.rng ?? Math.random;

  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.id, seasonId)).limit(1);
  if (!season || season.leagueType !== "doubles") {
    throw new Error(`predictDoublesTitle: season ${seasonId} is not a doubles season`);
  }
  if (season.endDate) {
    throw new Error(`predictDoublesTitle: season ${seasonId} has already ended — nothing left to predict`);
  }

  // Team EXISTENCE and names still come from the live table (a team with
  // zero matches all season wouldn't appear in any reconstructed timeline
  // at all), but every piece of team STATE — points, wins/losses, recent
  // form, elimination — is read off the real reconstructed timeline via
  // teamStateAsOf, the same way team-match-predictor.ts does it, rather
  // than trusted from the table's own live columns. This isn't just
  // consistency for its own sake: doubles_teams has no recent-form column
  // at all, so reading state straight off the table would leave recent
  // form fabricated as empty for every team on every simulation run, when
  // the real recent-form history is already fully reconstructable.
  const [activityProfile, teamRows, timeline] = await Promise.all([
    buildLeagueActivityProfile("doubles", seasonId, cutoff),
    db.execute(sql`SELECT id, team_name FROM doubles_teams WHERE season_id = ${seasonId}`).then(r => r.rows as DoublesTeamRow[]),
    buildDoublesTeamTimeline(seasonId),
  ]);

  const startingStateById = new Map<number, TeamState>();
  const rosterStrengthById = new Map<number, number | null>();
  const opponentQualityById = new Map<number, number | null>();
  for (const t of teamRows) {
    startingStateById.set(t.id, teamStateAsOf(timeline, t.id, cutoff, initialDoublesTeamState()));

    const roster = await getDoublesTeamRoster(t.id);
    const rosterBaselines = await Promise.all(roster.map(playerId => buildPlayerBaselines(playerId, cutoff)));
    rosterStrengthById.set(t.id, rosterBaselines.length > 0
      ? rosterBaselines.reduce((sum, b) => sum + smoothedRate(b.career.wins, b.career.gamesPlayed, PRIOR_GAMES.career), 0) / rosterBaselines.length
      : null);
    opponentQualityById.set(t.id, await computeDoublesOpponentQuality(t.id, seasonId, cutoff));
  }

  const simulatedStrength: SimulatedStrengthFn = (teamId, sim, _opponent, h2hWins, h2hGames, simGamesPlayed) => {
    const recordRate = smoothedRate(sim.wins, sim.wins + sim.losses, PRIOR_GAMES.season);
    const recentForm = recentFormScore(sim.recentForm, recordRate);
    const h2hRate = h2hGames > 0 ? smoothedRate(h2hWins, h2hGames, PRIOR_GAMES.h2h) : null;
    const weights = doublesWeights(simGamesPlayed);
    const strength = weightedAverageWithRedistribution([
      { weight: weights.teamRecord, value: recordRate },
      { weight: weights.recentForm, value: recentForm },
      { weight: weights.h2h, value: h2hRate },
      { weight: weights.opponentQuality, value: opponentQualityById.get(teamId) ?? null },
      { weight: weights.rosterStrength, value: rosterStrengthById.get(teamId) ?? null },
    ]);
    return strength ?? 0.5;
  };

  return runTeamTitleSimulation({
    seasonId, cutoff, simulationCount, rng,
    teams: teamRows.map(t => {
      const state = startingStateById.get(t.id)!;
      return {
        id: t.id, name: t.team_name, startingPoints: state.points,
        startingWins: state.wins, startingLosses: state.losses,
        startingRecentForm: state.recentForm, startingEliminated: state.isEliminated,
      };
    }),
    activityProfile,
    h2hSeedFor: async (lowId, highId) => {
      const h2h = await buildDoublesTeamH2HBefore(lowId, highId, cutoff, seasonId);
      return { lowWins: h2h.aWins, highWins: h2h.bWins, games: h2h.gamesPlayed };
    },
    simulatedStrength,
  });
}

// ── Shift Wars ───────────────────────────────────────────────────────────

type ShiftWarsTeamRow = { id: number; name: string };

export async function predictShiftWarsTitle(
  opts?: { simulationCount?: number; cutoff?: Date; rng?: () => number; seasonId?: number },
): Promise<TeamTitlePrediction> {
  const cutoff = opts?.cutoff ?? new Date();
  const simulationCount = opts?.simulationCount ?? DEFAULT_SIMULATION_COUNT;
  const rng = opts?.rng ?? Math.random;
  const seasonId = opts?.seasonId ?? await resolveShiftWarsSeasonForCutoff(cutoff);

  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.id, seasonId)).limit(1);
  if (!season || season.leagueType !== "shift_wars") {
    throw new Error(`predictShiftWarsTitle: season ${seasonId} is not a shift_wars season`);
  }
  if (season.endDate) {
    throw new Error(`predictShiftWarsTitle: season ${seasonId} has already ended — nothing left to predict`);
  }

  // Same reasoning as Doubles above: team existence/name from the live
  // table, but points/wins/losses/recentForm/isEliminated from the real
  // reconstructed timeline (teamStateAsOf), not the table's own live
  // columns — shift_wars_teams has no recent-form column at all, so this
  // is the only way to start a simulation run with real recent form
  // instead of fabricating an empty history for every team.
  const [activityProfile, teamRows, timeline, startingPointsByTeam] = await Promise.all([
    buildLeagueActivityProfile("shift_wars", seasonId, cutoff),
    db.execute(sql`SELECT id, name FROM shift_wars_teams`).then(r => r.rows as ShiftWarsTeamRow[]),
    buildShiftWarsTeamTimeline(seasonId, cutoff),
    getShiftWarsStartingPoints(),
  ]);

  const initialState = (teamId: number): TeamState => ({
    points: startingPointsByTeam.get(teamId) ?? 0, elo: null,
    wins: 0, losses: 0, currentWinStreak: 0, currentLossStreak: 0, recentForm: [], isEliminated: false,
  });
  const startingStateById = new Map<number, TeamState>();
  for (const t of teamRows) startingStateById.set(t.id, teamStateAsOf(timeline, t.id, cutoff, initialState(t.id)));

  // No fixed component at all here (see module header) — opponent quality
  // is the actual opponent's own dynamic record, taken straight from the
  // `opponent` state the shared engine always supplies, and recomputed
  // fresh every simulated match since that opponent's record keeps moving
  // through the simulation.
  const simulatedStrength: SimulatedStrengthFn = (_teamId, sim, opponent, h2hWins, h2hGames) => {
    const recordRate = smoothedRate(sim.wins, sim.wins + sim.losses, PRIOR_GAMES.season);
    const recentForm = recentFormScore(sim.recentForm, recordRate);
    const h2hRate = h2hGames > 0 ? smoothedRate(h2hWins, h2hGames, PRIOR_GAMES.h2h) : null;
    const opponentMomentum = smoothedRate(opponent.wins, opponent.wins + opponent.losses, PRIOR_GAMES.season);
    const strength = weightedAverageWithRedistribution([
      { weight: SHIFT_WARS_WEIGHTS.teamRecord, value: recordRate },
      { weight: SHIFT_WARS_WEIGHTS.recentForm, value: recentForm },
      { weight: SHIFT_WARS_WEIGHTS.h2h, value: h2hRate },
      { weight: SHIFT_WARS_WEIGHTS.opponentQuality, value: opponentMomentum },
    ]);
    return strength ?? 0.5;
  };

  return runTeamTitleSimulation({
    seasonId, cutoff, simulationCount, rng,
    teams: teamRows.map(t => {
      const state = startingStateById.get(t.id)!;
      return {
        id: t.id, name: t.name, startingPoints: state.points,
        startingWins: state.wins, startingLosses: state.losses,
        startingRecentForm: state.recentForm, startingEliminated: state.isEliminated,
      };
    }),
    activityProfile,
    h2hSeedFor: async (lowId, highId) => {
      const h2h = await buildShiftWarsTeamH2HBefore(lowId, highId, cutoff);
      return { lowWins: h2h.aWins, highWins: h2h.bWins, games: h2h.gamesPlayed };
    },
    simulatedStrength,
  });
}
