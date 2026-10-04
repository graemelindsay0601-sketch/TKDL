/**
 * Canonical X01 match rules shared by the TKDL scorer (browser) and the Career
 * server (result verification). Pure, deterministic, dependency-free.
 *
 * A match is fully described by (format, firstThrower, dart sequence). Who threw
 * each dart, every leg/set boundary, busts, opening state and the winner are all
 * DERIVED by replaying the darts — nothing is trusted from a client except the
 * darts themselves.
 *
 * Player indices are 0 and 1. `firstThrower` is whoever won the bull-up (or the
 * authored first-throw method) and throws first in leg 1 of set 1.
 */

export type Dart = { segment: number; multiplier: 1 | 2 | 3; value: number; label?: string; ring?: "inner" | "outer" };
export type PlayerIdx = 0 | 1;
export type InRule = "STRAIGHT" | "DOUBLE" | "MASTER";
export type OutRule = "STRAIGHT" | "DOUBLE" | "MASTER" | "TREBLE" | "BULL";

/**
 * Match length is always expressed as BEST-OF numbers, exactly as authored:
 * LEGS: best of `bestOfLegs` legs (first to ceil(n/2)).
 * SETS: best of `bestOfSets` sets, each set best of `bestOfLegsPerSet` legs.
 * Never confuse best-of with "to win": bestOfSets 5 means 3 sets to win.
 */
export type X01Format =
  | { startingScore: number; inRule: InRule; outRule: OutRule; unit: "LEGS"; bestOfLegs: number }
  | { startingScore: number; inRule: InRule; outRule: OutRule; unit: "SETS"; bestOfSets: number; bestOfLegsPerSet: number };

export const MISS: Dart = Object.freeze({ segment: 0, multiplier: 1, value: 0, label: "Miss" }) as Dart;
export const other = (p: PlayerIdx): PlayerIdx => (p === 0 ? 1 : 0);
export const toWin = (bestOf: number) => Math.floor(bestOf / 2) + 1;

