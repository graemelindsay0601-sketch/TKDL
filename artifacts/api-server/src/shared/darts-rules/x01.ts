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

import { resolveBullUp, type BullThrow } from "./bull-up.ts";
import { applyCricketDart, copyCricket, cricketWon, emptyCricket, CRICKET_ROUND_LIMIT, type CricketBoard } from "./cricket.ts";

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
/**
 * Soft-tip (electronic board) options, absent for steel-tip:
 *  - bull "FAT": the outer and inner bull both score 50 and both count as a finishing (and opening) dart;
 *  - roundLimit: if neither player has checked out after this many visits each, the leg is decided by a
 *    cork (one dart each at the bull, nearest wins; same ring = re-throw in reverse order), as in the
 *    DARTSLIVE rulebook. The leg starter corks first.
 */
/**
 *  - mix "SOFT_TIP": a soft-tip tournament match mixing games leg by leg, as DARTSLIVE events do —
 *    01, Cricket, Cricket, 01, … and a deciding Choice leg: a cork, then the cork winner picks the game
 *    and the other player throws first. 01 legs use the 01 rules above; Cricket legs are standard
 *    cricket with a 20-round limit (higher points wins; level points go to a cork).
 */
export type SoftTipRules = { bull?: "STANDARD" | "FAT"; roundLimit?: number; mix?: "SOFT_TIP" };
export type LegGame = "X01" | "CRICKET";
/** Recorded choice for a Choice leg (a dart in the log so a match stays one replayable dart sequence). */
export const CHOICE_DARTS: Record<LegGame, Dart> = { X01: { segment: 1, multiplier: 1, value: 1, label: "01" }, CRICKET: { segment: 2, multiplier: 1, value: 2, label: "Cricket" } };
const MIX_PATTERN: LegGame[] = ["X01", "CRICKET", "CRICKET", "X01"];
/** The game of leg `legNo` (1-based) in a mixed soft-tip match; "CHOICE" for the deciding leg. */
export function legGameFor(format: Pick<X01Format, "mix" | "unit"> & { bestOfLegs?: number }, legNo: number): LegGame | "CHOICE" {
  if (format.mix !== "SOFT_TIP" || format.unit !== "LEGS") return "X01";
  return legNo === format.bestOfLegs ? "CHOICE" : MIX_PATTERN[(legNo - 1) % MIX_PATTERN.length];
}
export type X01Format = SoftTipRules & (
  | { startingScore: number; inRule: InRule; outRule: OutRule; unit: "LEGS"; bestOfLegs: number }
  | { startingScore: number; inRule: InRule; outRule: OutRule; unit: "SETS"; bestOfSets: number; bestOfLegsPerSet: number });

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
  if (format.bull !== undefined && !["STANDARD", "FAT"].includes(format.bull)) throw new Error("Invalid bull rule");
  if (format.roundLimit !== undefined && !(Number.isInteger(format.roundLimit) && format.roundLimit >= 1 && format.roundLimit <= 50)) throw new Error("Invalid round limit");
  if (format.mix !== undefined && (format.mix !== "SOFT_TIP" || format.unit !== "LEGS")) throw new Error("Mixed soft-tip matches are played in legs");
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
  /** Cricket legs: the game, and the board at the start of the visit (bot verification replans from it). */
  game?: LegGame; startBoard?: CricketBoard;
  thrower: PlayerIdx; setNo: number; legNo: number; darts: Dart[];
  /** Points actually deducted (0 for a bust or an unopened visit). */
  points: number; startScore: number; endScore: number;
  bust: boolean; checkout: boolean; openedDuringVisit: boolean;
  /** Whether the thrower was already opened when this visit began (double-in). */
  startOpened: boolean;
};
export type LegRecord = { setNo: number; legNo: number; legInSet: number; starter: PlayerIdx; winner: PlayerIdx; darts: [number, number]; checkout: number; cork?: boolean; game?: LegGame };
/** A round-limit cork in progress: throws in order (leg starter first; re-throws reverse the order). */
export type CorkState = { starter: PlayerIdx; throws: BullThrow[]; darts: Dart[] };

