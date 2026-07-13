/**
 * Board Marks v1 — prototype cards.
 *
 * Four proof-of-concept cards, one per mark type, proving the mechanic end
 * to end. These are test/proof cards, not a final balanced set — see the
 * design spec section 15. They only exist in Chaos Lab's mystery-card pool
 * (mixed in with the normal chaos pool); they are never added to
 * card_definitions in the backend, so they're never purchasable, packable,
 * or equippable anywhere else.
 */

import type { BoardMark, BoardMarkAppliesTo, BoardMarkDuration, BoardMarkTarget, BoardMarkType } from "./boardMarkTypes";
import { generateBoardMarkId } from "./boardMarkState";

export interface BoardMarkPrototypeCardConfig {
  id: string;
  name: string;
  mode: "chaos_lab";
  boardMark: {
    type: BoardMarkType;
    target: BoardMarkTarget;
    appliesTo: BoardMarkAppliesTo;
    duration: BoardMarkDuration;
    allowReplace?: boolean;
  };
}

export const HOT_BULL: BoardMarkPrototypeCardConfig = {
  id: "prototype_hot_bull",
  name: "Hot Bull",
  mode: "chaos_lab",
  boardMark: {
    type: "hot",
    target: { type: "bull", value: "bull" },
    appliesTo: "neutral",
    duration: "until_hit",
  },
};

export const COLD_20S: BoardMarkPrototypeCardConfig = {
  id: "prototype_cold_20s",
  name: "Cold 20s",
  mode: "chaos_lab",
  boardMark: {
    type: "cold",
    target: { type: "number", value: 20 },
    appliesTo: "opponent",
    duration: "until_affected_player_visit_end",
  },
};

export const TRAP_T20: BoardMarkPrototypeCardConfig = {
  id: "prototype_trap_t20",
  name: "Trap T20",
  mode: "chaos_lab",
  boardMark: {
    type: "trap",
    target: { type: "treble", value: 20 },
    appliesTo: "opponent",
    duration: "until_hit",
  },
};

export const SHIELD_D16: BoardMarkPrototypeCardConfig = {
  id: "prototype_shield_d16",
  name: "Shield D16",
  mode: "chaos_lab",
  boardMark: {
    type: "shield",
    target: { type: "double", value: 16 },
    appliesTo: "self",
    duration: "until_owner_next_visit_end",
  },
};

export const BOARD_MARK_PROTOTYPE_CARDS: BoardMarkPrototypeCardConfig[] = [
  HOT_BULL,
  COLD_20S,
  TRAP_T20,
  SHIELD_D16,
];

/**
 * Maps the numeric card id used in cards-data.ts (701-704) to its Board Mark
 * config. This is the join point between the card data layer and this
 * module — kept here rather than in cards-data.ts so boardMarks stays the
 * single source of truth for what each prototype card actually does.
 */
export const BOARD_MARK_CARD_ID_MAP: Record<number, BoardMarkPrototypeCardConfig> = {
  701: HOT_BULL,
  702: COLD_20S,
  703: TRAP_T20,
  704: SHIELD_D16,
};

export interface CreateBoardMarkParams {
  ownerPlayerId: string;
  /** Required when the card's appliesTo is "opponent" or "self" needs the other player's id for symmetry checks. */
  opponentPlayerId: string;
  createdAtVisitId?: string;
  createdAtTurnId?: string;
  /** Override the generated id — mainly for deterministic tests. */
  id?: string;
}

/** Turns a prototype card config into a real, placeable BoardMark for this specific match. */
export function createBoardMarkFromPrototypeCard(
  config: BoardMarkPrototypeCardConfig,
  params: CreateBoardMarkParams
): BoardMark {
  const { boardMark } = config;

  let affectedPlayerId: string | undefined;
  if (boardMark.appliesTo === "self") affectedPlayerId = params.ownerPlayerId;
  else if (boardMark.appliesTo === "opponent") affectedPlayerId = params.opponentPlayerId;
  // "neutral" and "both" leave affectedPlayerId unset — eligibility is checked structurally, not by id

  return {
    id: params.id ?? generateBoardMarkId(),
    type: boardMark.type,
    target: boardMark.target,
    ownerPlayerId: params.ownerPlayerId,
    affectedPlayerId,
    appliesTo: boardMark.appliesTo,
    duration: boardMark.duration,
    createdByCardId: config.id,
    createdAtVisitId: params.createdAtVisitId,
    createdAtTurnId: params.createdAtTurnId,
    allowReplace: boardMark.allowReplace,
  };
}
