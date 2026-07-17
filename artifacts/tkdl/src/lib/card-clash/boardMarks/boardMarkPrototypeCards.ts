/**
 * Board Marks — prototype cards.
 *
 * 27 cards across four families:
 *  - 20 straightforward marks, 5 per type (hot/cold/trap/shield), spread
 *    across bull/number/treble/double targets. Reward/penalty magnitude is
 *    rarity-scaled by target difficulty — see boardMarkRewards.ts.
 *  - 4 "steal" cards — a Hot/Trap trigger doesn't just grant/penalize the
 *    trigger, it's a direct transfer between players. Zero-sum, so a Hot
 *    steal is a genuine race (winning it doesn't just help you, it hurts
 *    them) and a Trap steal rewards the trapper with what the trapped
 *    player lost.
 *  - 3 risk/reward "compound" cards — a big, guaranteed-target reward
 *    (e.g. Hot Bull) PLUS a second, self-targeted curse on a random spot.
 *    Going for the big prize means playing with a hidden landmine
 *    somewhere on your own next few visits.
 *
 * These only exist in Chaos Lab's mystery-card pool (see
 * getChaosLabCardPool in cards-data.ts — Chaos Lab draws exclusively from
 * this set, never the normal chaos pool). Never added to card_definitions
 * in the backend, so never purchasable, packable, or equippable elsewhere.
 */

import type { BoardMark, BoardMarkAppliesTo, BoardMarkDuration, BoardMarkTarget, BoardMarkTargetType, BoardMarkType } from "./boardMarkTypes";
import { generateBoardMarkId } from "./boardMarkState";

/** A single mark placement spec. `target: "random"` picks a random 1-20 number bed at creation time — used for the curse half of compound cards. */
export interface BoardMarkSpec {
  type: BoardMarkType;
  target: BoardMarkTarget | "random";
  appliesTo: BoardMarkAppliesTo;
  duration: BoardMarkDuration;
  allowReplace?: boolean;
  /** Hot: trigger steals the reward FROM the other player (zero-sum) instead of just granting it. Trap: the trapper receives what the trapped player loses. */
  steal?: boolean;
}

export interface BoardMarkPrototypeCardConfig {
  id: string;
  name: string;
  mode: "chaos_lab";
  boardMark: BoardMarkSpec;
  /** Risk/reward compound cards only — a second mark placed at the same time as the primary one. */
  secondaryMark?: BoardMarkSpec;
}

const UNTIL_HIT: BoardMarkDuration = "until_hit";
const UNTIL_AFFECTED_VISIT_END: BoardMarkDuration = "until_affected_player_visit_end";
const UNTIL_OWNER_NEXT_VISIT_END: BoardMarkDuration = "until_owner_next_visit_end";

interface RawCard {
  cardId: number;
  id: string;
  name: string;
  boardMark: BoardMarkSpec;
  secondaryMark?: BoardMarkSpec;
}