export type X01MatchState = {
  format: X01Format; firstThrower: PlayerIdx;
  setNo: number; legNo: number; legInSet: number;
  setStarter: PlayerIdx; legStarter: PlayerIdx; turn: PlayerIdx;
  scores: [number, number]; opened: [boolean, boolean];
  /** Legs won in the current set (SETS) or in the match (LEGS). */
  legs: [number, number]; sets: [number, number]; totalLegs: [number, number];
  visit: { thrower: PlayerIdx; darts: Dart[]; startScore: number; startOpened: boolean } | null;
  visits: VisitRecord[]; legsLog: LegRecord[];
  /** Soft-tip round limit reached: the leg is being decided by a cork. */
  cork: CorkState | null;
  /** Cork darts of completed legs (kept apart from visits so averages are unaffected). */
  corkLog: { legNo: number; darts: Dart[] }[];
  /** Mixed soft-tip matches: the current leg's game, the cricket board, and a Choice leg being decided. */
  game: LegGame; cricket: CricketBoard;
  choice: { starter: PlayerIdx; throws: BullThrow[]; darts: Dart[]; picker: PlayerIdx | null } | null;
  choiceLog: { legNo: number; darts: Dart[]; game: LegGame; picker: PlayerIdx }[];
  dartsThrown: number; legDarts: [number, number];
  complete: boolean; winner: PlayerIdx | null;
};

export type DartOutcome = "UNOPENED" | "OPENED" | "SCORED" | "VISIT_END" | "BUST" | "LEG_WON" | "SET_WON" | "MATCH_WON" | "ROUND_LIMIT" | "CORK" | "CHOICE_CORK" | "CHOICE";

export function createMatch(format: X01Format, firstThrower: PlayerIdx): X01MatchState {
  validateFormat(format);
  if (firstThrower !== 0 && firstThrower !== 1) throw new Error("Invalid first thrower");
  const open = format.inRule === "STRAIGHT";
  const s: X01MatchState = {
    format, firstThrower, setNo: 1, legNo: 1, legInSet: 1,
    setStarter: firstThrower, legStarter: firstThrower, turn: firstThrower,
    scores: [format.startingScore, format.startingScore], opened: [open, open],
    legs: [0, 0], sets: [0, 0], totalLegs: [0, 0], visit: null, visits: [], legsLog: [], cork: null, corkLog: [],
    game: "X01", cricket: emptyCricket(), choice: null, choiceLog: [],
    dartsThrown: 0, legDarts: [0, 0], complete: false, winner: null,
  };
  startLegGame(s);
  return s;
}

const copy = (s: X01MatchState): X01MatchState => ({
  ...s, scores: [...s.scores] as [number, number], opened: [...s.opened] as [boolean, boolean],
  legs: [...s.legs] as [number, number], sets: [...s.sets] as [number, number], totalLegs: [...s.totalLegs] as [number, number],
  legDarts: [...s.legDarts] as [number, number],
  visit: s.visit ? { ...s.visit, darts: [...s.visit.darts] } : null, visits: s.visits.slice(), legsLog: s.legsLog.slice(),
  cork: s.cork ? { ...s.cork, throws: [...s.cork.throws], darts: [...s.cork.darts] } : null, corkLog: s.corkLog.slice(),
  cricket: copyCricket(s.cricket), choice: s.choice ? { ...s.choice, throws: [...s.choice.throws], darts: [...s.choice.darts] } : null, choiceLog: s.choiceLog.slice(),
});

/** Set up the current leg's game (mixed soft-tip matches); a Choice leg starts with its cork. */
function startLegGame(s: X01MatchState) {
  const g = legGameFor(s.format as X01Format & { bestOfLegs?: number }, s.legNo);
  s.cricket = emptyCricket();
  if (g === "CHOICE") { s.game = "X01"; s.choice = { starter: s.legStarter, throws: [], darts: [], picker: null }; s.turn = s.legStarter; }
  else s.game = g;
}

/** Fat bull: any bull is scored as the 50, which also finishes (and opens) like a double. */
export const normaliseDart = (d: Dart, format: Pick<X01Format, "bull">): Dart =>
  format.bull === "FAT" && d.segment === 25 && d.multiplier === 1 ? { segment: 25, multiplier: 2, value: 50, label: "Bull" } : d;
