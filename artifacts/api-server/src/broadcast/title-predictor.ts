// TKDL LIVE — Open-Wager Title Predictor for Singles (handover doc section
// 8). Runs a Monte Carlo simulation of the rest of the calendar month
// (there's no fixture list — 8.1) and reports each active player's share of
// simulated championships.
//
// FIXED vs DYNAMIC per simulated player, per 8.6 ("Career history and
// stored darts-performance baselines remain fixed... update current-season
// W/L, recent form, points and elimination state after every simulated
// result"):
//   FIXED (computed once from real data, shared read-only across all
//   simulation runs): career rate, darts-performance {weight,value}.
//   Opponent quality isn't mentioned in either the doc's fixed or dynamic
//   list — recomputing it properly would mean averaging over SIMULATED
//   opponents' own simulated states, which is exactly the kind of
//   compounding-error, doc-silent complexity the explicit fixed list
//   (career/darts) is clearly trying to keep out of the loop. This freezes
//   it at its pre-simulation snapshot for the same reason, and flags that
//   as a judgment call rather than a literal spec transcription.
//   DYNAMIC (reset fresh for every one of the simulationCount runs):
//   current-season win/loss record, recent form, points, elimination
//   state, and head-to-head counts (a natural extension of "current-season
//   W/L" — a new simulated meeting between two players who've already met
//   is exactly a new current-season H2H result).
import { eq } from "drizzle-orm";
import { db, playersTable, seasonsTable } from "@workspace/db";
import { applyWager, getMaxStake } from "../lib/wager";
import { buildPlayerBaselines, buildH2HBefore, buildLeagueActivityProfile } from "./history-reconstruction";
import { buildGameTypeCohort, dartsFeature, computeOpponentQuality, WEIGHTS } from "./match-predictor";
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

const DEFAULT_GAME_TYPE = "501"; // matches match-predictor.ts's own predictSinglesMatch default

function pairKey(lowId: number, highId: number): string {
  return `${lowId}-${highId}`;
}

type FixedPlayerBaseline = {
  playerId: number;
  name: string;
  careerRate: number;
  darts: { weight: number; value: number | null };
  opponentQualityFixed: number | null;
};

type SimPlayerState = {
  points: number;
  wins: number;
  losses: number;
  recentResults: ("W" | "L")[]; // newest first, capped at 10
  isEliminated: boolean;
};

type PairH2HState = { lowWins: number; highWins: number; games: number };

/**
 * The Match Predictor's own strength formula (7.1-7.6), but fed FIXED
 * pre-simulation baseline pieces plus THIS simulation run's own dynamic
 * state, instead of a fresh DB read — there's no real darts/opponent data
 * for a hypothetical future match, so recomputing those from the DB every
 * simulated match isn't just slow, it's meaningless. See the module header
 * for exactly what's fixed vs dynamic.
 */
function simulatedStrength(fixed: FixedPlayerBaseline, sim: SimPlayerState, h2hWins: number, h2hGames: number): number {
  const seasonRate = smoothedRate(sim.wins, sim.wins + sim.losses, PRIOR_GAMES.season);
  const recentForm = recentFormScore(sim.recentResults, seasonRate);
  const h2hRate = h2hGames > 0 ? smoothedRate(h2hWins, h2hGames, PRIOR_GAMES.h2h) : null;

  const strength = weightedAverageWithRedistribution([
    { weight: WEIGHTS.currentSeason, value: seasonRate },
    { weight: WEIGHTS.recentForm, value: recentForm },
    { weight: WEIGHTS.career, value: fixed.careerRate },
    { weight: WEIGHTS.h2h, value: h2hRate },
    { weight: fixed.darts.weight, value: fixed.darts.value },
    { weight: WEIGHTS.opponentQuality, value: fixed.opponentQualityFixed },
  ]);
  return strength ?? 0.5; // defensive floor -- unreachable in practice, same reasoning as match-predictor.ts
}

export type SinglesTitleProbability = {
  playerId: number;
  name: string;
  /** Raw simulation share, full precision (0..1) — for internal storage/comparison. */
  probability: number;
  /** Rounded whole percentage for public display, per 8.8. */
  displayPercentage: number;
};

export type SinglesTitlePrediction = {
  seasonId: number;
  generatedAt: Date;
  simulationCount: number;
  daysRemaining: number;
  leagueDailyRate: number;
  probabilities: SinglesTitleProbability[];
  confidence: number;
  confidenceBand: ConfidenceBand;
};

