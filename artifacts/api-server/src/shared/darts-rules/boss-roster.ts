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

/** Phase 1 → 2 at ⅔ health, 2 → 3 (enraged) at ⅓. Ascension makes it angrier sooner;
 *  the Cool Head perk holds it off (½ and ¼). */
export function phaseFor(health: number, ascension = 0, coolHead = false): 1 | 2 | 3 {
  let t2 = ascension >= 2 ? 1.01 : 2 / 3, t3 = ascension >= 2 ? 2 / 3 : ascension === 1 ? 1 / 2 : 1 / 3;
  if (coolHead) { t2 = t2 > 1 ? t2 : 1 / 2; t3 = t3 >= 2 / 3 ? 1 / 2 : 1 / 4; }
  return health <= t3 ? 3 : health < t2 ? 2 : 1;
}

/** What a visit does to the boss's curse. 501: 100+ stuns it for your next visit, a 180 breaks it for
 *  the phase. Cricket: 6 / 9 marks. Thick Skin stuns from 80 (5 marks); Shield Breaker breaks from 140 (8). */
export function visitImpact(score: number, mode: "X01" | "CRICKET" = "X01", perk?: PerkId | null): "none" | "stun" | "break" {
  const cricket = mode === "CRICKET";
  const brk = perk === "shield-breaker" ? (cricket ? 8 : 140) : (cricket ? 9 : 180);
  const stun = perk === "thick-skin" ? (cricket ? 5 : 80) : (cricket ? 6 : 100);
  return score >= brk ? "break" : score >= stun ? "stun" : "none";
}

// ── Perks: beat certain bosses to unlock one; take one into each fight ─────────
export type PerkId = "iron-will" | "steady-hand" | "second-wind" | "treble-hunter" | "cool-head" | "thick-skin" | "shield-breaker";
export const PERKS: { id: PerkId; name: string; description: string; from: string; modes: BossMode[] }[] = [
  { id: "iron-will", name: "Iron Will", description: "The boss's first curse can't touch you: phase 1 is curse-free.", from: "rookie-wall", modes: ["X01", "CRICKET"] },
  { id: "steady-hand", name: "Steady Hand", description: "A dart that misses the board scores 5 instead of nothing.", from: "old-jinx", modes: ["X01"] },
  { id: "second-wind", name: "Second Wind", description: "On 50 or less, a bust doesn't wipe your visit: the busting dart just scores 1.", from: "big-barry", modes: ["X01"] },
  { id: "treble-hunter", name: "Treble Hunter", description: "Your first treble each visit is worth 30% more.", from: "the-warden", modes: ["X01"] },
  { id: "cool-head", name: "Cool Head", description: "The boss stays calmer: it changes tactics at ½ health and enrages at ¼.", from: "the-clipboard", modes: ["X01", "CRICKET", "ATW", "HALVEIT", "KILLER"] },
  { id: "thick-skin", name: "Thick Skin", description: "Stun its curse with an 80+ visit (Cricket: 5 marks) instead of 100.", from: "lockdown", modes: ["X01", "CRICKET"] },
  { id: "shield-breaker", name: "Shield Breaker", description: "Break its curse with a 140+ visit (Cricket: 8 marks) instead of a 180.", from: "the-champion", modes: ["X01", "CRICKET"] },
];
export const perkById = (id: string | null | undefined) => PERKS.find(p => p.id === id);
export const unlockedPerks = (defeated: Set<string> | string[]) => {
  const d = defeated instanceof Set ? defeated : new Set(defeated);
  return PERKS.filter(p => d.has(p.from));
};

