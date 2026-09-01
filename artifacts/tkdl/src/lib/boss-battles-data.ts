/**
 * Boss Battle Mode — roster and content.
 *
 * A "boss" is a themed CPU opponent whose debuffs are always active against
 * the human player, built entirely from Card Clash's existing, already-
 * tested effect system (lib/card-effect-engine.ts) — no new game mechanics,
 * just new content wrapped around proven ones. This keeps behaviour
 * predictable: every effect a boss uses already works correctly in real
 * Card Clash matches today.
 *
 * Each boss has 2 "moves" that rotate leg by leg (leg 1 = move 0, leg 2 =
 * move 1) via BossBattleScorer's onLegStart callback, so a fight has distinct
 * phases instead of one flat penalty for the whole match. Pure arcade —
 * wins/losses here never touch real Elo or league stats, same as Shadow
 * League practice matches.
 *
 * Every fight is best of 3, so a leg 3 only ever gets played when the match
 * is tied 1-1 — it's always the leg that actually decides the fight. Rather
 * than just repeating move 0 again, each boss has an optional `enrageMove`
 * that fires only on that decisive leg, stacking its established gimmick (or
 * combining a couple of effects at once) into something nastier. This reuses
 * the exact same CCEffect fields as the regular moves — no new mechanics,
 * just a bigger dose of ones already proven in real Card Clash matches.
 */

import type { CCEffect } from "./card-effect-engine";
import type { BotLevel } from "./bot-engine";

export interface BossMove {
  /** Short name shown in the "boss used X!" banner and the live effects HUD badge. */
  name: string;
  /** One line explaining what this move actually does, shown when the badge is tapped. */
  description: string;
  /** Effect fields to apply — cardName/appliedBy/affectsPlayer/status are filled in at battle time. */
  effects: Omit<CCEffect, "cardName" | "appliedBy" | "affectsPlayer" | "status">[];
}

export interface Boss {
  id: string;
  name: string;
  tagline: string;
  gameMode: "X01" | "CRICKET";
  /** CPU skill tier for the boss's own throws — separate from how nasty its moves are. */
  botLevel: BotLevel;
  /** Ladder position — beat bosses in this order. */
  order: number;
  moves: BossMove[];
  /** Fires instead of the regular rotation on the decisive leg (leg 3 of a
   *  best-of-3, which only happens when the match is tied 1-1). Optional so
   *  a boss without one just keeps rotating its regular moves. */
  enrageMove?: BossMove;
}

