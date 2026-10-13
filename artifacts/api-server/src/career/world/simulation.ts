import type { CareerDifficulty } from "../config.ts";
import { CAREER_SIMULATION_CONFIG as S, CAREER_WORLD_CONFIG as W, SIMULATION_VERSION } from "./config.ts";
import { scopedRandom, normal, pick, type Random } from "./random.ts";
import { resolveBullUp, botBullThrow, type BullThrow } from "../../shared/darts-rules/bull-up.ts";
import { applyCricketDart, cricketAim, cricketWon, emptyCricket, CRICKET_ROUND_LIMIT } from "../../shared/darts-rules/cricket.ts";
import { legGameFor, type LegGame } from "../../shared/darts-rules/x01.ts";
import { createPerformance, finishingProbability } from "./performance.ts";
import { assertGenerationVersion } from "./generation.ts";
import { clamp, matchContextSchema, matchFormatSchema, npcSchema, type Npc, type MatchContext, type MatchFormat, type MatchStats, type SimulatedMatch, type Performance } from "./types.ts";

type Dart = { score: number; double: boolean; treble?: boolean };
type Aim = { segment: number; multiplier: 1 | 2 | 3 };
const BOARD = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const scoringTargets: Aim[] = [20, 19, 18, 17, 16, 15].map(segment => ({ segment, multiplier: 3 }));
const setupTargets: Aim[] = [...scoringTargets, ...Array.from({ length: 20 }, (_, i): Aim => ({ segment: 20 - i, multiplier: 1 })), { segment: 25, multiplier: 1 }];
// Precompute legal double-out routes. This is a numerical simulator, not a scorer/UI fork.
const checkout = new Map<string, Aim>();
for (let darts = 1; darts <= 3; darts++) {
  for (let remaining = 2; remaining <= 170; remaining++) {
    if (remaining <= 40 && remaining % 2 === 0) checkout.set(`${remaining}:${darts}`, { segment: remaining / 2, multiplier: 2 });
    else if (remaining === 50) checkout.set(`${remaining}:${darts}`, { segment: 25, multiplier: 2 });
    else if (darts > 1) {
      const aim = setupTargets.find(target => checkout.has(`${remaining - target.segment * target.multiplier}:${darts - 1}`));
      if (aim) checkout.set(`${remaining}:${darts}`, aim);
    }
  }
}

// Soft-tip master out with a fat bull: a leg can finish on a double, a treble or the (fat) bull.
const softFinisher = (v: number): Aim | null => v === 50 ? { segment: 25, multiplier: 2 } : v <= 60 && v % 3 === 0 ? { segment: v / 3, multiplier: 3 }
  : v <= 40 && v % 2 === 0 ? { segment: v / 2, multiplier: 2 } : null;
const softCheckout = new Map<string, Aim>();
for (let darts = 1; darts <= 3; darts++) {
  for (let remaining = 2; remaining <= 180; remaining++) {
    const direct = softFinisher(remaining);
    if (direct) softCheckout.set(`${remaining}:${darts}`, direct);
    else if (darts > 1) {
      const aim = setupTargets.filter(t => t.segment !== 25).find(target => softCheckout.has(`${remaining - target.segment * target.multiplier}:${darts - 1}`));
      if (aim) softCheckout.set(`${remaining}:${darts}`, aim);
    }
  }
}
function chooseSoftAim(remaining: number, dartsLeft: number): Aim {
  return softCheckout.get(`${remaining}:${dartsLeft}`) ?? (remaining > 60 ? { segment: 20, multiplier: 3 } : { segment: 1, multiplier: 1 });
}

function chooseAim(remaining: number, dartsLeft: number): Aim {
  const route = checkout.get(`${remaining}:${dartsLeft}`);
  if (route) return route;
  if (remaining > 60) return { segment: 20, multiplier: 3 };
  if (remaining > 40) return { segment: remaining % 2 === 0 ? remaining - 40 : remaining > 52 ? 19 : remaining - 32, multiplier: 1 };
  return { segment: 1, multiplier: 1 }; // odd small score: set up a double.
}