const RAW_CARDS: RawCard[] = [
  // ── HOT (5) — neutral, either player can trigger, rewards whoever hits it ──
  { cardId: 701, id: "prototype_hot_bull", name: "Hot Bull", boardMark: { type: "hot", target: { type: "bull", value: "bull" }, appliesTo: "neutral", duration: UNTIL_HIT } },
  { cardId: 705, id: "prototype_hot_20", name: "Hot 20", boardMark: { type: "hot", target: { type: "number", value: 20 }, appliesTo: "neutral", duration: UNTIL_HIT } },
  { cardId: 706, id: "prototype_hot_treble_20", name: "Hot Treble 20", boardMark: { type: "hot", target: { type: "treble", value: 20 }, appliesTo: "neutral", duration: UNTIL_HIT } },
  { cardId: 707, id: "prototype_hot_double_16", name: "Hot Double 16", boardMark: { type: "hot", target: { type: "double", value: 16 }, appliesTo: "neutral", duration: UNTIL_HIT } },
  { cardId: 708, id: "prototype_hot_19", name: "Hot 19", boardMark: { type: "hot", target: { type: "number", value: 19 }, appliesTo: "neutral", duration: UNTIL_HIT } },

  // ── COLD (5) — opponent only, pure denial, no score effect, lasts through their visit ──
  { cardId: 702, id: "prototype_cold_20s", name: "Cold 20s", boardMark: { type: "cold", target: { type: "number", value: 20 }, appliesTo: "opponent", duration: UNTIL_AFFECTED_VISIT_END } },
  { cardId: 709, id: "prototype_cold_bull", name: "Cold Bull", boardMark: { type: "cold", target: { type: "bull", value: "bull" }, appliesTo: "opponent", duration: UNTIL_AFFECTED_VISIT_END } },
  { cardId: 710, id: "prototype_cold_treble_19", name: "Cold Treble 19", boardMark: { type: "cold", target: { type: "treble", value: 19 }, appliesTo: "opponent", duration: UNTIL_AFFECTED_VISIT_END } },
  { cardId: 711, id: "prototype_cold_double_20", name: "Cold Double 20", boardMark: { type: "cold", target: { type: "double", value: 20 }, appliesTo: "opponent", duration: UNTIL_AFFECTED_VISIT_END } },
  { cardId: 712, id: "prototype_cold_15s", name: "Cold 15s", boardMark: { type: "cold", target: { type: "number", value: 15 }, appliesTo: "opponent", duration: UNTIL_AFFECTED_VISIT_END } },

  // ── TRAP (5) — opponent only, punishes + cancels, removed once sprung ──
  { cardId: 703, id: "prototype_trap_t20", name: "Trap T20", boardMark: { type: "trap", target: { type: "treble", value: 20 }, appliesTo: "opponent", duration: UNTIL_HIT } },
  { cardId: 713, id: "prototype_trap_bull", name: "Trap Bull", boardMark: { type: "trap", target: { type: "bull", value: "bull" }, appliesTo: "opponent", duration: UNTIL_HIT } },
  { cardId: 714, id: "prototype_trap_double_16", name: "Trap Double 16", boardMark: { type: "trap", target: { type: "double", value: 16 }, appliesTo: "opponent", duration: UNTIL_HIT } },
  { cardId: 715, id: "prototype_trap_19s", name: "Trap 19s", boardMark: { type: "trap", target: { type: "number", value: 19 }, appliesTo: "opponent", duration: UNTIL_HIT } },
  { cardId: 716, id: "prototype_trap_double_20", name: "Trap Double 20", boardMark: { type: "trap", target: { type: "double", value: 20 }, appliesTo: "opponent", duration: UNTIL_HIT } },

  // ── SHIELD (5) — self only, protects a target from enemy Cold/Trap ──
  { cardId: 704, id: "prototype_shield_d16", name: "Shield D16", boardMark: { type: "shield", target: { type: "double", value: 16 }, appliesTo: "self", duration: UNTIL_OWNER_NEXT_VISIT_END } },
  { cardId: 717, id: "prototype_shield_bull", name: "Shield Bull", boardMark: { type: "shield", target: { type: "bull", value: "bull" }, appliesTo: "self", duration: UNTIL_OWNER_NEXT_VISIT_END } },
  { cardId: 718, id: "prototype_shield_treble_20", name: "Shield Treble 20", boardMark: { type: "shield", target: { type: "treble", value: 20 }, appliesTo: "self", duration: UNTIL_OWNER_NEXT_VISIT_END } },
  { cardId: 719, id: "prototype_shield_20s", name: "Shield 20s", boardMark: { type: "shield", target: { type: "number", value: 20 }, appliesTo: "self", duration: UNTIL_OWNER_NEXT_VISIT_END } },
  { cardId: 720, id: "prototype_shield_double_8", name: "Shield Double 8", boardMark: { type: "shield", target: { type: "double", value: 8 }, appliesTo: "self", duration: UNTIL_OWNER_NEXT_VISIT_END } },

  // ── STEAL (4) — Hot/Trap triggers directly transfer between players, zero-sum ──
  { cardId: 721, id: "prototype_point_thief", name: "Point Thief", boardMark: { type: "hot", target: { type: "number", value: 8 }, appliesTo: "neutral", duration: UNTIL_HIT, steal: true } },
  { cardId: 722, id: "prototype_robbery", name: "Robbery", boardMark: { type: "hot", target: { type: "treble", value: 19 }, appliesTo: "neutral", duration: UNTIL_HIT, steal: true } },
  { cardId: 723, id: "prototype_highway_robbery", name: "Highway Robbery", boardMark: { type: "trap", target: { type: "bull", value: "bull" }, appliesTo: "opponent", duration: UNTIL_HIT, steal: true } },
  { cardId: 724, id: "prototype_grand_larceny", name: "Grand Larceny", boardMark: { type: "trap", target: { type: "double", value: 20 }, appliesTo: "opponent", duration: UNTIL_HIT, steal: true } },

  // ── RISK/REWARD (3) — a big guaranteed-target reward, plus a self-curse on a random spot ──
  {
    cardId: 725, id: "prototype_wildfire", name: "Wildfire",
    boardMark: { type: "hot", target: { type: "bull", value: "bull" }, appliesTo: "neutral", duration: UNTIL_HIT },
    secondaryMark: { type: "trap", target: "random", appliesTo: "self", duration: UNTIL_HIT },
  },
  {
    cardId: 726, id: "prototype_double_or_nothing", name: "Double or Nothing",
    boardMark: { type: "hot", target: { type: "treble", value: 20 }, appliesTo: "neutral", duration: UNTIL_HIT },
    secondaryMark: { type: "cold", target: "random", appliesTo: "self", duration: UNTIL_AFFECTED_VISIT_END },
  },
  {
    cardId: 727, id: "prototype_all_in", name: "All In",
    boardMark: { type: "hot", target: { type: "double", value: 16 }, appliesTo: "neutral", duration: UNTIL_HIT },
    secondaryMark: { type: "trap", target: "random", appliesTo: "self", duration: UNTIL_HIT },
  },
];

