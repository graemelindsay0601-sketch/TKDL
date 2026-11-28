// Curse Run (Board Curse): a run of solo 501 legs under a visit limit. Between legs you choose a
// Blessing (something good) or a Dark Pact (an extra curse for the rest of the run that raises your
// score multiplier). Build combos until a leg beats you. The Daily Run is seeded so everyone gets the
// same choices and curses. Pure: the scorer and page do the playing.
import type { CCEffect } from "./card-effect-engine";
import { createCurseRandom, rollCurse } from "./board-curse-data.ts";

export type BlessingId =
  | "lucky-treble" | "treble-heaven" | "safe-bust" | "steady-hand" | "close-control" | "iron-will" | "rhythm" | "heavy-darts"
  | "precision" | "floor" | "ward" | "mercy" | "second-sight" | "more-time" | "quick-hands" | "calm-waters" | "insurance"
  | "momentum" | "clean-slate" | "lucky-charm";

export type Blessing = {
  id: BlessingId; name: string; description: string;
  /** Lasts the rest of the run, or just the next leg. */
  lasts: "run" | "leg";
  effect?: Partial<CCEffect>;
};

export const BLESSINGS: Blessing[] = [
  { id: "lucky-treble", name: "Lucky Treble", description: "Trebles score 15% more.", lasts: "run", effect: { trebleMultiplier: 1.15 } },
  { id: "treble-heaven", name: "Treble Heaven", description: "Trebles score 30% more, next leg only.", lasts: "leg", effect: { trebleMultiplier: 1.3 } },
  { id: "safe-bust", name: "Safe Bust", description: "A bust keeps half your visit instead of wiping it.", lasts: "run", effect: { bustToHalf: true } },
  { id: "steady-hand", name: "Steady Hand", description: "A dart off the board scores 5.", lasts: "run", effect: { missToMin: true } },
  { id: "close-control", name: "Close Control", description: "On 50 or less a bust doesn't wipe your visit.", lasts: "run", effect: { preventBustInCheckout: true } },
  { id: "iron-will", name: "Iron Will", description: "Every dart scores 10% more.", lasts: "run", effect: { allDartsMultiplier: 1.1 } },
  { id: "rhythm", name: "Perfect Rhythm", description: "+3 on every dart.", lasts: "run", effect: { bonusPerDart: 3 } },
  { id: "heavy-darts", name: "Heavy Darts", description: "+15 on every visit.", lasts: "run", effect: { visitBonus: 15 } },
  { id: "precision", name: "Precision", description: "Numbers below 6 count as 6.", lasts: "run", effect: { minSegment: 6 } },
  { id: "floor", name: "Safety Floor", description: "No dart scores less than 5, next leg only.", lasts: "leg", effect: { minDartValue: 5 } },
  { id: "ward", name: "Extra Ward", description: "One more ward: wipe a curse the moment it lands.", lasts: "run" },
  { id: "mercy", name: "Mercy", description: "Curses can't go past medium for the rest of the run.", lasts: "run" },
  { id: "second-sight", name: "Second Sight", description: "A curse only strikes every other visit, next leg only.", lasts: "leg" },
  { id: "more-time", name: "More Time", description: "+1 visit on the limit for the rest of the run.", lasts: "run" },
  { id: "quick-hands", name: "Quick Hands", description: "+3 visits on the limit, next leg only.", lasts: "leg" },
  { id: "calm-waters", name: "Calm Waters", description: "Next leg's curses stay mild.", lasts: "leg" },
  { id: "insurance", name: "Insurance", description: "Fail a leg and you get one more go at it.", lasts: "run" },
  { id: "momentum", name: "Momentum", description: "+0.25× on your score multiplier.", lasts: "run" },
  { id: "clean-slate", name: "Clean Slate", description: "Break your oldest Dark Pact (and lose its multiplier).", lasts: "run" },
  { id: "lucky-charm", name: "Lucky Charm", description: "The first curse of the next leg is wiped.", lasts: "leg" },
];
export const blessingById = (id: string) => BLESSINGS.find(b => b.id === id);

export type Pact = { id: string; name: string; description: string; effect: Partial<CCEffect> };
export type RunChoice = { kind: "blessing"; blessing: Blessing } | { kind: "pact"; pact: Pact };

