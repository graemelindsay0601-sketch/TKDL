/**
 * Board Marks — prototype cards.
 *
 * 30 cards across 13 mechanic families, locked in after a full design pass
 * (see artifacts/tkdl/docs/card-clash-board-marks-v1.md for the complete
 * rationale). Deliberately NOT "20 near-duplicate cards spread across 20
 * targets" — most targets are randomized so the board genuinely looks
 * different leg to leg, and every family does something mechanically
 * distinct, not just a re-skinned score change.
 *
 *  - Bounty (hot, neutral)      — race to a spot, reward stated upfront
 *  - Curse/Cold (opponent)      — pure denial, no score effect
 *  - Curse/Trap (opponent)      — denial + real penalty
 *  - Shield (self)               — blocks enemy Cold/Trap on a spot
 *  - Reversal                    — Score Swap. Kept to exactly one card,
 *                                   Legendary only — a rare "flip the board"
 *                                   moment, not a common occurrence
 *  - Momentum                    — Surge / Weakened: multiplies a whole
 *                                   upcoming visit, not one dart
 *  - Leech                       — your dart scores normally for you AND
 *                                   hurts your opponent, same dart
 *  - Sabotage                    — remove the opponent's active mark(s)
 *                                   instead of placing a new one
 *  - Escalation                  — grows stronger the longer it goes unhit
 *  - Multi-target                — one card, three marks at once
 *  - Leg-wide                    — reshapes a whole category of the board
 *                                   (every treble / every double) for the
 *                                   rest of the leg, not just one spot
 *  - True wildcard (Unstable)    — nobody knows if it's Hot or Trap until
 *                                   someone actually hits it
 *  - Match Swing                 — reads live match state (legs/sets) and
 *                                   can directly grant or remove a leg;
 *                                   rarity-weighted drawing (see
 *                                   cards-data.ts) keeps these genuinely
 *                                   rare, and each has a safe fallback so
 *                                   drawing one never wastes the turn
 *
 * These only exist in Chaos Lab's mystery-card pool (see
 * getChaosLabCardPool in cards-data.ts — Chaos Lab draws exclusively from
 * this set, never the normal chaos pool). Never added to card_definitions
 * in the backend, so never purchasable, packable, or equippable elsewhere.
 */

import type { BoardMark, BoardMarkAppliesTo, BoardMarkDuration, BoardMarkTarget, BoardMarkType } from "./boardMarkTypes";
import { generateBoardMarkId } from "./boardMarkState";
import type { MatchSwingKind } from "./boardMarkSpecialCases";

export type BoardMarkPayload = "score_shift" | "swap_scores" | "double_next_visit" | "weaken_next_visit" | "leech_score";

/** Sentinel target values resolved to a real BoardMarkTarget at creation time — the player never knows exactly which segment until the mark is placed and shown. */
export type BoardMarkTargetSpec = BoardMarkTarget | "random" | "random_treble" | "random_double" | "random_any";

/** A single mark placement spec. */
export interface BoardMarkSpec {
  /** "unstable" is a pseudo-type resolved to "hot" or "trap" (50/50) at creation time — the real type is hidden from the player (see metadata.isUnstable) until it actually triggers. */
  type: BoardMarkType | "unstable";
  target: BoardMarkTargetSpec;
  appliesTo: BoardMarkAppliesTo;
  duration: BoardMarkDuration;
  allowReplace?: boolean;
  /** Hot: trigger steals the reward FROM the other player (zero-sum) instead of just granting it. Trap: the trapper receives what the trapped player loses. Only meaningful for payload "score_shift". */
  steal?: boolean;
  /** What happens on trigger. Defaults to "score_shift" if omitted. */
  payload?: BoardMarkPayload;
}

export type BoardMarkCardFamily =
  | "bounty" | "curse_cold" | "curse_trap" | "shield" | "reversal" | "momentum"
  | "leech" | "sabotage" | "escalation" | "multi_target" | "leg_wide" | "wildcard" | "match_swing";

export interface BoardMarkPrototypeCardConfig {
  id: string;
  name: string;
  mode: "chaos_lab";
  family: BoardMarkCardFamily;
  boardMark: BoardMarkSpec;
  /** Any number of additional marks placed at the same time as the primary one — e.g. multi-target cards placing 3 marks, or risk/reward cards placing a curse alongside a reward. */
  additionalMarks?: BoardMarkSpec[];
}

const UNTIL_HIT: BoardMarkDuration = "until_hit";
const UNTIL_LEG_END: BoardMarkDuration = "until_leg_end";
const UNTIL_AFFECTED_VISIT_END: BoardMarkDuration = "until_affected_player_visit_end";
const UNTIL_OWNER_NEXT_VISIT_END: BoardMarkDuration = "until_owner_next_visit_end";