export async function predictSinglesTitle(
  seasonId: number,
  opts?: { simulationCount?: number; cutoff?: Date; rng?: () => number },
): Promise<SinglesTitlePrediction> {
  const cutoff = opts?.cutoff ?? new Date();
  const simulationCount = opts?.simulationCount ?? DEFAULT_SIMULATION_COUNT;
  const rng = opts?.rng ?? Math.random;

  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.id, seasonId)).limit(1);
  if (!season || season.leagueType !== "singles") {
    throw new Error(`predictSinglesTitle: season ${seasonId} is not a singles season`);
  }
  if (season.endDate) {
    throw new Error(`predictSinglesTitle: season ${seasonId} has already ended — nothing left to predict`);
  }

  const [activityProfile, players] = await Promise.all([
    buildLeagueActivityProfile("singles", seasonId, cutoff),
    db.select().from(playersTable).where(eq(playersTable.isActive, true)),
  ]);
  if (players.length < 2) {
    throw new Error("predictSinglesTitle: need at least 2 active players to simulate a title race");
  }

  const daysRemaining = daysRemainingInMonth(cutoff);
  const dailyRate = leagueDailyRate(activityProfile.currentDailyRate, activityProfile.historicalDailyRate);
  const cohort = await buildGameTypeCohort(DEFAULT_GAME_TYPE, cutoff);

  // Sorted once so every pair drawn later is naturally (lowId, highId) —
  // keeps the H2H state map's key convention unambiguous throughout.
  const activeIds = players.map(p => p.id).sort((a, b) => a - b);

  const fixed = new Map<number, FixedPlayerBaseline>();
  const startingState = new Map<number, SimPlayerState>();
  for (const p of players) {
    const baselines = await buildPlayerBaselines(p.id, cutoff, seasonId);
    fixed.set(p.id, {
      playerId: p.id,
      name: p.name,
      careerRate: smoothedRate(baselines.career.wins, baselines.career.gamesPlayed, PRIOR_GAMES.career),
      darts: dartsFeature(baselines, cohort),
      opponentQualityFixed: await computeOpponentQuality(p.id, seasonId, cutoff),
    });
    startingState.set(p.id, {
      points: p.points,
      wins: baselines.currentSeason?.wins ?? 0,
      losses: baselines.currentSeason?.losses ?? 0,
      recentResults: [...baselines.recentResults],
      isEliminated: p.points === 0,
    });
  }

  // Real historical H2H + pair-meeting counts, gathered once and reused
  // (as a starting seed, not a shared mutable) across every simulation run.
  const h2hSeed = new Map<string, PairH2HState>();
  let maxPairMeetings = 0;
  for (let i = 0; i < activeIds.length; i++) {
    for (let j = i + 1; j < activeIds.length; j++) {
      const lowId = activeIds[i], highId = activeIds[j];
      const h2h = await buildH2HBefore(lowId, highId, cutoff);
      h2hSeed.set(pairKey(lowId, highId), { lowWins: h2h.aWins, highWins: h2h.bWins, games: h2h.gamesPlayed });
      if (h2h.gamesPlayed > maxPairMeetings) maxPairMeetings = h2h.gamesPlayed;
    }
  }

  const propensities = new Map<number, number>();
  for (const a of activityProfile.participantAppearances) propensities.set(a.participantId, activityPropensity(a.matchesPlayed));
  for (const id of activeIds) if (!propensities.has(id)) propensities.set(id, activityPropensity(0));

  const championshipCredits = new Map<number, number>(activeIds.map(id => [id, 0]));

  for (let sim = 0; sim < simulationCount; sim++) {
    const state = new Map<number, SimPlayerState>();
    for (const [id, s] of startingState) state.set(id, { ...s, recentResults: [...s.recentResults] });
    const h2h = new Map<string, PairH2HState>();
    for (const [k, v] of h2hSeed) h2h.set(k, { ...v });

    const futureMatchCount = poissonSample(dailyRate * daysRemaining, rng);

    for (let m = 0; m < futureMatchCount; m++) {
      const activeParticipants = activeIds.filter(id => !state.get(id)!.isEliminated);
      if (activeParticipants.length < 2) break; // no valid pair left this run — remaining scheduled matches simply don't happen

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
      const strengthLow = simulatedStrength(fixed.get(lowId)!, state.get(lowId)!, seed.lowWins, seed.games);
      const strengthHigh = simulatedStrength(fixed.get(highId)!, state.get(highId)!, seed.highWins, seed.games);
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
      loserState.isEliminated = loserEliminated;
      winnerState.wins++;
      loserState.losses++;
      winnerState.recentResults = (["W", ...winnerState.recentResults] as ("W" | "L")[]).slice(0, 10);
      loserState.recentResults = (["L", ...loserState.recentResults] as ("W" | "L")[]).slice(0, 10);

      if (winnerId === lowId) seed.lowWins++; else seed.highWins++;
      seed.games++;
    }

    // 8.7: end-state championship credit.
    let maxPoints = -Infinity;
    for (const id of activeIds) maxPoints = Math.max(maxPoints, state.get(id)!.points);
    const leaders = activeIds.filter(id => state.get(id)!.points === maxPoints);

    if (leaders.length === 1) {
      championshipCredits.set(leaders[0], championshipCredits.get(leaders[0])! + 1);
    } else if (leaders.length === 2) {
      // Two-way tie: one-off no-stake tiebreak. "Using the Match Predictor"
      // is read as reusing its probability MACHINERY over this run's own
      // simulated end-state (which is all that exists for a hypothetical
      // future tie) rather than a fresh real-data DB round-trip mid-sim.
      const [lowId, highId] = leaders[0] < leaders[1] ? [leaders[0], leaders[1]] : [leaders[1], leaders[0]];
      const seed = h2h.get(pairKey(lowId, highId))!;
      const strengthLow = simulatedStrength(fixed.get(lowId)!, state.get(lowId)!, seed.lowWins, seed.games);
      const strengthHigh = simulatedStrength(fixed.get(highId)!, state.get(highId)!, seed.highWins, seed.games);
      const { pA } = pairProbability(strengthLow, strengthHigh);
      const winner = rng() < pA ? lowId : highId;
      championshipCredits.set(winner, championshipCredits.get(winner)! + 1);
    } else {
      // Three-or-more-way tie: split credit equally — the real multi-way
      // tiebreak format isn't documented (8.7).
      const share = 1 / leaders.length;
      for (const id of leaders) championshipCredits.set(id, championshipCredits.get(id)! + share);
    }
  }

  const probabilities: SinglesTitleProbability[] = activeIds
    .map(id => {
      const probability = championshipCredits.get(id)! / simulationCount;
      return {
        playerId: id,
        name: fixed.get(id)!.name,
        probability,
        displayPercentage: Math.round(probability * 100),
      };
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
    seasonId,
    generatedAt: cutoff,
    simulationCount,
    daysRemaining,
    leagueDailyRate: dailyRate,
    probabilities,
    confidence,
    confidenceBand: confidenceBand(confidence),
  };
}
