// Boss Battle roster and fight maths, shared by the app and the server (pure).
// The app adds each boss's moves, lines and portrait (tkdl lib/boss-battles-data.ts);
// the server only needs the ids, order and mastery times to check results.

export type BossMode = "X01" | "CRICKET" | "ATW" | "HALVEIT" | "KILLER";
export type WorldId = "pub" | "shop" | "arena" | "void";

export const WORLDS: { id: WorldId; name: string; blurb: string; colour: string; glow: string }[] = [
  { id: "pub", name: "The Pub", blurb: "Where everyone starts. Sticky floors, loud regulars.", colour: "#f59e0b", glow: "#7c2d12" },
  { id: "shop", name: "The Shop Floor", blurb: "Clock in. Hit targets. Don't upset management.", colour: "#38bdf8", glow: "#0c4a6e" },
  { id: "arena", name: "The Arena", blurb: "Walk-on music, lights, a crowd that wants blood.", colour: "#ff005c", glow: "#4a0012" },
  { id: "void", name: "The Void", blurb: "Nobody's sure what's down here. Nobody's come back to say.", colour: "#a78bfa", glow: "#1e1035" },
];

export type RosterEntry = { id: string; name: string; world: WorldId; order: number; mode: BossMode; masterySeconds: number };

/** In ladder order. The first six ids are the original bosses (records kept); the rest are new. */
export const BOSS_ROSTER: RosterEntry[] = [
  { id: "rookie-wall", name: "The Rookie Wall", world: "pub", order: 1, mode: "X01", masterySeconds: 180 },
  { id: "old-jinx", name: "Old Jinx", world: "pub", order: 2, mode: "X01", masterySeconds: 210 },
  { id: "quizmaster", name: "The Quizmaster", world: "pub", order: 3, mode: "ATW", masterySeconds: 240 },
  { id: "the-landlord", name: "The Landlord", world: "pub", order: 4, mode: "CRICKET", masterySeconds: 240 },
  { id: "big-barry", name: "Big Barry", world: "pub", order: 5, mode: "X01", masterySeconds: 240 },
  { id: "the-warden", name: "The Warden", world: "shop", order: 6, mode: "CRICKET", masterySeconds: 240 },
  { id: "night-manager", name: "The Night Manager", world: "shop", order: 7, mode: "X01", masterySeconds: 270 },
  { id: "stock-taker", name: "The Stock Taker", world: "shop", order: 8, mode: "HALVEIT", masterySeconds: 300 },
  { id: "the-clipboard", name: "The Clipboard", world: "shop", order: 9, mode: "KILLER", masterySeconds: 240 },
  { id: "lockdown", name: "Lockdown", world: "shop", order: 10, mode: "X01", masterySeconds: 270 },
  { id: "the-annihilator", name: "The Annihilator", world: "arena", order: 11, mode: "X01", masterySeconds: 300 },
  { id: "the-showman", name: "The Showman", world: "arena", order: 12, mode: "X01", masterySeconds: 300 },
  { id: "double-trouble", name: "Double Trouble", world: "arena", order: 13, mode: "ATW", masterySeconds: 330 },
  { id: "the-gladiator", name: "The Gladiator", world: "arena", order: 14, mode: "CRICKET", masterySeconds: 300 },
  { id: "the-champion", name: "The Champion", world: "arena", order: 15, mode: "X01", masterySeconds: 330 },
  { id: "the-hollow", name: "The Hollow", world: "void", order: 16, mode: "CRICKET", masterySeconds: 330 },
  { id: "bermuda", name: "Bermuda", world: "void", order: 17, mode: "HALVEIT", masterySeconds: 360 },
  { id: "the-executioner", name: "The Executioner", world: "void", order: 18, mode: "KILLER", masterySeconds: 240 },
  { id: "the-mirror", name: "The Mirror", world: "void", order: 19, mode: "X01", masterySeconds: 360 },
  { id: "the-reckoning", name: "The Reckoning", world: "void", order: 20, mode: "X01", masterySeconds: 360 },
];

export const TOTAL_BOSSES = BOSS_ROSTER.length;
export const rosterById = (id: string) => BOSS_ROSTER.find(b => b.id === id);
export const rosterByOrder = (order: number) => BOSS_ROSTER.find(b => b.order === order);

/** A boss can be fought once the one before it is beaten (or you've beaten this one already:
 *  the ladder grew from 6 to 20, so old clears stay playable). */
export function bossUnlocked(id: string, defeated: Set<string> | string[]): boolean {
  const d = defeated instanceof Set ? defeated : new Set(defeated);
  const b = rosterById(id);
  if (!b) return false;
  if (b.order === 1 || d.has(id)) return true;
  const prev = rosterByOrder(b.order - 1);
  return !!prev && d.has(prev.id);
}

// ── The health bar ──────────────────────────────────────────────────────────
// 501 and Cricket are best of 3, so the boss's health is what you still need to
// win two legs: 501 needs 2 × 501 points, Cricket 2 × 21 marks. Points you score
// in a leg the boss then wins are lost (it heals). Around the World is how far
// you have left to go; Killer is the boss's lives; Halve-It is a tug of war on
// the scores.

export type FightState =
  | { mode: "X01"; start: number; mine: number; legsWon: number }        // mine = what you have left this leg
  | { mode: "CRICKET"; marks: number; legsWon: number }                  // marks = your closing marks this leg (max 21)
  | { mode: "ATW"; mine: number; of: number }
  | { mode: "KILLER"; theirs: number; of: number }
  | { mode: "HALVEIT"; mine: number; theirs: number; round: number; rounds: number };

/** Boss health from 1 (full) to 0 (beaten). */
export function bossHealth(s: FightState): number {
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  switch (s.mode) {
    case "X01": return clamp(1 - (s.legsWon * s.start + (s.start - s.mine)) / (2 * s.start));
    case "CRICKET": return clamp(1 - (s.legsWon * 21 + Math.min(21, s.marks)) / 42);
    case "ATW": return s.of ? clamp(1 - s.mine / s.of) : 1;
    case "KILLER": return s.of ? clamp(s.theirs / s.of) : 1;
    case "HALVEIT": {
      // Even scores = half health; your lead drains it, theirs fills it. The last round settles it.
      const total = Math.max(40, Math.abs(s.mine) + Math.abs(s.theirs));
      return clamp(0.5 + (s.theirs - s.mine) / total);
    }
  }
}

/** Phase 1 → 2 at ⅔ health, 2 → 3 (enraged) at ⅓. Ascension makes it angrier sooner. */
export function phaseFor(health: number, ascension = 0): 1 | 2 | 3 {
  const t2 = ascension >= 2 ? 1.01 : 2 / 3, t3 = ascension >= 2 ? 2 / 3 : ascension === 1 ? 1 / 2 : 1 / 3;
  return health <= t3 ? 3 : health < t2 ? 2 : 1;
}

/** What a visit does to the boss's curse (501): 100+ stuns it for your next visit, a 180 breaks it for the phase. */
export function visitImpact(score: number): "none" | "stun" | "break" {
  return score >= 180 ? "break" : score >= 100 ? "stun" : "none";
}