function throwDart(aim: Aim, profile: Performance, scoring: number, decisive: boolean, momentum: number, rng: Random, fatBull = false): Dart {
  const roll = rng();
  const neighbours = aim.segment === 25 ? [5, 20, 1] : [BOARD[(BOARD.indexOf(aim.segment) + 19) % 20], BOARD[(BOARD.indexOf(aim.segment) + 1) % 20]];
  if (fatBull && aim.segment === 25) {
    // The fat bull (inner + outer, both 50) is a bigger target than any double.
    const chance = clamp(finishingProbability(profile, decisive, momentum, false) * S.fatBullFactor, 0, S.maximumHit);
    return roll < chance ? { score: 50, double: true } : { score: rng() < 0.5 ? pick(rng, neighbours) : 0, double: false };
  }
  if (aim.multiplier === 2) {
    const chance = finishingProbability(profile, decisive, momentum, aim.segment === 25);
    if (roll < chance) return { score: aim.segment * 2, double: true };
    // Misses are actual legal dart values, not a synthetic failed checkout.
    return { score: rng() < S.doubleMissSingleShare ? aim.segment : (rng() < 0.5 ? pick(rng, neighbours) : 0), double: false };
  }
  if (aim.multiplier === 3) {
    const treble = clamp(S.trebleBase + scoring * S.trebleScoringWeight + profile.effective.powerScoring * S.treblePowerWeight, 0, S.maximumHit);
    const single = S.trebleSingleBase + scoring * S.trebleSingleWeight;
    if (roll < treble) return { score: aim.segment * 3, double: false, treble: true };
    if (roll < treble + single) return { score: aim.segment, double: false };
    return { score: pick(rng, neighbours), double: false };
  }
  const accuracy = clamp(S.singleBase + scoring * S.singleWeight, S.minimumHit, S.maximumHit);
  return { score: roll < accuracy ? aim.segment : pick(rng, neighbours), double: false };
}

const emptyStats = (): MatchStats => ({ points: 0, darts: 0, average: 0, doubleAttempts: 0, checkouts: 0, checkoutPercentage: 0, maximums: 0, highestCheckout: 0, legsWon: 0 });

/**
 * Result follows legal darts, visits and repeated alternating-throw legs. No winner roll.
 * A6.5: also models double-in (the NPC must hit a double before any dart scores; the
 * opening dart scores) and set play (legs within sets; the first leg of each set
 * alternates by set, legs alternate within a set) — the same conventions as the
 * shared live scorer, so a human match and an NPC match mean the same thing.
 * The 501 straight-in legs path is unchanged dart-for-dart (same RNG scopes/order).
 */
