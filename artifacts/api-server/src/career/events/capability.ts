import type { Format, Capability } from "./types.ts";
export function capability(f: Format): Capability {
  const reasons: string[] = [];
  if (f.structure !== "KNOCKOUT") reasons.push("TOURNAMENT_STRUCTURE_NOT_IMPLEMENTED");
  if (f.game !== "X01" || f.startingScore !== 501 || f.inRule !== "STRAIGHT" || f.outRule !== "DOUBLE") reasons.push("A2_REQUIRES_501_STRAIGHT_IN_DOUBLE_OUT");
  if (f.bestOfSets !== null || f.legsPerSet !== null) reasons.push("SET_PLAY_NOT_IMPLEMENTED");
  if (f.firstThrowMethod !== "DRAW_ORDER") reasons.push("BULL_UP_INPUT_REQUIRED");
  return reasons.length ? { status: "UNSUPPORTED_FORMAT", reasons } : { status: "SUPPORTED" };
}
