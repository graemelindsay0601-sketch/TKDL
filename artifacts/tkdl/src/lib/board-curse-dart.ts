// Board Curse for Around the World and Halve-It. Those scorers don't run the card-effects engine,
// so these curses work by rewriting each dart as it's thrown (a miss, a drift to the next number,
// a treble flattened to a single). Pure: the scorer wrapper calls applyDartCurse per dart.
import type { Dart } from "./dartboard";
import type { CurseTier } from "./board-curse-data.ts";

export type DartCurseMode = "ATW" | "HALVEIT";
export type DartCurse = { id: string; name: string; tier: CurseTier; description: string; dead?: number[]; rule: DartRule };
type DartRule = "drift-first" | "miss-first" | "no-trebles" | "dead" | "drift-all" | "miss-third" | "mirror" | "no-doubles" | "miss-two" | "drift-back-two" | "dead-two-flat" | "singles-only";

/** Clockwise from the top. */
export const BOARD_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const shift = (seg: number, by: number) => {
  const i = BOARD_ORDER.indexOf(seg);
  return i < 0 ? seg : BOARD_ORDER[(i + by + 200) % 20];
};

export const MISS: Dart = { segment: 0, multiplier: 1, value: 0, label: "MISS" };
export function makeDart(segment: number, multiplier: 1 | 2 | 3): Dart {
  if (segment === 0) return MISS;
  if (segment === 25) { const m = multiplier === 1 ? 1 : 2; return { segment, multiplier: m, value: m === 2 ? 50 : 25, label: m === 2 ? "DB" : "Bull" }; }
  return { segment, multiplier, value: segment * multiplier, label: multiplier === 1 ? `${segment}` : multiplier === 2 ? `D${segment}` : `T${segment}` };
}

type Def = { id: string; name: string; tier: CurseTier; rule: DartRule; modes?: DartCurseMode[]; text: (dead: number[]) => string; deadCount?: number };
const DEFS: Def[] = [
  { id: "wandering-aim", name: "Wandering Aim", tier: 1, rule: "drift-first", text: () => "Your first dart drifts to the next number clockwise." },
  { id: "butter-fingers", name: "Butter Fingers", tier: 1, rule: "miss-first", text: () => "Your first dart slips: it's a miss." },
  { id: "flattened", name: "Flattened", tier: 1, rule: "no-trebles", text: () => "Trebles only count as singles." },
  { id: "dead-number", name: "Dead Number", tier: 1, rule: "dead", deadCount: 1, text: d => `${d[0]} is dead: any hit on it is a miss.` },
  { id: "drunk-arm", name: "Drunk Arm", tier: 2, rule: "drift-all", text: () => "Every dart drifts to the next number clockwise." },
  { id: "missing-dart", name: "Missing Dart", tier: 2, rule: "miss-third", text: () => "Your third dart vanishes: it's a miss." },
  { id: "mirror-board", name: "Mirror Board", tier: 2, rule: "mirror", text: () => "Darts land on the number opposite the one you hit." },
  { id: "thin-wires", name: "Thin Wires", tier: 2, rule: "no-doubles", text: () => "Doubles only count as singles." },
  { id: "two-lost-darts", name: "Two Lost Darts", tier: 3, rule: "miss-two", text: () => "Your first two darts are misses. One dart to save it." },
  { id: "spin-cycle", name: "Spin Cycle", tier: 3, rule: "drift-back-two", text: () => "Every dart drifts two numbers anticlockwise." },
  { id: "dead-zone", name: "Dead Zone", tier: 3, rule: "dead-two-flat", deadCount: 2, text: d => `${d[0]} and ${d[1]} are dead, and trebles count as singles.` },
  { id: "shackled", name: "Shackled", tier: 3, rule: "singles-only", text: () => "Only singles count. Doubles and trebles are misses." },
];
export const DART_CURSE_IDS = DEFS.map(d => d.id);

/** Tier by the thrower's own visit count (so both players in a duel climb at the same pace). */
export const dartTierFor = (visit: number): CurseTier => visit <= 3 ? 1 : visit <= 6 ? 2 : 3;

export function rollDartCurse(mode: DartCurseMode, tier: CurseTier, recent: string[], rng: () => number): DartCurse {
  const pool = DEFS.filter(d => d.tier === tier && (!d.modes || d.modes.includes(mode)));
  const fresh = pool.filter(d => !recent.includes(d.id));
  const pick = (fresh.length ? fresh : pool)[Math.floor(rng() * (fresh.length ? fresh : pool).length)];
  const dead: number[] = [];
  while (dead.length < (pick.deadCount ?? 0)) { const n = 1 + Math.floor(rng() * 20); if (!dead.includes(n)) dead.push(n); }
  return { id: pick.id, name: pick.name, tier: pick.tier, rule: pick.rule, dead, description: pick.text(dead) };
}

/** The dart that actually counts under this curse. index = 0, 1 or 2 within the visit. */
export function applyDartCurse(c: DartCurse | null, d: Dart, index: number): Dart {
  if (!c || d.segment === 0) return d;
  const seg = d.segment, m = d.multiplier;
  switch (c.rule) {
    case "drift-first": return index === 0 && seg !== 25 ? makeDart(shift(seg, 1), m) : d;
    case "miss-first": return index === 0 ? MISS : d;
    case "no-trebles": return m === 3 ? makeDart(seg, 1) : d;
    case "dead": return c.dead?.includes(seg) ? MISS : d;
    case "drift-all": return seg !== 25 ? makeDart(shift(seg, 1), m) : d;
    case "miss-third": return index === 2 ? MISS : d;
    case "mirror": return seg !== 25 ? makeDart(shift(seg, 10), m) : d;
    case "no-doubles": return m === 2 ? makeDart(seg, 1) : d;
    case "miss-two": return index < 2 ? MISS : d;
    case "drift-back-two": return seg !== 25 ? makeDart(shift(seg, -2), m) : d;
    case "dead-two-flat": return c.dead?.includes(seg) ? MISS : m === 3 ? makeDart(seg, 1) : d;
    case "singles-only": return m === 1 ? d : MISS;
  }
}

/** Every dart curse, with a sample description, for the Archive. */
export function dartCurseCompendium(): { tier: CurseTier; curses: { name: string; sampleDescription: string }[] }[] {
  return ([1, 2, 3] as CurseTier[]).map(tier => ({ tier, curses: DEFS.filter(d => d.tier === tier).map(d => ({ name: d.name, sampleDescription: d.text([20, 3]) })) }));
}