export function simulateNpcMatch(input: {
  players: [Npc, Npc]; context: MatchContext; format: MatchFormat;
  seed: string; generationVersion: number; matchKey: string; difficulty: CareerDifficulty;
}): SimulatedMatch {
  const { players, seed, generationVersion, matchKey, difficulty } = input;
  assertGenerationVersion(generationVersion);
  const context = matchContextSchema.parse(input.context);
  const format = matchFormatSchema.parse(input.format);
  for (const player of players) { npcSchema.parse(player); if (player.status !== "ACTIVE") throw new Error("Cannot simulate a retired NPC"); }
  if (players[0].id === players[1].id) throw new Error("Match needs distinct NPCs");
  const performance = players.map(player => createPerformance(player, context, difficulty,
    scopedRandom(seed, generationVersion, "performance", SIMULATION_VERSION, matchKey, player.id))) as [Performance, Performance];
  const stats: [MatchStats, MatchStats] = [emptyStats(), emptyStats()];
  const legs: SimulatedMatch["legs"] = [];
  const momentum = [0, 0];
  const startingScore = format.startingScore ?? S.startingScore;
  const doubleIn = format.inRule === "DOUBLE";
  const soft = format.outRule === "MASTER";
  const sets = format.unit === "SETS";
  // LEGS: target legs in the match. SETS: target legs in a set and target sets in the match.
  const targetLegs = sets ? (format.legsPerSet! + 1) / 2 : (format.bestOf + 1) / 2;
  const targetSets = sets ? (format.bestOf + 1) / 2 : 1;
  const setsWon: [number, number] = [0, 0];
  let setLegs: [number, number] = [0, 0];
  let setNo = 1, legInSet = 1;
  /** Cork at the bull (round limits and Choice legs): nearest wins; the same ring re-throws in reverse order. */
  const corkWinner = (starter: 0 | 1, corkRng: Random): 0 | 1 => {
    const acc = (who: 0 | 1) => clamp(finishingProbability(performance[who], false, 0, true) * 2.5, 0, 1);
    const corkThrows: BullThrow[] = [];
    let cork = resolveBullUp(starter, corkThrows);
    while (cork.winner === null) { corkThrows.push(botBullThrow(acc(cork.nextThrower!), corkRng)); cork = resolveBullUp(starter, corkThrows); }
    return cork.winner;
  };
  /** Standard cricket leg (20-round limit, higher points then a cork), dart by dart from the same throwing model. */
  const cricketLeg = (firstThrow: 0 | 1, rng: [Random, Random], legIndex: number) => {
    const board = emptyCricket(), darts: [number, number] = [0, 0];
    let winner: 0 | 1 | null = null;
    for (let visit = 0; visit < CRICKET_ROUND_LIMIT * 2 && winner === null; visit++) {
      const who = ((firstThrow + visit) % 2) as 0 | 1, profile = performance[who], random = rng[who];
      const scoring = clamp(profile.effective.scoring + normal(random) * profile.visitSd + momentum[who], W.attributeMin, W.attributeMax);
      for (let k = 0; k < 3; k++) {
        const target = cricketAim(board, who);
        const thrown = throwDart(target === 25 ? { segment: 25, multiplier: 2 } : { segment: target, multiplier: 3 }, profile, scoring, false, momentum[who], random);
        darts[who]++;
        const landed = target === 25 ? (thrown.double ? { segment: 25, multiplier: 2 as const } : { segment: thrown.score, multiplier: 1 as const })
          : thrown.treble ? { segment: target, multiplier: 3 as const } : { segment: thrown.score, multiplier: 1 as const };
        applyCricketDart(board, who, landed);
        if (cricketWon(board, who)) { winner = who; break; }
      }
    }
    if (winner === null) winner = board.points[0] !== board.points[1] ? (board.points[0] > board.points[1] ? 0 : 1)
      : corkWinner(firstThrow, scopedRandom(seed, generationVersion, "cork", SIMULATION_VERSION, matchKey, legIndex));
    return { winner, darts, points: [board.points[0], board.points[1]] as [number, number] };
  };
  const matchOver = () => sets ? Math.max(...setsWon) >= targetSets : Math.max(stats[0].legsWon, stats[1].legsWon) >= targetLegs;
  while (!matchOver()) {
    const legIndex = legs.length;
    const legsHere: [number, number] = sets ? setLegs : [stats[0].legsWon, stats[1].legsWon];
    const setStarter = ((format.firstThrow + setNo - 1) % 2) as 0 | 1;
    let firstThrow = (sets ? (setStarter + legInSet - 1) % 2 : (format.firstThrow + legIndex) % 2) as 0 | 1;
    const rng = players.map(player => scopedRandom(seed, generationVersion, "darts", SIMULATION_VERSION, matchKey, legIndex, player.id));
    // Mixed soft-tip match: this leg's game (01 / Cricket), or a Choice leg decided by a cork.
    let game: LegGame = "X01";
    if (format.mix) {
      const g = legGameFor({ mix: format.mix, unit: "LEGS", bestOfLegs: format.bestOf }, legIndex + 1);
      if (g === "CHOICE") {
        const choiceRng = scopedRandom(seed, generationVersion, "choice-cork", SIMULATION_VERSION, matchKey, legIndex);
        const picker = corkWinner(firstThrow, choiceRng);
        game = choiceRng() < 0.5 ? "CRICKET" : "X01";
        firstThrow = (1 - picker) as 0 | 1;
      } else game = g;
    }
    if (game === "CRICKET") {
      const leg = cricketLeg(firstThrow, rng as [Random, Random], legIndex);
      stats[leg.winner].legsWon++;
      legs.push({ winner: leg.winner, firstThrow, checkout: 0, darts: leg.darts, points: leg.points });
      continue;
    }
    const remaining = [startingScore, startingScore] as number[];
    const opened = [!doubleIn, !doubleIn];
    const darts: [number, number] = [0, 0];
    const points: [number, number] = [0, 0];
    let won = false;
    const visitLimit = soft ? format.roundLimit! * 2 : S.maxVisitsPerLeg;
    for (let visit = 0; visit < visitLimit && !won; visit++) {
      const who = ((firstThrow + visit) % 2) as 0 | 1;
      const other = (1 - who) as 0 | 1;
      const before = remaining[who];
      const openedBefore = opened[who];
      const profile = performance[who];
      const random = rng[who];
      const lastSet = !sets || (setsWon[0] === targetSets - 1 && setsWon[1] === targetSets - 1);
      const decisive = lastSet && legsHere[0] === targetLegs - 1 && legsHere[1] === targetLegs - 1;
      const leverage = decisive || (remaining[other] <= 170 && (legsHere[who] === targetLegs - 1 || legsHere[other] === targetLegs - 1));
      const scoring = clamp(profile.effective.scoring + normal(random) * profile.visitSd + momentum[who], W.attributeMin, W.attributeMax);
      let visitPoints = 0, bust = false, missedDoubles = 0;
      for (let dart = 0; dart < 3; dart++) {
        if (!opened[who]) {
          // Double-in: aim at D20; only a double opens, and the opening dart scores.
          const thrown = throwDart({ segment: 20, multiplier: 2 }, profile, scoring, false, momentum[who], random);
          stats[who].darts++; darts[who]++;
          stats[who].openingAttempts = (stats[who].openingAttempts ?? 0) + 1;
          if (!thrown.double) continue;
          opened[who] = true;
          if (remaining[who] - thrown.score < 2) { bust = true; break; }
          remaining[who] -= thrown.score; visitPoints += thrown.score;
          continue;
        }
        const aim = soft ? chooseSoftAim(remaining[who], 3 - dart) : chooseAim(remaining[who], 3 - dart);
        const finishAttempt = soft ? aim.segment * aim.multiplier === remaining[who] && aim.multiplier > 1 : aim.multiplier === 2 && aim.segment * 2 === remaining[who];
        const thrown = throwDart(aim, profile, scoring, leverage, momentum[who], random, soft);
        stats[who].darts++; darts[who]++;
        if (finishAttempt) stats[who].doubleAttempts++;
        const next = remaining[who] - thrown.score;
        const validFinish = thrown.double || (soft && !!thrown.treble);
        if (next < 0 || next === 1 || (next === 0 && !validFinish)) { bust = true; if (finishAttempt) missedDoubles++; break; }
        remaining[who] = next;
        visitPoints += thrown.score;
        if (next === 0) {
          won = true;
          stats[who].legsWon++; stats[who].checkouts++;
          stats[who].highestCheckout = Math.max(stats[who].highestCheckout, before);
          momentum[who] += (before >= S.largeCheckout ? S.largeCheckoutMomentum : 0) + (who !== firstThrow ? S.breakMomentum : 0);
          break;
        }
        if (finishAttempt) missedDoubles++;
      }
      if (bust) { remaining[who] = before; visitPoints = 0; opened[who] = openedBefore; }
      stats[who].points += visitPoints; points[who] += visitPoints;
      if (visitPoints === 180) { stats[who].maximums++; momentum[who] += S.maximumMomentum; }
      momentum[who] = clamp(momentum[who] * S.momentumDecay - missedDoubles * S.missedDoubleMomentum, -S.momentumLimit, S.momentumLimit);
      if (won) {
        legs.push(sets ? { winner: who, firstThrow, checkout: before, darts, points, set: setNo } : { winner: who, firstThrow, checkout: before, darts, points });
        if (sets) {
          setLegs[who]++;
          if (setLegs[who] >= targetLegs) { setsWon[who]++; setNo++; legInSet = 1; setLegs = [0, 0]; }
          else legInSet++;
        }
      }
    }
    if (!won && soft) {
      // Round limit reached: a cork (one dart each at the bull; nearest wins; same ring re-throws in reverse order).
      const who = corkWinner(firstThrow, scopedRandom(seed, generationVersion, "cork", SIMULATION_VERSION, matchKey, legIndex));
      stats[who].legsWon++; won = true;
      legs.push(sets ? { winner: who, firstThrow, checkout: 0, darts, points, set: setNo } : { winner: who, firstThrow, checkout: 0, darts, points });
    }
    if (!won) throw new Error("NPC leg exceeded simulation safety limit; result not fabricated");
  }
  for (const row of stats) {
    row.average = row.points / row.darts * 3;
    row.checkoutPercentage = row.doubleAttempts ? row.checkouts / row.doubleAttempts * 100 : 0;
  }
  if (sets) { stats[0].setsWon = setsWon[0]; stats[1].setsWon = setsWon[1]; }
  const winner = sets ? (setsWon[0] === targetSets ? 0 : 1) : (stats[0].legsWon === targetLegs ? 0 : 1);
  return { simulationVersion: SIMULATION_VERSION, winnerId: players[winner].id, loserId: players[1 - winner].id,
    participants: [players[0].id, players[1].id], context, format, performance, stats, legs };
}