interface RawCard {
  cardId: number;
  id: string;
  name: string;
  family: BoardMarkCardFamily;
  boardMark: BoardMarkSpec;
  additionalMarks?: BoardMarkSpec[];
}

const RAW_CARDS: RawCard[] = [
  // ── BOUNTY (4) — neutral Hot, race to the spot ──
  { cardId: 701, id: "prototype_hot_bull", name: "Hot Bull", family: "bounty", boardMark: { type: "hot", target: { type: "bull", value: "bull" }, appliesTo: "neutral", duration: UNTIL_HIT } },
  { cardId: 702, id: "prototype_hot_treble_20", name: "Hot Treble 20", family: "bounty", boardMark: { type: "hot", target: { type: "treble", value: 20 }, appliesTo: "neutral", duration: UNTIL_HIT } },
  { cardId: 703, id: "prototype_flashpoint", name: "Flashpoint", family: "bounty", boardMark: { type: "hot", target: "random_any", appliesTo: "neutral", duration: UNTIL_HIT } },
  { cardId: 704, id: "prototype_wildstrike", name: "Wildstrike", family: "bounty", boardMark: { type: "hot", target: "random_treble", appliesTo: "neutral", duration: UNTIL_HIT } },

  // ── CURSE / COLD (3) — opponent only, pure denial, no score effect ──
  { cardId: 705, id: "prototype_cold_bull", name: "Cold Bull", family: "curse_cold", boardMark: { type: "cold", target: { type: "bull", value: "bull" }, appliesTo: "opponent", duration: UNTIL_AFFECTED_VISIT_END } },
  { cardId: 706, id: "prototype_blackout", name: "Blackout", family: "curse_cold", boardMark: { type: "cold", target: "random_any", appliesTo: "opponent", duration: UNTIL_AFFECTED_VISIT_END } },
  { cardId: 707, id: "prototype_deep_freeze", name: "Deep Freeze", family: "curse_cold", boardMark: { type: "cold", target: "random_double", appliesTo: "opponent", duration: UNTIL_AFFECTED_VISIT_END } },

  // ── CURSE / TRAP (3) — opponent only, denial + real penalty, removed once sprung ──
  { cardId: 708, id: "prototype_trap_double_16", name: "Trap Double 16", family: "curse_trap", boardMark: { type: "trap", target: { type: "double", value: 16 }, appliesTo: "opponent", duration: UNTIL_HIT } },
  { cardId: 709, id: "prototype_ambush", name: "Ambush", family: "curse_trap", boardMark: { type: "trap", target: "random_any", appliesTo: "opponent", duration: UNTIL_HIT } },
  { cardId: 710, id: "prototype_snare", name: "Snare", family: "curse_trap", boardMark: { type: "trap", target: "random_treble", appliesTo: "opponent", duration: UNTIL_HIT } },

  // ── SHIELD (3) — self only, blocks enemy Cold/Trap on a spot ──
  { cardId: 711, id: "prototype_shield_d16", name: "Shield D16", family: "shield", boardMark: { type: "shield", target: { type: "double", value: 16 }, appliesTo: "self", duration: UNTIL_OWNER_NEXT_VISIT_END } },
  { cardId: 712, id: "prototype_ward", name: "Ward", family: "shield", boardMark: { type: "shield", target: "random_any", appliesTo: "self", duration: UNTIL_OWNER_NEXT_VISIT_END } },
  { cardId: 713, id: "prototype_bunker", name: "Bunker", family: "shield", boardMark: { type: "shield", target: "random_double", appliesTo: "self", duration: UNTIL_OWNER_NEXT_VISIT_END } },

  // ── REVERSAL (1) — kept to exactly one card, Legendary only, on purpose ──
  { cardId: 714, id: "prototype_score_swap", name: "Score Swap", family: "reversal", boardMark: { type: "hot", target: { type: "bull", value: "bull" }, appliesTo: "neutral", duration: UNTIL_HIT, payload: "swap_scores" } },

  // ── MOMENTUM (2) — multiplies a whole upcoming visit ──
  { cardId: 715, id: "prototype_surge", name: "Surge", family: "momentum", boardMark: { type: "hot", target: { type: "treble", value: 20 }, appliesTo: "neutral", duration: UNTIL_HIT, payload: "double_next_visit" } },
  { cardId: 716, id: "prototype_weakened", name: "Weakened", family: "momentum", boardMark: { type: "trap", target: { type: "double", value: 20 }, appliesTo: "opponent", duration: UNTIL_HIT, payload: "weaken_next_visit" } },

  // ── LEECH (2) — your dart scores normally for you AND hurts your opponent, same dart ──
  { cardId: 717, id: "prototype_siphon", name: "Siphon", family: "leech", boardMark: { type: "hot", target: { type: "bull", value: "bull" }, appliesTo: "neutral", duration: UNTIL_HIT, payload: "leech_score" } },
  { cardId: 718, id: "prototype_parasite", name: "Parasite", family: "leech", boardMark: { type: "hot", target: "random_any", appliesTo: "neutral", duration: UNTIL_HIT, payload: "leech_score" } },

  // ── SABOTAGE (2) — remove the opponent's active mark(s) instead of placing a new one. Special-cased in scorers.tsx, not a real placeable mark. ──
  { cardId: 719, id: "prototype_erase", name: "Erase", family: "sabotage", boardMark: { type: "cold", target: "random", appliesTo: "opponent", duration: UNTIL_AFFECTED_VISIT_END } }, // fallback mark if opponent has nothing to erase — never a dead draw
  { cardId: 720, id: "prototype_purge", name: "Purge", family: "sabotage", boardMark: { type: "trap", target: "random", appliesTo: "opponent", duration: UNTIL_HIT } }, // fallback mark if opponent has nothing to purge

  // ── ESCALATION (2) — grows stronger the longer it goes unhit. Special-cased in scorers.tsx for the growing-magnitude tracking. ──
  { cardId: 721, id: "prototype_slow_burn", name: "Slow Burn", family: "escalation", boardMark: { type: "hot", target: { type: "bull", value: "bull" }, appliesTo: "neutral", duration: UNTIL_HIT } },
  { cardId: 722, id: "prototype_simmering_trap", name: "Simmering Trap", family: "escalation", boardMark: { type: "trap", target: { type: "treble", value: 20 }, appliesTo: "opponent", duration: UNTIL_HIT } },

  // ── MULTI-TARGET (2) — one card, three marks at once ──
  {
    cardId: 723, id: "prototype_wildfire_spread", name: "Wildfire Spread", family: "multi_target",
    boardMark: { type: "hot", target: "random_any", appliesTo: "neutral", duration: UNTIL_HIT },
    additionalMarks: [
      { type: "hot", target: "random_any", appliesTo: "neutral", duration: UNTIL_HIT },
      { type: "hot", target: "random_any", appliesTo: "neutral", duration: UNTIL_HIT },
    ],
  },
  {
    cardId: 724, id: "prototype_minefield", name: "Minefield", family: "multi_target",
    boardMark: { type: "trap", target: "random_any", appliesTo: "opponent", duration: UNTIL_HIT },
    additionalMarks: [
      { type: "trap", target: "random_any", appliesTo: "opponent", duration: UNTIL_HIT },
      { type: "trap", target: "random_any", appliesTo: "opponent", duration: UNTIL_HIT },
    ],
  },

  // ── LEG-WIDE (2) — reshapes a whole category of the board for the rest of the leg ──
  { cardId: 725, id: "prototype_treble_curse", name: "Treble Curse", family: "leg_wide", boardMark: { type: "cold", target: { type: "treble", value: "any" }, appliesTo: "opponent", duration: UNTIL_LEG_END } },
  { cardId: 726, id: "prototype_double_trouble", name: "Double Trouble", family: "leg_wide", boardMark: { type: "hot", target: { type: "double", value: "any" }, appliesTo: "neutral", duration: UNTIL_LEG_END } },

  // ── TRUE WILDCARD (1) — nobody knows if it's Hot or Trap until someone hits it ──
  { cardId: 727, id: "prototype_unstable", name: "Unstable", family: "wildcard", boardMark: { type: "unstable", target: "random_any", appliesTo: "neutral", duration: UNTIL_HIT } },

  // ── MATCH SWING (3) — reads live legs/sets, can grant or remove a leg outright. Special-cased in scorers.tsx — these never place a mark at all. Kept genuinely rare by rarity-weighted drawing (all Legendary), and "Set Point" only enters the pool in Sets format. ──
  { cardId: 728, id: "prototype_overtake", name: "Overtake", family: "match_swing", boardMark: { type: "hot", target: { type: "bull", value: "bull" }, appliesTo: "neutral", duration: UNTIL_HIT } }, // placeholder mark, never actually placed — see special-case handling
  { cardId: 729, id: "prototype_underdogs_grace", name: "Underdog's Grace", family: "match_swing", boardMark: { type: "hot", target: { type: "bull", value: "bull" }, appliesTo: "neutral", duration: UNTIL_HIT } },
  { cardId: 730, id: "prototype_set_point", name: "Set Point", family: "match_swing", boardMark: { type: "hot", target: { type: "bull", value: "bull" }, appliesTo: "neutral", duration: UNTIL_HIT } },
];