export function validateFormat(format: X01Format): X01Format {
  const odd = (n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 101 && (n as number) % 2 === 1;
  if (!Number.isInteger(format.startingScore) || format.startingScore < 2 || format.startingScore > 3001) throw new Error("Invalid starting score");
  if (!["STRAIGHT", "DOUBLE", "MASTER"].includes(format.inRule)) throw new Error("Invalid in rule");
  if (!["STRAIGHT", "DOUBLE", "MASTER", "TREBLE", "BULL"].includes(format.outRule)) throw new Error("Invalid out rule");
  if (format.unit === "LEGS") { if (!odd(format.bestOfLegs)) throw new Error("bestOfLegs must be odd"); }
  else if (format.unit === "SETS") { if (!odd(format.bestOfSets) || !odd(format.bestOfLegsPerSet)) throw new Error("Set best-of values must be odd"); }
  else throw new Error("Invalid scoring unit");
  return format;
}

/** Rejects anything a real dart cannot be: canonical value, multiplier and segment only. */
export function validateDart(input: unknown): Dart | null {
  if (!input || typeof input !== "object") return null;
  const d = input as Partial<Dart>;
  const segment = d.segment, multiplier = d.multiplier, value = d.value;
  if (!Number.isInteger(segment) || !Number.isInteger(multiplier) || !Number.isInteger(value)) return null;
  if (segment === 0) return value === 0 && multiplier === 1 ? { segment: 0, multiplier: 1, value: 0, label: "Miss" } : null;
  if (segment === 25) {
    if (multiplier === 1 && value === 25) return { segment: 25, multiplier: 1, value: 25, label: "Bull" };
    if (multiplier === 2 && value === 50) return { segment: 25, multiplier: 2, value: 50, label: "DB" };
    return null;
  }
  if (segment! < 1 || segment! > 20 || ![1, 2, 3].includes(multiplier!) || value !== segment! * multiplier!) return null;
  const label = multiplier === 3 ? `T${segment}` : multiplier === 2 ? `D${segment}` : String(segment);
  return { segment: segment!, multiplier: multiplier as 1 | 2 | 3, value: value!, label };
}

/** Inner bull (50) is a double for both opening and finishing, as in standard darts. */
export const isDouble = (d: Dart) => d.multiplier === 2;
export const isTreble = (d: Dart) => d.multiplier === 3 && d.segment !== 25;

export function opensLeg(d: Dart, inRule: InRule): boolean {
  if (inRule === "STRAIGHT") return true;
  if (inRule === "DOUBLE") return isDouble(d);
  return isDouble(d) || isTreble(d); // MASTER in
}

export function isValidFinish(d: Dart, outRule: OutRule): boolean {
  switch (outRule) {
    case "STRAIGHT": return d.value > 0;
    case "DOUBLE": return isDouble(d);
    case "MASTER": return isDouble(d) || isTreble(d);
    case "TREBLE": return isTreble(d);
    case "BULL": return d.segment === 25 && d.multiplier === 2;
  }
}

/** A remaining score from which the out rule can never finish: landing on it is a bust. */
export function isDeadScore(remaining: number, outRule: OutRule): boolean {
  if (remaining <= 0) return false;
  switch (outRule) {
    case "STRAIGHT": return false;
    case "DOUBLE": case "MASTER": return remaining === 1;
    case "TREBLE": return remaining < 3;
    case "BULL": return remaining < 50;
  }
}

export type VisitRecord = {
  thrower: PlayerIdx; setNo: number; legNo: number; darts: Dart[];
  /** Points actually deducted (0 for a bust or an unopened visit). */
  points: number; startScore: number; endScore: number;
  bust: boolean; checkout: boolean; openedDuringVisit: boolean;
  /** Whether the thrower was already opened when this visit began (double-in). */
  startOpened: boolean;
};
export type LegRecord = { setNo: number; legNo: number; legInSet: number; starter: PlayerIdx; winner: PlayerIdx; darts: [number, number]; checkout: number };

export type X01MatchState = {
  format: X01Format; firstThrower: PlayerIdx;
  setNo: number; legNo: number; legInSet: number;
  setStarter: PlayerIdx; legStarter: PlayerIdx; turn: PlayerIdx;
  scores: [number, number]; opened: [boolean, boolean];
  /** Legs won in the current set (SETS) or in the match (LEGS). */
  legs: [number, number]; sets: [number, number]; totalLegs: [number, number];
  visit: { thrower: PlayerIdx; darts: Dart[]; startScore: number; startOpened: boolean } | null;
  visits: VisitRecord[]; legsLog: LegRecord[];
  dartsThrown: number; legDarts: [number, number];
  complete: boolean; winner: PlayerIdx | null;
};

export type DartOutcome = "UNOPENED" | "OPENED" | "SCORED" | "VISIT_END" | "BUST" | "LEG_WON" | "SET_WON" | "MATCH_WON";

export function createMatch(format: X01Format, firstThrower: PlayerIdx): X01MatchState {
  validateFormat(format);
  if (firstThrower !== 0 && firstThrower !== 1) throw new Error("Invalid first thrower");
  const open = format.inRule === "STRAIGHT";
  return {
    format, firstThrower, setNo: 1, legNo: 1, legInSet: 1,
    setStarter: firstThrower, legStarter: firstThrower, turn: firstThrower,
    scores: [format.startingScore, format.startingScore], opened: [open, open],
    legs: [0, 0], sets: [0, 0], totalLegs: [0, 0], visit: null, visits: [], legsLog: [],
    dartsThrown: 0, legDarts: [0, 0], complete: false, winner: null,
  };
}

const copy = (s: X01MatchState): X01MatchState => ({
  ...s, scores: [...s.scores] as [number, number], opened: [...s.opened] as [boolean, boolean],
  legs: [...s.legs] as [number, number], sets: [...s.sets] as [number, number], totalLegs: [...s.totalLegs] as [number, number],
  legDarts: [...s.legDarts] as [number, number],
  visit: s.visit ? { ...s.visit, darts: [...s.visit.darts] } : null, visits: s.visits.slice(), legsLog: s.legsLog.slice(),
});

/**
 * Starter convention (professional darts): legs alternate; in set play the first
 * leg of each set alternates by set, and legs alternate within the set.
 */
export function starterFor(format: X01Format, firstThrower: PlayerIdx, setNo: number, legInSet: number): { setStarter: PlayerIdx; legStarter: PlayerIdx } {
  const setStarter = (setNo % 2 === 1 ? firstThrower : other(firstThrower));
  const base = format.unit === "SETS" ? setStarter : firstThrower;
  return { setStarter, legStarter: legInSet % 2 === 1 ? base : other(base) };
}

function closeVisit(s: X01MatchState, opts: { bust: boolean; checkout: boolean }) {
  const v = s.visit!;
  const p = v.thrower;
  if (opts.bust) { s.scores[p] = v.startScore; s.opened[p] = v.startOpened; }
  s.visits.push({ thrower: p, setNo: s.setNo, legNo: s.legNo, darts: v.darts, points: opts.bust ? 0 : v.startScore - s.scores[p],
    startScore: v.startScore, endScore: s.scores[p], bust: opts.bust, checkout: opts.checkout, openedDuringVisit: !opts.bust && !v.startOpened && s.opened[p], startOpened: v.startOpened });
  s.visit = null;
}

/** Apply one dart. Throws on an invalid dart or a dart after the match is over. */
export function throwDart(prev: X01MatchState, input: unknown): { state: X01MatchState; outcome: DartOutcome } {
  if (prev.complete) throw new Error("Match is already complete");
  const dart = validateDart(input);
  if (!dart) throw new Error("Invalid dart");
  const s = copy(prev);
  const f = s.format;
  const p = s.turn;
  if (!s.visit) s.visit = { thrower: p, darts: [], startScore: s.scores[p], startOpened: s.opened[p] };
  s.visit.darts.push(dart);
  s.dartsThrown++; s.legDarts[p]++;
  let outcome: DartOutcome = "SCORED";

  if (!s.opened[p]) {
    if (!opensLeg(dart, f.inRule)) {
      // Dart order matters: a non-opening dart scores nothing, whatever follows.
      if (s.visit.darts.length === 3) { closeVisit(s, { bust: false, checkout: false }); s.turn = other(p); return { state: s, outcome: "VISIT_END" }; }
      return { state: s, outcome: "UNOPENED" };
    }
    s.opened[p] = true; // the opening dart itself scores
    outcome = "OPENED";
  }

  const remaining = s.scores[p] - dart.value;
  if (remaining < 0 || isDeadScore(remaining, f.outRule) || (remaining === 0 && !isValidFinish(dart, f.outRule))) {
    s.scores[p] = remaining; // transient; closeVisit restores the start-of-visit score
    closeVisit(s, { bust: true, checkout: false });
    s.turn = other(p);
    return { state: s, outcome: "BUST" };
  }
  s.scores[p] = remaining;
  if (remaining === 0) {
    closeVisit(s, { bust: false, checkout: true });
    return { state: s, outcome: finishLeg(s, p) };
  }
  if (s.visit.darts.length === 3) { closeVisit(s, { bust: false, checkout: false }); s.turn = other(p); return { state: s, outcome: "VISIT_END" }; }
  return { state: s, outcome };
}

function finishLeg(s: X01MatchState, winner: PlayerIdx): DartOutcome {
  const f = s.format;
  const checkoutVisit = s.visits[s.visits.length - 1];
  s.legsLog.push({ setNo: s.setNo, legNo: s.legNo, legInSet: s.legInSet, starter: s.legStarter, winner, darts: [...s.legDarts] as [number, number], checkout: checkoutVisit.startScore });
  s.legs[winner]++; s.totalLegs[winner]++;
  let outcome: DartOutcome = "LEG_WON";
  if (f.unit === "LEGS") {
    if (s.legs[winner] >= toWin(f.bestOfLegs)) { s.complete = true; s.winner = winner; return "MATCH_WON"; }
    s.legInSet++;
  } else if (s.legs[winner] >= toWin(f.bestOfLegsPerSet)) {
    s.sets[winner]++;
    if (s.sets[winner] >= toWin(f.bestOfSets)) { s.complete = true; s.winner = winner; return "MATCH_WON"; }
    s.setNo++; s.legInSet = 1; s.legs = [0, 0];
    outcome = "SET_WON";
  } else s.legInSet++;
  s.legNo++;
  const st = starterFor(f, s.firstThrower, s.setNo, s.legInSet);
  s.setStarter = st.setStarter; s.legStarter = st.legStarter; s.turn = st.legStarter;
  const open = f.inRule === "STRAIGHT";
  s.scores = [f.startingScore, f.startingScore]; s.opened = [open, open]; s.legDarts = [0, 0];
  return outcome;
}

/** Deterministic replay of a full or partial dart log. Throws on the first invalid dart. */
export function replay(format: X01Format, firstThrower: PlayerIdx, darts: readonly unknown[]): X01MatchState {
  let s = createMatch(format, firstThrower);
  darts.forEach((d, i) => {
    try { s = throwDart(s, d).state; } catch (error) { throw new Error(`Dart ${i + 1}: ${(error as Error).message}`); }
  });
  return s;
}

/** Number of darts that belong to completed legs (the part of a log that can never be rewritten). */
export function settledDartCount(state: X01MatchState): number {
  let n = 0;
  for (const v of state.visits) if (v.legNo < state.legNo || state.complete) n += v.darts.length;
  return n;
}

/** Visits a given player has started so far (used to key deterministic bot visits). */
export const visitsBy = (state: X01MatchState, player: PlayerIdx) => state.visits.filter(v => v.thrower === player).length + (state.visit?.thrower === player ? 1 : 0);

export function describeFormat(f: X01Format): string {
  const rules = `${f.startingScore} ${f.inRule === "STRAIGHT" ? "straight-in" : f.inRule === "DOUBLE" ? "double-in" : "master-in"} ${f.outRule.toLowerCase()}-out`;
  return f.unit === "LEGS" ? `${rules}, best of ${f.bestOfLegs} legs` : `${rules}, best of ${f.bestOfSets} sets (best of ${f.bestOfLegsPerSet} legs per set)`;
}