// ── Loot: every boss drops its own exclusive unlock the first time you beat it ─
export type BossLoot = { id: string; boss: string; category: "LEADERBOARD_TAG" | "FRAME" | "NAME_STYLE" | "BANNER"; name: string; rarity: string; color?: string; gradient?: string; glow?: string; sortOrder: number };
const T = (boss: string, name: string, color: string, rarity = "RARE"): BossLoot => ({ id: `tag-bb-${boss}`, boss, category: "LEADERBOARD_TAG", name, rarity, color, sortOrder: 230 });
const F = (boss: string, name: string, color: string, glow: string): BossLoot => ({ id: `frame-bb-${boss}`, boss, category: "FRAME", name, rarity: "EPIC", color, glow, sortOrder: 231 });
const N = (boss: string, name: string, gradient: string, glow: string): BossLoot => ({ id: `name-bb-${boss}`, boss, category: "NAME_STYLE", name, rarity: "LEGENDARY", gradient, glow, sortOrder: 232 });
const B = (boss: string, name: string, gradient: string, glow: string): BossLoot => ({ id: `banner-bb-${boss}`, boss, category: "BANNER", name, rarity: "LEGENDARY", gradient, glow, sortOrder: 233 });
export const BOSS_LOOT: BossLoot[] = [
  T("rookie-wall", "WALL BREAKER", "#d97706"),
  F("old-jinx", "Jinxed", "#84cc16", "#bef264"),
  T("quizmaster", "QUIZ CHAMPION", "#a78bfa"),
  N("the-landlord", "Last Orders", "linear-gradient(90deg,#78350f,#f59e0b,#fde68a,#f59e0b,#78350f)", "#f59e0b"),
  B("big-barry", "On the Door", "repeating-linear-gradient(135deg,rgba(245,158,11,.28) 0 14px,rgba(20,12,4,.94) 14px 34px)", "#f59e0b"),
  F("the-warden", "Cell Block", "#0ea5e9", "#7dd3fc"),
  T("night-manager", "EMPLOYEE OF THE MONTH", "#38bdf8"),
  N("stock-taker", "Stocktake", "linear-gradient(90deg,#14532d,#22c55e,#bbf7d0,#22c55e,#14532d)", "#22c55e"),
  T("the-clipboard", "DISCIPLINARY", "#e2e8f0"),
  B("lockdown", "Lockdown", "repeating-linear-gradient(45deg,rgba(220,38,38,.4) 0 12px,rgba(10,6,6,.95) 12px 24px)", "#ef4444"),
  T("the-annihilator", "ANNIHILATOR", "#ef4444", "EPIC"),
  N("the-showman", "Showstopper", "linear-gradient(90deg,#831843,#ec4899,#fbcfe8,#ec4899,#831843)", "#ec4899"),
  F("double-trouble", "Double Vision", "#22d3ee", "#f0abfc"),
  T("the-gladiator", "GLADIATOR", "#b91c1c", "EPIC"),
  B("the-champion", "Title Belt", "linear-gradient(100deg,rgba(66,32,6,.95),rgba(234,179,8,.45) 40%,rgba(255,247,214,.35) 50%,rgba(234,179,8,.45) 60%,rgba(66,32,6,.95))", "#eab308"),
  F("the-hollow", "Hollow", "#6d28d9", "#e9d5ff"),
  N("bermuda", "Lost at Sea", "linear-gradient(90deg,#083344,#06b6d4,#cffafe,#06b6d4,#083344)", "#22d3ee"),
  T("the-executioner", "EXECUTIONER", "#f87171", "EPIC"),
  F("the-mirror", "Mirror", "#cbd5e1", "#38bdf8"),
  B("the-reckoning", "The Reckoning", "radial-gradient(ellipse at 50% 120%,rgba(244,63,94,.55),rgba(10,0,6,.96) 60%),repeating-conic-gradient(from 0deg at 50% 120%,rgba(244,63,94,.18) 0 6deg,transparent 6deg 14deg)", "#f43f5e"),
];
export const lootFor = (bossId: string) => BOSS_LOOT.find(l => l.boss === bossId);

// ── Nemesis: the unbeaten boss that's beaten you most (at least 3 losses). Beat it for a revenge
// bonus, and your Nemesis moves on. ──
export const NEMESIS_MIN_LOSSES = 3;
export const REVENGE_COINS = 50;
export function nemesisOf(stats: Record<string, { attempts: number; wins: number }>, defeated: Set<string> | string[] = []): { bossId: string; losses: number } | null {
  const d = defeated instanceof Set ? defeated : new Set(defeated);
  let best: { bossId: string; losses: number } | null = null;
  for (const b of BOSS_ROSTER) {
    const s = stats[b.id]; if (!s || d.has(b.id) || s.wins > 0) continue;
    const losses = s.attempts - s.wins;
    if (losses >= NEMESIS_MIN_LOSSES && (!best || losses >= best.losses)) best = { bossId: b.id, losses };
  }
  return best;
}