function toConfig(raw: RawCard): BoardMarkPrototypeCardConfig {
  return { id: raw.id, name: raw.name, mode: "chaos_lab", family: raw.family, boardMark: raw.boardMark, additionalMarks: raw.additionalMarks };
}

export const BOARD_MARK_PROTOTYPE_CARDS: BoardMarkPrototypeCardConfig[] = RAW_CARDS.map(toConfig);

/** Maps the numeric card id used in cards-data.ts to its Board Mark config. */
export const BOARD_MARK_CARD_ID_MAP: Record<number, BoardMarkPrototypeCardConfig> =
  Object.fromEntries(RAW_CARDS.map((raw, i) => [raw.cardId, BOARD_MARK_PROTOTYPE_CARDS[i]]));

/** Sabotage cards remove the opponent's mark(s) instead of placing one — special-cased in scorers.tsx before the normal placement path. */
export const BOARD_MARK_SABOTAGE_CARD_IDS: Record<number, "erase" | "purge"> = { 719: "erase", 720: "purge" };

/** Escalation cards grow stronger the longer they go unhit — special-cased in scorers.tsx to track visits-survived per mark. */
export const BOARD_MARK_ESCALATION_CARD_IDS = new Set([721, 722]);

/** Match Swing cards read live match state and resolve immediately on draw — special-cased in scorers.tsx, never actually placed as a mark. */
export const BOARD_MARK_MATCH_SWING_CARD_IDS: Record<number, MatchSwingKind> = {
  728: "overtake",
  729: "underdogs_grace",
  730: "set_point",
};

