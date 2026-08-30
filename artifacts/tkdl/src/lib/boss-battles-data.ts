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
 * Each boss has 2-3 "moves" that rotate leg by leg (leg 1 = move 0, leg 2 =
 * move 1, leg 3 = move 0 again, etc.) via BossBattleScorer's onLegStart
 * callback, so a fight has distinct phases instead of one flat penalty for
 * the whole match. Pure arcade — wins/losses here never touch real Elo or
 * league stats, same as Shadow League practice matches.
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
  },
  {
    id: "the-annihilator",
    name: "The Annihilator",
    tagline: "The one you build up to.",
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
  },
];

const LOCKDOWN_SEGMENTS = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10];

/**
 * Materializes the boss's move for the given leg (1-indexed) into real
 * CCEffect objects ready to hand to X01Scorer/CricketScorer as `cardEffects`.
 * Rotates through the boss's move list leg by leg, wrapping around.
 */
export function getBossEffectsForLeg(boss: Boss, legNumber: number): { effects: CCEffect[]; move: BossMove } {
  const move = boss.moves[(legNumber - 1) % boss.moves.length];
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
  return { effects, move };
}

export function getBossById(id: string): Boss | undefined {
  return BOSSES.find(b => b.id === id);
}
