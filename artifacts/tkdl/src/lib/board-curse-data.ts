import type { CCEffect } from "./card-effect-engine";

export type CurseGameMode = "X01" | "CRICKET";
export type CurseTier = 1 | 2 | 3;

const X01_NUMBERS = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20];
const CRICKET_NUMBERS = [20,19,18,17,16,15,25];

function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}

/** Random integer in [min, max], inclusive — used so a curse's bite is never
 *  the exact same number twice, even on a repeat draw of the same curse. */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Random float in [min, max], rounded to 2dp. */
function randFloat(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

export interface CurseDef {
  id: string;
  name: string;
  gameMode: CurseGameMode;
  tier: CurseTier;
  // Builds the concrete effect fields — and a human-readable description of
  // the roll actually landed — fresh every time this curse is drawn, so
  // anything randomized (which number, how harsh) is re-rolled per strike
  // rather than frozen once at module load (a bug we already caught once
  // building Boss Battle's roster the same way), and so two draws of the
  // same curse don't feel identical. There's deliberately no static
  // description field — the only description that's ever shown is the one
  // returned by this call, matching whatever was actually rolled.
  build: () => { effect: Partial<CCEffect>; description: string };
}

function def(
  id: string, name: string, tier: CurseTier, gameMode: CurseGameMode,
  build: () => { effect: Partial<CCEffect>; description: string },
): CurseDef {
  return { id, name, tier, gameMode, build };
}

// ── X01 curses ───────────────────────────────────────────────────────────────
// A mix of flat value nerfs, dead-number tricks, lost darts, and — the more
// interesting category — checkout-interference curses that change how a
// finish plays out rather than just docking points.
const X01_CURSES: CurseDef[] = [
  // Tier 1 — mild
  def("off-night", "Off Night", 1, "X01", () => {
    const pct = randInt(80, 90);
    return { effect: { allDartsMultiplier: pct / 100 }, description: `Every dart is only worth ${pct}% of its real value.` };
  }),
  def("toll-booth", "Toll Booth", 1, "X01", () => {
    const n = randInt(3, 7);
    return { effect: { penaltyPerDart: n }, description: `Every dart costs you ${n} points, just for throwing it.` };
  }),
  def("dead-number", "Dead Number", 1, "X01", () => {
    const [num] = pickN(X01_NUMBERS, 1);
    return { effect: { segmentBlock: [num] }, description: `${num} is dead this visit — any hit on it scores 0.` };
  }),
  def("wandering-aim", "Wandering Aim", 1, "X01", () => ({
    effect: { segmentRedirect: true },
    description: "Your darts keep drifting to the number next door.",
  })),
  def("heavy-hands", "Heavy Hands", 1, "X01", () => ({
    effect: { noDoubleFinishFirstN: 2 },
    description: "Your first two darts this visit can't finish on a double, however close you are.",
  })),
  def("full-send", "Full Send", 1, "X01", () => ({
    effect: { preventFinishBefore3: true },
    description: "You can't finish this visit until your third dart, even if you're on it sooner.",
  })),

  // Tier 2 — medium
  def("weakened", "Weakened", 2, "X01", () => {
    const pct = randInt(55, 70);
    return { effect: { allDartsMultiplier: pct / 100 }, description: `Every dart is only worth ${pct}% of its real value.` };
  }),
  def("dead-zone", "Dead Zone", 2, "X01", () => {
    const n = randInt(2, 4);
    const nums = pickN(X01_NUMBERS, n);
    return { effect: { segmentBlock: nums }, description: `${nums.join(", ")} are dead this visit — any hit on them scores 0.` };
  }),
  def("flattened", "Flattened", 2, "X01", () => ({
    effect: { treblesAsSingles: true },
    description: "Every treble you hit counts as a single instead.",
  })),
  def("butter-fingers", "Butter Fingers", 2, "X01", () => ({
    effect: { doublesAsSingles: true },
    description: "Every double you hit counts as a single instead.",
  })),
  def("missing-dart", "Missing Dart", 2, "X01", () => ({
    effect: { wildDartIndex: Math.floor(Math.random() * 3) },
    description: "One of your three darts this visit goes wide and scores 0.",
  })),
  def("capped-visit", "Capped Visit", 2, "X01", () => {
    const cap = randInt(50, 65);
    return { effect: { maxVisitTotal: cap }, description: `However much you score this visit, it's capped at ${cap}.` };
  }),
  def("fading-fast", "Fading Fast", 2, "X01", () => ({
    effect: { fatigueMults: [1, 0.75, 0.5] },
    description: "Each dart this visit is worth less than the last — your third dart is worth half.",
  })),
  def("no-easy-points", "No Easy Points", 2, "X01", () => ({
    effect: { singlesScore0: true },
    description: "Only doubles and trebles score this visit — singles are worth 0.",
  })),
  def("choke", "Choke", 2, "X01", () => {
    const pct = randInt(60, 80);
    return { effect: { trebleMultiplier: pct / 100 }, description: `Every treble you hit this visit is worth only ${pct}% of its value.` };
  }),
  def("sunk-cost", "Sunk Cost", 2, "X01", () => {
    const n = randInt(15, 25);
    return { effect: { visitPenalty: n }, description: `Flat ${n} points come off whatever you score this visit, once it's totalled.` };
  }),

  // Tier 3 — severe
  def("shackled", "Shackled", 3, "X01", () => {
    const cap = randInt(20, 30);
    return { effect: { maxDartValue: cap }, description: `No single dart can score more than ${cap}.` };
  }),
  def("heavy-toll", "Heavy Toll", 3, "X01", () => {
    const n = randInt(10, 18);
    return { effect: { penaltyPerDart: n }, description: `Every dart costs you ${n} points, just for throwing it.` };
  }),
  def("tunnel-vision", "Tunnel Vision", 3, "X01", () => {
    const [num] = pickN(X01_NUMBERS, 1);
    return { effect: { lockdownSegment: num }, description: `Only ${num} scores anything this visit — everything else is worth 0.` };
  }),
  def("blackout", "Blackout", 3, "X01", () => {
    const n = randInt(2, 3);
    const nums = pickN(X01_NUMBERS, n);
    return { effect: { segmentOnly: nums }, description: `Only ${nums.join(", ")} score anything this visit — everything else is worth 0.` };
  }),
  def("two-lost-darts", "Two Lost Darts", 3, "X01", () => ({
    effect: { wildDartIndices: pickN([0, 1, 2], 2) },
    description: "Two of your three darts this visit go wide and score 0.",
  })),
  def("iron-cap", "Iron Cap", 3, "X01", () => {
    const cap = randInt(35, 45);
    return { effect: { maxVisitTotal: cap }, description: `However much you score this visit, it's capped at ${cap}.` };
  }),
  def("trapped", "Trapped", 3, "X01", () => ({
    effect: { mustFinishAfterOneDart: true },
    description: "If your first dart this visit isn't a finish, your visit ends right there — no second or third dart.",
  })),
  def("sudden-death", "Sudden Death", 3, "X01", () => {
    const n = randInt(15, 25);
    return { effect: { clutchPenaltyPerDart: n }, description: `Once you're within 100 to finish, every dart is worth ${n} less.` };
  }),
  def("no-way-out", "No Way Out", 3, "X01", () => ({
    effect: { noDoubleFinishFirstN: 3 },
    description: "You can't finish on a double at all this visit.",
  })),
  def("splintered", "Splintered", 3, "X01", () => {
    const pct = randInt(30, 50);
    return { effect: { trebleMultiplier: pct / 100 }, description: `Every treble you hit this visit is worth only ${pct}% of its value.` };
  }),
  def("dead-weight", "Dead Weight", 3, "X01", () => {
    const n = randInt(30, 45);
    return { effect: { visitPenalty: n }, description: `Flat ${n} points come off whatever you score this visit, once it's totalled.` };
  }),
];

// ── Cricket curses ───────────────────────────────────────────────────────────
const CRICKET_CURSES: CurseDef[] = [
  // Tier 1 — mild
  def("slow-hands", "Slow Hands", 1, "CRICKET", () => ({
    effect: { sluggishMarks: true },
    description: "Every hit only ever counts as a single mark — no more treble/double marking.",
  })),
  def("one-down", "One Number Down", 1, "CRICKET", () => {
    const [num] = pickN(CRICKET_NUMBERS.filter(n => n !== 25), 1);
    return { effect: { blockSegmentsForMarks: [num] }, description: `${num} won't mark for you this visit.` };
  }),
  def("fumble", "Fumble", 1, "CRICKET", () => ({
    effect: { hesitateFirstDart: true },
    description: "Your first dart of this visit never marks, whatever it hits.",
  })),
  def("one-shot", "One Shot", 1, "CRICKET", () => ({
    effect: { loseNextMark: true },
    description: "Your very next scoring mark attempt this visit whiffs, guaranteed.",
  })),

  // Tier 2 — medium
  def("narrowed", "Narrowed", 2, "CRICKET", () => {
    const n = randInt(2, 3);
    const nums = pickN(CRICKET_NUMBERS, n);
    return { effect: { allowedMarkSegments: nums }, description: `Only ${nums.join(", ")} can mark for you this visit — everything else is dead.` };
  }),
  def("half-marks", "Half Marks", 2, "CRICKET", () => {
    const pct = randInt(40, 60);
    return { effect: { marksMultiplier: pct / 100 }, description: `Every mark you earn this visit is only worth ${pct}%.` };
  }),
  def("bull-void", "Bull Void", 2, "CRICKET", () => ({
    effect: { blockBullMarks: true },
    description: "The bull is dead for you this visit — it won't mark or score.",
  })),
  def("missed-finish", "Missed Finish", 2, "CRICKET", () => ({
    effect: { blockFinalDartMark: true },
    description: "Your last dart of this visit never marks, whatever it hits.",
  })),
  def("sniper-lock", "Sniper Lock", 2, "CRICKET", () => {
    const [num] = pickN(CRICKET_NUMBERS, 1);
    return {
      effect: { sniperLockSegment: num, dartsRemainingForSniper: 3 },
      description: `For the rest of this visit, only ${num} marks — anything else whiffs.`,
    };
  }),
  def("scoring-choke", "Scoring Choke", 2, "CRICKET", () => {
    const pct = randInt(40, 60);
    return { effect: { scoreHalveExtraMultiplier: pct / 100 }, description: `Points you score on numbers you've already closed are only worth ${pct}% this visit.` };
  }),
  def("rationed", "Rationed", 2, "CRICKET", () => {
    const n = randInt(4, 5);
    return { effect: { maxMarksPerTurn: n }, description: `You can't gain more than ${n} total marks this visit, however many darts land.` };
  }),

  // Tier 3 — severe
  def("locked-out", "Locked Out", 3, "CRICKET", () => ({
    effect: { blockClosing: true },
    description: "You can't close any number this visit — your marks cap at 2.",
  })),
  def("one-only", "One Number Only", 3, "CRICKET", () => {
    const [num] = pickN(CRICKET_NUMBERS, 1);
    return { effect: { allowedMarkSegments: [num] }, description: `Only ${num} can mark for you this visit — everything else is dead.` };
  }),
  def("mark-erasure", "Mark Erasure", 3, "CRICKET", () => {
    const n = randInt(7, 13);
    return { effect: { penaltyPerMark: n }, description: `Every mark you earn this visit costs you ${n} points.` };
  }),
  def("streak-breaker", "Streak Breaker", 3, "CRICKET", () => ({
    // cardName must stay exactly "Streak Breaker" — the engine checks by name, not just this flag.
    effect: { streakBreakerHalves: true },
    description: "Any number you've got to 2 marks on gets knocked back down to 1.",
  })),
  def("mark-drain", "Mark Drain", 3, "CRICKET", () => ({
    // cardName must stay exactly "Mark Drain" — the engine checks by name, not just this flag.
    effect: { markDrainIfAhead: true },
    description: "While your opponent's ahead on score, one of your marked numbers keeps losing a mark.",
  })),
  def("pressure", "Pressure", 3, "CRICKET", () => {
    const n = randInt(20, 35);
    return { effect: { pressureLoseIfNoClose: n }, description: `If you don't close a number this visit, you lose ${n} points.` };
  }),
  def("point-blank", "Point Blank", 3, "CRICKET", () => {
    const pct = randInt(15, 30);
    return { effect: { scoreHalveExtraMultiplier: pct / 100 }, description: `Points you score on numbers you've already closed are only worth ${pct}% this visit.` };
  }),
  def("shutdown", "Shutdown", 3, "CRICKET", () => {
    const n = randInt(1, 2);
    return { effect: { maxMarksPerTurn: n }, description: `You can only gain ${n} mark${n === 1 ? "" : "s"} this whole visit, no matter what you hit.` };
  }),
];

export function getCursePool(gameMode: CurseGameMode): CurseDef[] {
  return gameMode === "X01" ? X01_CURSES : CRICKET_CURSES;
}

/** Which tier is "live" based on how many visits have happened this leg (shared count, whoever's turn). */
export function getTierForVisit(visitCount: number): CurseTier {
  if (visitCount <= 3) return 1;
  if (visitCount <= 6) return 2;
  return 3;
}


/**
 * Rolls a fresh curse for the given tier/game mode, avoiding whatever's
 * been drawn most recently (not just the single last curse) so the same
 * one or two curses can't keep resurfacing back-to-back in a long leg.
 * Falls back to the full tier pool if recency filtering would leave
 * nothing to pick from (small pools, e.g. Cricket tier 1's four curses).
 */
export function rollCurse(gameMode: CurseGameMode, tier: CurseTier, recentIds: string[] = []): { def: CurseDef; effect: Partial<CCEffect>; description: string } {
  const pool = getCursePool(gameMode).filter(c => c.tier === tier);
  const fresh = pool.filter(c => !recentIds.includes(c.id));
  const choices = fresh.length > 0 ? fresh : pool;
  const chosen = choices[Math.floor(Math.random() * choices.length)];
  const { effect, description } = chosen.build();
  return { def: chosen, effect, description };
}

/**
 * Full curse list for a game mode, grouped by tier, with one sample
 * description each — for a browsable "what am I up against" compendium on
 * the setup screen. Purely cosmetic: the description shown here is just
 * one example roll, not a promise of the exact numbers a real strike will
 * carry (those are re-rolled fresh every time, see rollCurse above).
 */
export function getCurseCompendium(gameMode: CurseGameMode): { tier: CurseTier; curses: { name: string; sampleDescription: string }[] }[] {
  const pool = getCursePool(gameMode);
  return [1, 2, 3].map(tier => ({
    tier: tier as CurseTier,
    curses: pool
      .filter(c => c.tier === tier)
      .map(c => ({ name: c.name, sampleDescription: c.build().description })),
  }));
}