export const BOSSES: Boss[] = [
  {
    id: "rookie-wall",
    name: "The Rookie Wall",
    tagline: "Everyone's first loss.",
    gameMode: "X01",
    botLevel: "amateur",
    order: 1,
    moves: [
      {
        name: "Wall Block",
        description: "You can't score on 20, 19, or 18 this leg — any hit on them scores 0.",
        effects: [{ segmentBlock: [20, 19, 18] }],
      },
      {
        name: "Wild Throw",
        description: "One random dart each visit goes completely wide and scores 0.",
        // wildDartIndex is picked fresh per leg in getBossEffectsForLeg, not
        // here — this array is built once at module load, so a fixed value
        // here would mean the SAME dart index (e.g. always dart 1) for
        // every leg of every fight for the life of the page.
        effects: [{ wildDartIndex: undefined as unknown as number }],
      },
    ],
    enrageMove: {
      name: "Panic Throw",
      description: "Down to the wire: two of your three darts each visit go completely wide and score 0.",
      // Same wildDartIndices mechanic as the "Wipeout" card, just used here
      // instead of a single random miss — a fixed, harsher escalation of
      // this boss's whole "your own throw betrays you" theme.
      effects: [{ wildDartIndices: [1, 2] }],
    },
  },
  {
    id: "old-jinx",
    name: "Old Jinx",
    tagline: "Nothing you throw feels right.",
    gameMode: "X01",
    botLevel: "club",
    order: 2,
    moves: [
      {
        name: "Jinxed",
        description: "Every dart you throw is only worth 75% of its real value.",
        effects: [{ allDartsMultiplier: 0.75 }],
      },
      {
        name: "Shackled",
        description: "No single dart can score more than 50, no matter what you hit.",
        effects: [{ maxDartValue: 50 }],
      },
    ],
    enrageMove: {
      name: "Full Jinx",
      description: "The jinx doubles down: every dart is worth only half its real value this leg.",
      effects: [{ allDartsMultiplier: 0.5 }],
    },
  },
  {
    id: "the-warden",
    name: "The Warden",
    tagline: "You're not getting out of here.",
    gameMode: "CRICKET",
    botLevel: "club",
    order: 3,
    moves: [
      {
        name: "Cricket Prison",
        description: "You can only mark 15, 19, and 20 this leg — every other number is dead to you.",
        effects: [{ allowedMarkSegments: [15, 19, 20] }],
      },
      {
        name: "Closing Blocker",
        description: "You can't close any number this leg — your marks cap at 2, however many darts you land.",
        effects: [{ blockClosing: true }],
      },
    ],
    enrageMove: {
      name: "Iron Cage",
      description: "Every hit only counts as a single mark this leg — trebles and doubles are wasted.",
      effects: [{ sluggishMarks: true }],
    },
  },
  {
    id: "lockdown",
    name: "Lockdown",
    tagline: "One number. That's all you get.",
    gameMode: "X01",
    botLevel: "county",
    order: 4,
    moves: [
      {
        name: "Locked In",
        description: "Only one number scores anything this leg — everything else is worth 0.",
        // A concrete segment is picked per leg in getBossEffectsForLeg (the
        // whole point is you don't know which number until you're in it).
        effects: [{ lockdownSegment: undefined as unknown as number }],
      },
      {
        name: "Toll Booth",
        description: "Every dart you throw costs you 10 points, just for throwing it.",
        effects: [{ penaltyPerDart: 10 }],
      },
    ],
    enrageMove: {
      name: "Maximum Security",
      description: "Only one number scores this leg, and every dart still costs you 15 — hit or miss.",
      // Combines both regular moves into one, at a harsher rate — same
      // single-effect-object-with-multiple-fields pattern the underlying
      // engine already uses for cards like "Match Pressure". lockdownSegment
      // is randomized per leg below, same as the regular "Locked In" move.
      effects: [{ lockdownSegment: undefined as unknown as number, penaltyPerDart: 15 }],
    },
  },
  {
    id: "the-annihilator",
    name: "The Annihilator",
    tagline: "Everyone thinks this is the end.",
    gameMode: "X01",
    botLevel: "pro",
    order: 5,
    moves: [
      {
        name: "Trebles Curse",
        description: "Every treble you hit this match counts as a single — T20 scores 20, not 60.",
        effects: [{ treblesAsSingles: true }],
      },
      {
        name: "Annihilation",
        description: "A brutal one-off hit: your visit total this leg is capped at a punishing 40.",
        effects: [{ maxVisitTotal: 40 }],
      },
    ],
    enrageMove: {
      name: "Total Annihilation",
      description: "Everything at once: trebles are worthless AND your whole visit is capped at 30.",
      effects: [{ treblesAsSingles: true, maxVisitTotal: 30 }],
    },
  },
  {
    // Secret 6th boss — only reachable by beating all 5 above, since the
    // ladder's unlock chain is just "beat order N-1" all the way down. No
    // extra gating needed here; it falls out of the existing isUnlocked
    // logic in boss-battle.tsx for free.
    id: "the-reckoning",
    name: "The Reckoning",
    tagline: "Every trick they used, at the same time.",
    gameMode: "X01",
    botLevel: "elite",
    order: 6,
    moves: [
      {
        name: "Everything, All At Once",
        description: "Every dart is worth only 80% of its real value, and 20 & 19 are blocked outright.",
        effects: [{ allDartsMultiplier: 0.8, segmentBlock: [20, 19] }],
      },
      {
        name: "Cold Comfort",
        description: "No dart can score more than 40, and every one still costs you 5 — hit or miss.",
        effects: [{ maxDartValue: 40, penaltyPerDart: 5 }],
      },
    ],
    enrageMove: {
      name: "The Reckoning",
      description: "Trebles are singles, your visit is capped at 30, and every dart costs you 10. This is the one you've been building toward.",
      effects: [{ treblesAsSingles: true, maxVisitTotal: 30, penaltyPerDart: 10 }],
    },
  },
];

const LOCKDOWN_SEGMENTS = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10];

/** Every fight is best of 3 (see BossBattleScorer's `legs={3}`), so leg 3 is
 *  only ever played when the match is tied 1-1 — it's always the decider. */
const LEGS_PER_FIGHT = 3;

/**
 * Materializes the boss's move for the given leg (1-indexed) into real
 * CCEffect objects ready to hand to X01Scorer/CricketScorer as `cardEffects`.
 * Rotates through the boss's regular move list leg by leg, wrapping around —
 * except on the decisive leg (leg 3 of a bo3, which can only happen when the
 * match is 1-1), where the boss's enrageMove fires instead, if it has one.
 */
export function getBossEffectsForLeg(boss: Boss, legNumber: number): { effects: CCEffect[]; move: BossMove; isEnrage: boolean } {
  const isEnrage = legNumber === LEGS_PER_FIGHT && !!boss.enrageMove;
  const move = isEnrage ? boss.enrageMove! : boss.moves[(legNumber - 1) % boss.moves.length];
  const effects: CCEffect[] = move.effects.map(partial => {
    const filled = { ...partial };
    // Lockdown's target number, and Rookie Wall's wild dart slot, are randomized
    // per leg here rather than baked into the static roster above (which is
    // built once at module load) — otherwise every fight would use the exact
    // same fixed number/dart for as long as the page stays open.
    if (boss.id === "lockdown" && "lockdownSegment" in filled) {
      filled.lockdownSegment = LOCKDOWN_SEGMENTS[Math.floor(Math.random() * LOCKDOWN_SEGMENTS.length)];
    }
    if (boss.id === "rookie-wall" && "wildDartIndex" in filled) {
      filled.wildDartIndex = Math.floor(Math.random() * 3);
    }
    return {
      cardName: move.name,
      appliedBy: 1,
      affectsPlayer: 0,
      status: "active",
      ...filled,
    };
  });
  return { effects, move, isEnrage };
}

export function getBossById(id: string): Boss | undefined {
  return BOSSES.find(b => b.id === id);
}