export interface CreateBoardMarkParams {
  ownerPlayerId: string;
  /** Required when the card's appliesTo is "opponent" or "self" needs the other player's id for symmetry checks. */
  opponentPlayerId: string;
  createdAtVisitId?: string;
  createdAtTurnId?: string;
  /** Override the generated id — mainly for deterministic tests. Applied to the primary mark; additional marks always get a fresh id. */
  id?: string;
}

function resolveTarget(target: BoardMarkTarget | "random" | "random_treble" | "random_double" | "random_any"): BoardMarkTarget {
  if (target === "random") return { type: "number", value: Math.floor(Math.random() * 20) + 1 };
  if (target === "random_treble") return { type: "treble", value: Math.floor(Math.random() * 20) + 1 };
  if (target === "random_double") return { type: "double", value: Math.floor(Math.random() * 20) + 1 };
  if (target === "random_any") {
    const roll = Math.random();
    if (roll < 0.1) return { type: "bull", value: "bull" };
    if (roll < 0.4) return { type: "treble", value: Math.floor(Math.random() * 20) + 1 };
    if (roll < 0.7) return { type: "double", value: Math.floor(Math.random() * 20) + 1 };
    return { type: "number", value: Math.floor(Math.random() * 20) + 1 };
  }
  return target;
}

function specToMark(spec: BoardMarkSpec, config: BoardMarkPrototypeCardConfig, params: CreateBoardMarkParams, id: string): BoardMark {
  let affectedPlayerId: string | undefined;
  if (spec.appliesTo === "self") affectedPlayerId = params.ownerPlayerId;
  else if (spec.appliesTo === "opponent") affectedPlayerId = params.opponentPlayerId;
  // "neutral" and "both" leave affectedPlayerId unset — eligibility is checked structurally, not by id

  // "unstable" resolves to a real type (hot/trap, 50/50) right now, at
  // creation time — the player just isn't TOLD which one until it triggers
  // (see metadata.isUnstable, checked by the UI to show "???" instead of
  // the real type). This keeps the resolver/lifecycle/conflict engine
  // completely unaware of "unstable" as a concept — by the time any of
  // that code sees the mark, it's already a perfectly normal hot or trap.
  const isUnstable = spec.type === "unstable";
  const resolvedType: BoardMarkType = isUnstable ? (Math.random() < 0.5 ? "hot" : "trap") : (spec.type as BoardMarkType);

  return {
    id,
    type: resolvedType,
    target: resolveTarget(spec.target),
    ownerPlayerId: params.ownerPlayerId,
    affectedPlayerId,
    appliesTo: spec.appliesTo,
    duration: spec.duration,
    createdByCardId: config.id,
    createdAtVisitId: params.createdAtVisitId,
    createdAtTurnId: params.createdAtTurnId,
    allowReplace: spec.allowReplace,
    metadata: { steal: !!spec.steal, payload: spec.payload ?? "score_shift", isUnstable },
  };
}

/**
 * Turns a prototype card config into one or more real, placeable BoardMarks
 * for this specific match. Most cards produce exactly one mark; multi-target
 * cards (Wildfire Spread, Minefield) produce three.
 */
export function createBoardMarkFromPrototypeCard(
  config: BoardMarkPrototypeCardConfig,
  params: CreateBoardMarkParams
): BoardMark[] {
  const marks: BoardMark[] = [
    specToMark(config.boardMark, config, params, params.id ?? generateBoardMarkId()),
  ];
  for (const spec of config.additionalMarks ?? []) {
    marks.push(specToMark(spec, config, params, generateBoardMarkId()));
  }
  return marks;
}