/** A cork dart is recorded as a bull dart: inner (50), outer (25) or a miss. */
export const corkDart = (t: BullThrow): Dart => t === "INNER" ? { segment: 25, multiplier: 2, value: 50, label: "DB" } : t === "OUTER" ? { segment: 25, multiplier: 1, value: 25, label: "Bull" } : { segment: 0, multiplier: 1, value: 0, label: "Miss" };
const corkThrow = (d: Dart): BullThrow => d.segment === 25 ? (d.multiplier === 2 ? "INNER" : "OUTER") : "MISS";

/** Close the visit, then start a cork when both players have used the leg's round limit. */
function endVisit(s: X01MatchState, p: PlayerIdx, bust: boolean): DartOutcome {
  if (s.game === "CRICKET") closeCricketVisit(s); else closeVisit(s, { bust, checkout: false });
  s.turn = other(p);
  const limit = s.game === "CRICKET" ? CRICKET_ROUND_LIMIT : s.format.roundLimit;
  if (limit && ([0, 1] as PlayerIdx[]).every(q => s.visits.filter(v => v.legNo === s.legNo && v.thrower === q).length >= limit)) {
    // Cricket at its round limit: higher points wins; level points go to a cork.
    if (s.game === "CRICKET" && s.cricket.points[0] !== s.cricket.points[1]) return finishLeg(s, s.cricket.points[0] > s.cricket.points[1] ? 0 : 1);
    s.cork = { starter: s.legStarter, throws: [], darts: [] };
    s.turn = s.legStarter;
    return "ROUND_LIMIT";
  }
  return bust ? "BUST" : "VISIT_END";
}

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

function closeCricketVisit(s: X01MatchState) {
  const v = s.visit!;
  s.visits.push({ thrower: v.thrower, setNo: s.setNo, legNo: s.legNo, darts: v.darts, points: s.cricket.points[v.thrower] - v.startScore,
    startScore: v.startScore, endScore: s.cricket.points[v.thrower], bust: false, checkout: false, openedDuringVisit: false, startOpened: true,
    game: "CRICKET", startBoard: (v as typeof v & { startBoard?: CricketBoard }).startBoard });
  s.visit = null;
}
function throwCricketDart(s: X01MatchState, p: PlayerIdx, dart: Dart): { state: X01MatchState; outcome: DartOutcome } {
  if (!s.visit) s.visit = Object.assign({ thrower: p, darts: [] as Dart[], startScore: s.cricket.points[p], startOpened: true }, { startBoard: copyCricket(s.cricket) });
  s.visit.darts.push(dart);
  s.dartsThrown++; s.legDarts[p]++;
  applyCricketDart(s.cricket, p, dart);
  if (cricketWon(s.cricket, p)) { closeCricketVisit(s); return { state: s, outcome: finishLeg(s, p) }; }
  if (s.visit.darts.length === 3) return { state: s, outcome: endVisit(s, p, false) };
  return { state: s, outcome: "SCORED" };
}