export const PACT_BONUS = 0.5;
export const MOMENTUM_BONUS = 0.25;

/** The run so far: what you've taken. */
export type RunState = { leg: number; score: number; blessings: BlessingId[]; legBlessings: BlessingId[]; pacts: Pact[]; insuranceUsed: boolean; bonus: number };
export const newRun = (): RunState => ({ leg: 1, score: 0, blessings: [], legBlessings: [], pacts: [], insuranceUsed: false, bonus: 0 });

export const multiplierOf = (s: RunState) => Math.round((1 + s.pacts.length * PACT_BONUS + s.bonus) * 100) / 100;

/** Points for a leg: finishing with visits to spare is worth more, all times the multiplier. */
export function legScore(visits: number, limit: number, multiplier: number): number {
  return Math.round((200 + Math.max(0, limit - visits) * 100) * multiplier);
}

/** Visit limit for a leg: tightens as the run goes on (like Endless), plus any extra time taken. */
export function runVisitLimit(s: RunState): number {
  const base = Math.max(10, 18 - Math.floor((s.leg - 1) / 2));
  return base + s.blessings.filter(b => b === "more-time").length + (s.legBlessings.includes("quick-hands") ? 3 : 0);
}

/** Three choices after a leg: two blessings and a Dark Pact. Seeded, so the Daily Run is the same for everyone. */
export function runChoices(seed: string, s: RunState): RunChoice[] {
  const rng = createCurseRandom(`${seed}:choices:${s.leg}`);
  const pool = BLESSINGS.filter(b => !(b.lasts === "run" && s.blessings.includes(b.id) && !["more-time", "momentum", "ward"].includes(b.id)) && !(b.id === "clean-slate" && !s.pacts.length));
  const picks: Blessing[] = [];
  while (picks.length < 2 && pool.length) picks.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  const tier = s.leg >= 4 ? 3 : 2;
  const c = rollCurse("X01", tier, s.pacts.map(p => p.id), rng);
  return [...picks.map(b => ({ kind: "blessing" as const, blessing: b })),
    { kind: "pact", pact: { id: c.def.id, name: c.def.name, description: c.description.replace(/\bthis visit\b/gi, "every visit"), effect: c.effect } }];
}

/** Take a choice: returns the run state for the next leg. */
export function takeChoice(s: RunState, choice: RunChoice): RunState {
  const next: RunState = { ...s, legBlessings: [], blessings: [...s.blessings], pacts: [...s.pacts] };
  if (choice.kind === "pact") { next.pacts.push(choice.pact); return next; }
  const b = choice.blessing;
  if (b.id === "momentum") next.bonus = Math.round((next.bonus + MOMENTUM_BONUS) * 100) / 100;
  if (b.id === "clean-slate") next.pacts.shift();
  if (b.lasts === "leg") next.legBlessings = [b.id]; else next.blessings.push(b.id);
  return next;
}

/** The effects on your darts for the coming leg: blessings (good) and pacts (curses), all leg-long. */
export function runEffects(s: RunState): CCEffect[] {
  const mk = (name: string, effect: Partial<CCEffect>, byBoard: boolean): CCEffect =>
    ({ ...effect, cardName: name, appliedBy: byBoard ? 1 : 0, affectsPlayer: 0, status: "active", legDuration: true } as CCEffect);
  return [
    ...[...s.blessings, ...s.legBlessings].map(blessingById).filter(b => b?.effect).map(b => mk(b!.name, b!.effect!, false)),
    ...s.pacts.map(p => mk(`Pact: ${p.name}`, p.effect, true)),
  ];
}

/** Scorer rules from blessings for the coming leg. */
export function runRules(s: RunState) {
  const has = (id: BlessingId) => s.blessings.includes(id) || s.legBlessings.includes(id);
  return {
    maxTier: (has("calm-waters") ? 1 : has("mercy") ? 2 : 3) as 1 | 2 | 3,
    strikeEvery: has("second-sight") ? 2 : 1,
    wards: (has("lucky-charm") ? 1 : 0) + s.blessings.filter(b => b === "ward").length,
    autoWardFirst: has("lucky-charm"),
  };
}
