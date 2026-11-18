import { replay, toWin, type X01Format } from "../../shared/darts-rules/x01.ts";

/**
 * Dart-by-dart statistics from the matches you threw yourself (every dart is stored). Steel-tip X01 only: straight in,
 * double out, standard bull. Soft-tip, double-in and cricket legs are left out because their numbers aren't comparable.
 * The player is side 0 in every stored match (live Career matches and money matches both replay that way).
 *
 * Definitions, as darts statisticians use them:
 * - a checkout attempt is a dart thrown while your score is a finishable double (2-40 even, or 50 for the bull);
 *   it's a hit when that dart wins the leg;
 * - first-9 average: the average of your first three visits of each leg;
 * - a deciding leg is one both players need to win the set (or match).
 */
export type StoredMatch = { format: X01Format; firstThrower: 0 | 1; darts: unknown[]; source: "TOURNAMENT" | "MONEY_MATCH" };

export type DoubleStat = { double: string; attempts: number; hits: number; percent: number | null };
export type DartStats = {
  matches: number; legsPlayed: number; legsWon: number; darts: number;
  average: number | null; first9Average: number | null;
  tons: { "100+": number; "140+": number; "180": number };
  checkout: { attempts: number; hits: number; percent: number | null; highest: number | null;
    bySize: { upTo40: number; from41To100: number; over100: number } };
  doubles: DoubleStat[];
  favouriteDouble: DoubleStat | null;
  weakestDouble: DoubleStat | null;
  bestLeg: number | null;
  deciders: { played: number; won: number; average: number | null };
  /** Fewest attempts at one double before it can be called favourite or weakest. */
  minimumAttempts: number;
};

const MIN_ATTEMPTS = 6;
const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (hits: number, attempts: number) => attempts ? round1(hits / attempts * 100) : null;
const comparable = (f: X01Format) => f.inRule === "STRAIGHT" && f.outRule === "DOUBLE" && (f.bull ?? "STANDARD") === "STANDARD" && !f.mix && !f.roundLimit;
const doubleName = (score: number) => score === 50 ? "Bull" : `D${score / 2}`;
const finishable = (score: number) => score === 50 || (score >= 2 && score <= 40 && score % 2 === 0);

export function dartStats(matches: readonly StoredMatch[]): DartStats {
  let played = 0, legsPlayed = 0, legsWon = 0, darts = 0, points = 0, first9Points = 0, first9Darts = 0;
  let attempts = 0, hits = 0, highest: number | null = null, bestLeg: number | null = null;
  const tons = { "100+": 0, "140+": 0, "180": 0 }, bySize = { upTo40: 0, from41To100: 0, over100: 0 };
  const perDouble = new Map<string, { attempts: number; hits: number }>();
  const deciders = { played: 0, won: 0, points: 0, darts: 0 };
  for (const match of matches) {
    if (!comparable(match.format)) continue;
    let state;
    try { state = replay(match.format, match.firstThrower, match.darts as never); } catch { continue; }
    if (!state.complete) continue;
    played++;
    // Deciding legs: both sides one leg from the set (or, in legs play, the match).
    const need = match.format.unit === "SETS" ? toWin(match.format.bestOfLegsPerSet) : toWin(match.format.bestOfLegs);
    const decidingLegNos = new Set<number>();
    const inSet = new Map<number, [number, number]>();
    for (const leg of state.legsLog) {
      if (leg.game === "CRICKET") continue;
      const before = inSet.get(leg.setNo) ?? [0, 0];
      if (before[0] === need - 1 && before[1] === need - 1) { decidingLegNos.add(leg.legNo); deciders.played++; if (leg.winner === 0) deciders.won++; }
      inSet.set(leg.setNo, leg.winner === 0 ? [before[0] + 1, before[1]] : [before[0], before[1] + 1]);
      legsPlayed++;
      if (leg.winner === 0) {
        legsWon++;
        if (match.format.startingScore === 501 && (bestLeg === null || leg.darts[0] < bestLeg)) bestLeg = leg.darts[0];
      }
    }
    const visitsInLeg = new Map<number, number>();
    for (const visit of state.visits) {
      if (visit.thrower !== 0 || visit.game === "CRICKET") continue;
      const n = (visitsInLeg.get(visit.legNo) ?? 0) + 1;
      visitsInLeg.set(visit.legNo, n);
      darts += visit.darts.length; points += visit.points;
      if (n <= 3) { first9Points += visit.points; first9Darts += visit.darts.length; }
      if (decidingLegNos.has(visit.legNo)) { deciders.points += visit.points; deciders.darts += visit.darts.length; }
      if (visit.points >= 180) tons["180"]++; else if (visit.points >= 140) tons["140+"]++; else if (visit.points >= 100) tons["100+"]++;
      if (visit.checkout) {
        highest = Math.max(highest ?? 0, visit.points);
        if (visit.points <= 40) bySize.upTo40++; else if (visit.points <= 100) bySize.from41To100++; else bySize.over100++;
      }
      // Walk the visit dart by dart to find each dart thrown at a finishing double.
      let score = visit.startScore;
      for (const dart of visit.darts) {
        if (finishable(score)) {
          const name = doubleName(score), hit = dart.multiplier === 2 && dart.value === score;
          const d = perDouble.get(name) ?? { attempts: 0, hits: 0 };
          d.attempts++; attempts++;
          if (hit) { d.hits++; hits++; }
          perDouble.set(name, d);
          if (hit) break;
        }
        const next = score - dart.value;
        if (next < 0 || next === 1 || (next === 0 && dart.multiplier !== 2)) break; // bust ends the visit
        score = next;
      }
    }
  }
  const doubles: DoubleStat[] = [...perDouble].map(([double, d]) => ({ double, attempts: d.attempts, hits: d.hits, percent: pct(d.hits, d.attempts) }))
    .sort((a, b) => b.attempts - a.attempts || a.double.localeCompare(b.double));
  const qualified = doubles.filter(d => d.attempts >= MIN_ATTEMPTS);
  const byPercent = [...qualified].sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0) || b.attempts - a.attempts);
  return {
    matches: played, legsPlayed, legsWon, darts,
    average: darts ? round1(points * 3 / darts) : null,
    first9Average: first9Darts ? round1(first9Points * 3 / first9Darts) : null,
    tons, checkout: { attempts, hits, percent: pct(hits, attempts), highest, bySize },
    doubles,
    favouriteDouble: byPercent[0] ?? null,
    weakestDouble: byPercent.length > 1 ? byPercent[byPercent.length - 1]! : null,
    bestLeg,
    deciders: { played: deciders.played, won: deciders.won, average: deciders.darts ? round1(deciders.points * 3 / deciders.darts) : null },
    minimumAttempts: MIN_ATTEMPTS,
  };
}