/** Apply one dart. Throws on an invalid dart or a dart after the match is over. */
export function throwDart(prev: X01MatchState, input: unknown): { state: X01MatchState; outcome: DartOutcome } {
  if (prev.complete) throw new Error("Match is already complete");
  const raw = validateDart(input);
  if (!raw) throw new Error("Invalid dart");
  const s = copy(prev);
  const f = s.format;
  const p = s.turn;
  if (s.cork) {
    // Cork: one dart each at the bull (the board's segment is ignored; only the bull rings count).
    if (raw.segment !== 0 && raw.segment !== 25) throw new Error("A cork dart is recorded as inner bull, outer bull or a miss");
    s.cork.throws.push(corkThrow(raw)); s.cork.darts.push(raw); s.dartsThrown++;
    const result = resolveBullUp(s.cork.starter, s.cork.throws);
    if (result.winner === null) { s.turn = result.nextThrower!; return { state: s, outcome: "CORK" }; }
    s.corkLog.push({ legNo: s.legNo, darts: s.cork.darts });
    s.cork = null;
    return { state: s, outcome: finishLeg(s, result.winner, true) };
  }
  if (s.choice) {
    // Choice leg: a cork, then the cork winner's pick of game (recorded as a choice dart); the other player throws first.
    if (s.choice.picker === null) {
      if (raw.segment !== 0 && raw.segment !== 25) throw new Error("A cork dart is recorded as inner bull, outer bull or a miss");
      s.choice.throws.push(corkThrow(raw)); s.choice.darts.push(raw); s.dartsThrown++;
      const result = resolveBullUp(s.choice.starter, s.choice.throws);
      if (result.winner === null) { s.turn = result.nextThrower!; return { state: s, outcome: "CHOICE_CORK" }; }
      s.choice.picker = result.winner; s.turn = result.winner;
      return { state: s, outcome: "CHOICE_CORK" };
    }
    const game = (Object.keys(CHOICE_DARTS) as LegGame[]).find(g => CHOICE_DARTS[g].segment === raw.segment && raw.multiplier === 1);
    if (!game) throw new Error("A choice is recorded as the 01 or Cricket choice dart");
    const picker = s.choice.picker;
    s.choiceLog.push({ legNo: s.legNo, darts: [...s.choice.darts, raw], game, picker });
    s.choice = null; s.game = game; s.dartsThrown++;
    s.legStarter = other(picker); s.turn = other(picker);
    return { state: s, outcome: "CHOICE" };
  }
  if (s.game === "CRICKET") return throwCricketDart(s, p, raw);
  const dart = normaliseDart(raw, f);
  if (!s.visit) s.visit = { thrower: p, darts: [], startScore: s.scores[p], startOpened: s.opened[p] };
  s.visit.darts.push(dart);
  s.dartsThrown++; s.legDarts[p]++;
  let outcome: DartOutcome = "SCORED";

  if (!s.opened[p]) {
    if (!opensLeg(dart, f.inRule)) {
      // Dart order matters: a non-opening dart scores nothing, whatever follows.
      if (s.visit.darts.length === 3) return { state: s, outcome: endVisit(s, p, false) };
      return { state: s, outcome: "UNOPENED" };
    }
    s.opened[p] = true; // the opening dart itself scores
    outcome = "OPENED";
  }

  const remaining = s.scores[p] - dart.value;
  if (remaining < 0 || isDeadScore(remaining, f.outRule) || (remaining === 0 && !isValidFinish(dart, f.outRule))) {
    s.scores[p] = remaining; // transient; closeVisit restores the start-of-visit score
    return { state: s, outcome: endVisit(s, p, true) };
  }
  s.scores[p] = remaining;
  if (remaining === 0) {
    closeVisit(s, { bust: false, checkout: true });
    return { state: s, outcome: finishLeg(s, p) };
  }
  if (s.visit.darts.length === 3) return { state: s, outcome: endVisit(s, p, false) };
  return { state: s, outcome };
}

function finishLeg(s: X01MatchState, winner: PlayerIdx, cork = false): DartOutcome {
  const f = s.format;
  const checkoutVisit = s.visits[s.visits.length - 1];
  const cricket = s.game === "CRICKET";
  s.legsLog.push({ setNo: s.setNo, legNo: s.legNo, legInSet: s.legInSet, starter: s.legStarter, winner, darts: [...s.legDarts] as [number, number],
    checkout: cork || cricket ? 0 : checkoutVisit.startScore, ...(cork ? { cork: true } : {}), ...(f.mix ? { game: s.game } : {}) });
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
  startLegGame(s);
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
  for (const c of state.corkLog) n += c.darts.length;
  for (const c of state.choiceLog) n += c.darts.length;
  return n;
}

/** Visits a given player has started so far (used to key deterministic bot visits). */
export const visitsBy = (state: X01MatchState, player: PlayerIdx) => state.visits.filter(v => v.thrower === player).length + (state.visit?.thrower === player ? 1 : 0);

export function describeFormat(f: X01Format): string {
  const rules = `${f.startingScore} ${f.inRule === "STRAIGHT" ? "straight-in" : f.inRule === "DOUBLE" ? "double-in" : "master-in"} ${f.outRule.toLowerCase()}-out`
    + (f.bull === "FAT" ? ", fat bull" : "") + (f.roundLimit ? `, ${f.roundLimit}-round limit (cork decides)` : "")
    + (f.mix === "SOFT_TIP" ? ", mixed with Cricket legs and a deciding Choice leg" : "");
  return f.unit === "LEGS" ? `${rules}, best of ${f.bestOfLegs} legs` : `${rules}, best of ${f.bestOfSets} sets (best of ${f.bestOfLegsPerSet} legs per set)`;
}
