/**
 * Turns a "visit total" (what a player types on the Visit total scorer) into
 * three real darts the X01 engine can replay. The engine, the dart log the
 * server re-checks, and every stat downstream stay dart-based; this only picks
 * plausible darts that add up to what was typed.
 *
 * Scoring visits use trebles, singles and bulls only (never doubles), so the
 * synthetic darts can't open, finish or fake a checkout by accident. A finish
 * is built from the darts the player says they used: set-up darts, then any
 * missed darts at a double (thrown as misses), then the finishing double.
 */
export type SynthDart = { segment: number; multiplier: 1 | 2 | 3; value: number; label: string };

const MISS: SynthDart = { segment: 0, multiplier: 1, value: 0, label: "Miss" };
const single = (n: number): SynthDart => ({ segment: n, multiplier: 1, value: n, label: String(n) });
const treble = (n: number): SynthDart => ({ segment: n, multiplier: 3, value: n * 3, label: `T${n}` });
const double = (n: number): SynthDart => n === 25
  ? { segment: 25, multiplier: 2, value: 50, label: "DB" }
  : { segment: n, multiplier: 2, value: n * 2, label: `D${n}` };
const OUTER_BULL: SynthDart = { segment: 25, multiplier: 1, value: 25, label: "Bull" };

// Most natural first: big trebles, the outer bull, singles, then a miss as filler.
const SCORING: SynthDart[] = [
  ...[20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(treble),
  OUTER_BULL,
  ...[20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(single),
];

/** Exactly `n` non-double darts adding up to `total` (misses fill the rest), or null. */
export function splitScoring(total: number, n: number): SynthDart[] | null {
  if (total === 0) return Array.from({ length: n }, () => MISS);
  if (n === 0 || total < 0) return null;
  for (const d of SCORING) {
    if (d.value > total) continue;
    const rest = splitScoring(total - d.value, n - 1);
    if (rest) return [d, ...rest];
  }
  return null;
}

/** Scores no three darts can make (e.g. 179). */
export function isPossibleVisit(total: number): boolean {
  if (!Number.isInteger(total) || total < 0 || total > 180) return false;
  return splitScoring(total, 3) !== null;
}

/** Three darts for a scoring (non-finishing) visit. */
export function scoringVisit(total: number): SynthDart[] | null {
  return splitScoring(total, 3);
}

// Preferred finishing doubles, most common first.
const DOUBLES = [20, 16, 18, 12, 10, 8, 19, 17, 15, 14, 13, 11, 9, 7, 6, 5, 4, 3, 2, 1, 25];

/**
 * A finish of `remaining` in `dartsUsed` darts, `atDouble` of them aimed at a
 * double (the last one hits; any others are misses). Straight-out games
 * (doubleOut false) just need darts that add up, with no double rule.
 */
export function finishVisit(remaining: number, dartsUsed: number, atDouble: number, doubleOut = true): SynthDart[] | null {
  if (dartsUsed < 1 || dartsUsed > 3) return null;
  if (!doubleOut) {
    // Any darts that add up; the last dart must not be a miss.
    for (const d of [...SCORING, ...DOUBLES.map(double)]) {
      if (d.value > remaining || d.value === 0) continue;
      const rest = remaining - d.value;
      const before = splitScoring(rest, dartsUsed - 1);
      if (before) return [...before, d];
    }
    return null;
  }
  if (atDouble < 1 || atDouble > dartsUsed) return null;
  const setupDarts = dartsUsed - atDouble;
  for (const n of DOUBLES) {
    const fin = double(n);
    const setup = remaining - fin.value;
    if (setup < 0) continue;
    // After the set-up the player must be on a double, so they never sit on 1 or bust on the way.
    const pre = splitScoring(setup, setupDarts);
    if (!pre) continue;
    if (setupDarts === 0 && setup !== 0) continue;
    return [...pre, ...Array.from({ length: atDouble - 1 }, () => MISS), fin];
  }
  return null;
}

/** Which (dartsUsed, atDouble) choices can finish `remaining`. */
export function finishOptions(remaining: number, doubleOut = true): { dartsUsed: number; atDouble: number }[] {
  const out: { dartsUsed: number; atDouble: number }[] = [];
  for (let u = 1; u <= 3; u++) {
    if (!doubleOut) { if (finishVisit(remaining, u, 1, false)) out.push({ dartsUsed: u, atDouble: 0 }); continue; }
    for (let a = 1; a <= u; a++) if (finishVisit(remaining, u, a, true)) out.push({ dartsUsed: u, atDouble: a });
  }
  return out;
}