function toConfig(raw: RawCard): BoardMarkPrototypeCardConfig {
  return { id: raw.id, name: raw.name, mode: "chaos_lab", boardMark: raw.boardMark, secondaryMark: raw.secondaryMark };
}

export const BOARD_MARK_PROTOTYPE_CARDS: BoardMarkPrototypeCardConfig[] = RAW_CARDS.map(toConfig);

/** Convenience named exports for the original 4 (used by earlier tests/docs). */
export const HOT_BULL = BOARD_MARK_PROTOTYPE_CARDS[0];
export const COLD_20S = BOARD_MARK_PROTOTYPE_CARDS[5];
export const TRAP_T20 = BOARD_MARK_PROTOTYPE_CARDS[10];
export const SHIELD_D16 = BOARD_MARK_PROTOTYPE_CARDS[15];

/**
 * Maps the numeric card id used in cards-data.ts to its Board Mark config.
 * This is the join point between the card data layer and this module —
 * kept here rather than in cards-data.ts so boardMarks stays the single
 * source of truth for what each prototype card actually does.
 */
export const BOARD_MARK_CARD_ID_MAP: Record<number, BoardMarkPrototypeCardConfig> =
  Object.fromEntries(RAW_CARDS.map((raw, i) => [raw.cardId, BOARD_MARK_PROTOTYPE_CARDS[i]]));

export interface CreateBoardMarkParams {
  ownerPlayerId: string;
  /** Required when the card's appliesTo is "opponent" or "self" needs the other player's id for symmetry checks. */
  opponentPlayerId: string;
  createdAtVisitId?: string;
  createdAtTurnId?: string;
  /** Override the generated id(s) — mainly for deterministic tests. Applied to the primary mark; the secondary (if any) always gets a fresh id. */
  id?: string;
}

const RANDOM_TARGET_POOL: BoardMarkTargetType[] = ["number"]; // v1 keeps curse targets simple — always a random 1-20 number bed

function resolveTarget(target: BoardMarkTarget | "random"): BoardMarkTarget {
  if (target !== "random") return target;
  const value = Math.floor(Math.random() * 20) + 1;
  return { type: "number", value };
}

function specToMark(spec: BoardMarkSpec, config: BoardMarkPrototypeCardConfig, params: CreateBoardMarkParams, id: string): BoardMark {
  let affectedPlayerId: string | undefined;
  if (spec.appliesTo === "self") affectedPlayerId = params.ownerPlayerId;
  else if (spec.appliesTo === "opponent") affectedPlayerId = params.opponentPlayerId;
  // "neutral" and "both" leave affectedPlayerId unset — eligibility is checked structurally, not by id

  return {
    id,
    type: spec.type,
    target: resolveTarget(spec.target),
    ownerPlayerId: params.ownerPlayerId,
    affectedPlayerId,
    appliesTo: spec.appliesTo,
    duration: spec.duration,
    createdByCardId: config.id,
    createdAtVisitId: params.createdAtVisitId,
    createdAtTurnId: params.createdAtTurnId,
    allowReplace: spec.allowReplace,
    metadata: spec.steal ? { steal: true } : undefined,
  };
}

/**
 * Turns a prototype card config into one or more real, placeable BoardMarks
 * for this specific match. Most cards produce exactly one mark; the 3
 * risk/reward compound cards (Wildfire, Double or Nothing, All In) produce
 * two — the primary reward mark and a self-targeted curse on a random spot.
 */
export function createBoardMarkFromPrototypeCard(
  config: BoardMarkPrototypeCardConfig,
  params: CreateBoardMarkParams
): BoardMark[] {
  const marks: BoardMark[] = [
    specToMark(config.boardMark, config, params, params.id ?? generateBoardMarkId()),
  ];
  if (config.secondaryMark) {
    marks.push(specToMark(config.secondaryMark, config, params, generateBoardMarkId()));
  }
  return marks;
}
