import { z } from "zod";

/**
 * Structured sporting format. Metadata can describe far more than A3 executes;
 * executability is decided only by assessCapability(), never by display text.
 */
export const GAME_TYPES = ["X01", "CRICKET", "HALVE_IT", "KILLER", "SHANGHAI", "BOBS_27", "SCRAM", "BASEBALL", "FIVES", "GOLF", "FOOTBALL", "NOUGHTS_AND_CROSSES", "SNOOKER", "COUNT_UP", "OTHER"] as const;
export const STRUCTURES = ["KNOCKOUT", "GROUP_KNOCKOUT", "ROUND_ROBIN", "LEAGUE", "MULTI_DAY_KNOCKOUT"] as const;
export const FIRST_THROW_METHODS = ["BULL_UP", "ALTERNATE_FROM_DRAW", "HIGHER_SEED"] as const;
export const SCORING_UNITS = ["LEGS", "SETS"] as const;

const stageSchema = z.object({
  key: z.string().min(1).max(40),
  kind: z.enum(["KNOCKOUT", "GROUP", "LEAGUE"]),
  /** Best-of by knockout round from first round onwards; the last value repeats. */
  bestOfByRound: z.array(z.number().int().min(1).max(101).refine(n => n % 2 === 1, "bestOf must be odd")).min(1),
  groupSize: z.number().int().min(3).max(16).optional(),
  advancePerGroup: z.number().int().min(1).max(8).optional(),
}).strict();

export const eventFormatSchema = z.object({
  gameType: z.enum(GAME_TYPES),
  startingScore: z.number().int().min(101).max(3001).nullable(),
  inRule: z.enum(["STRAIGHT", "DOUBLE", "MASTER"]).nullable(),
  outRule: z.enum(["DOUBLE", "STRAIGHT", "MASTER"]).nullable(),
  scoringUnit: z.enum(SCORING_UNITS),
  /** For SETS: legs per set (best-of). Null for LEGS. */
  legsPerSet: z.number().int().min(1).max(11).nullable(),
  structure: z.enum(STRUCTURES),
  stages: z.array(stageSchema).min(1),
  days: z.number().int().min(1).max(21),
  firstThrowMethod: z.enum(FIRST_THROW_METHODS),
  /** 1 = singles. 2 = pairs (doubles); no A3 engine for pairs. */
  sideSize: z.union([z.literal(1), z.literal(2)]),
  /** A2 match context category used for NPC simulation pressure. */
  matchContext: z.enum(["local", "floor", "stage", "qualifier", "major"]),
}).strict();
export type EventFormat = z.infer<typeof eventFormatSchema>;

export type UnsupportedReason =
  | "GAME_TYPE" | "STARTING_SCORE" | "IN_RULE" | "OUT_RULE" | "SET_PLAY" | "STRUCTURE" | "PAIRS";
export type Capability =
  | { executable: true; engine: "A2_X01_KNOCKOUT" | "A2_X01_GROUP_KNOCKOUT"; simulationVersion: 1; liveScorer: "GAME_SCORER_X01" }
  | { executable: true; engine: "A2_501_DO_KNOCKOUT"; simulationVersion: 1 }
  | { executable: false; code: "UNSUPPORTED_FORMAT"; reasons: UnsupportedReason[] };

/** Bumped when the set of executable formats changes; existing future instances are re-assessed. */
export const CAPABILITY_ENGINE_VERSION = 4;

/**
 * A format is executable only when BOTH sides of a Career tournament can run it
 * with the same rules: the human through the shared TKDL scorer (darts-rules /
 * GameScorer X01) and every NPC match through A2's dart-level simulation.
 * Shared X01 and A2 support 101..1001, straight/double-in, double-out,
 * legs/sets and singles knockout. A8.2 adds its explicitly versioned 4x4
 * group -> KO format. Master-out, leagues, pairs and other games remain benched.
 */
export function assessCapability(format: EventFormat, allowGroups = false): Capability {
  eventFormatSchema.parse(format);
  const reasons: UnsupportedReason[] = [];
  if (format.gameType !== "X01") reasons.push("GAME_TYPE");
  else {
    if (format.startingScore === null || format.startingScore < 101 || format.startingScore > 1001) reasons.push("STARTING_SCORE");
    if (format.inRule !== "STRAIGHT" && format.inRule !== "DOUBLE") reasons.push("IN_RULE");
    if (format.outRule !== "DOUBLE") reasons.push("OUT_RULE");
  }
  if (format.scoringUnit === "SETS" && !(format.legsPerSet && format.legsPerSet % 2 === 1)) reasons.push("SET_PLAY");
  if (format.sideSize !== 1) reasons.push("PAIRS");
  const groups = allowGroups && format.structure === "GROUP_KNOCKOUT" && format.scoringUnit === "LEGS"
    && format.stages.length === 2 && format.stages[0].kind === "GROUP" && format.stages[0].groupSize === 4
    && format.stages[0].advancePerGroup === 2 && format.stages[1].kind === "KNOCKOUT";
  if (!groups && !(format.structure === "KNOCKOUT" && format.stages.length === 1 && format.stages[0].kind === "KNOCKOUT")) reasons.push("STRUCTURE");
  return reasons.length ? { executable: false, code: "UNSUPPORTED_FORMAT", reasons } : { executable: true, engine: groups ? "A2_X01_GROUP_KNOCKOUT" : "A2_X01_KNOCKOUT", simulationVersion: 1, liveScorer: "GAME_SCORER_X01" };
}

/** A3 format -> A2 match format for one match (best-of from the bracket row). */
export function a2MatchFormat(format: EventFormat, bestOf: number, firstThrow: 0 | 1) {
  const base: { bestOf: number; firstThrow: 0 | 1; startingScore?: number; inRule?: "STRAIGHT" | "DOUBLE"; unit?: "LEGS" | "SETS"; legsPerSet?: number } = { bestOf, firstThrow };
  // Omit defaults so legacy 501 straight-in legs requests stay byte-identical.
  if (format.startingScore !== null && format.startingScore !== 501) base.startingScore = format.startingScore;
  if (format.inRule === "DOUBLE") base.inRule = "DOUBLE";
  if (format.scoringUnit === "SETS") { base.unit = "SETS"; base.legsPerSet = format.legsPerSet!; }
  return base;
}

/** A3 format -> shared live-scorer format for one match. */
export function liveMatchFormat(format: EventFormat, bestOf: number) {
  const common = { startingScore: format.startingScore ?? 501, inRule: (format.inRule ?? "STRAIGHT") as "STRAIGHT" | "DOUBLE", outRule: "DOUBLE" as const };
  return format.scoringUnit === "SETS"
    ? { ...common, unit: "SETS" as const, bestOfSets: bestOf, bestOfLegsPerSet: format.legsPerSet! }
    : { ...common, unit: "LEGS" as const, bestOfLegs: bestOf };
}

/** Best-of aligned from the final backwards, so the authored final format always applies. */
export const bestOfForRound = (format: EventFormat, round: number, totalRounds: number) => {
  const table = format.stages[0].bestOfByRound;
  return table[Math.max(0, table.length - 1 - (totalRounds - round))];
};

/** Format builders keep authored definitions terse and structured. */
export const knockout501 = (bestOfByRound: number[], matchContext: EventFormat["matchContext"], days = 1, firstThrowMethod: EventFormat["firstThrowMethod"] = "BULL_UP"): EventFormat => ({
  gameType: "X01", startingScore: 501, inRule: "STRAIGHT", outRule: "DOUBLE", scoringUnit: "LEGS", legsPerSet: null,
  structure: "KNOCKOUT", stages: [{ key: "main", kind: "KNOCKOUT", bestOfByRound }], days, firstThrowMethod, sideSize: 1, matchContext,
});
export const setsKnockout501 = (setsByRound: number[], legsPerSet: number, matchContext: EventFormat["matchContext"], days: number, inRule: "STRAIGHT" | "DOUBLE" = "STRAIGHT"): EventFormat => ({
  gameType: "X01", startingScore: 501, inRule, outRule: "DOUBLE", scoringUnit: "SETS", legsPerSet,
  structure: "KNOCKOUT", stages: [{ key: "main", kind: "KNOCKOUT", bestOfByRound: setsByRound }], days, firstThrowMethod: "BULL_UP", sideSize: 1, matchContext,
});
export const groupKnockout501 = (groupBestOf: number, knockoutBestOf: number[], groupSize: number, advancePerGroup: number, matchContext: EventFormat["matchContext"], days: number): EventFormat => ({
  gameType: "X01", startingScore: 501, inRule: "STRAIGHT", outRule: "DOUBLE", scoringUnit: "LEGS", legsPerSet: null, structure: "GROUP_KNOCKOUT",
  stages: [{ key: "groups", kind: "GROUP", bestOfByRound: [groupBestOf], groupSize, advancePerGroup }, { key: "knockout", kind: "KNOCKOUT", bestOfByRound: knockoutBestOf }],
  days, firstThrowMethod: "BULL_UP", sideSize: 1, matchContext,
});
export const league501 = (bestOf: number, matchContext: EventFormat["matchContext"], days: number): EventFormat => ({
  gameType: "X01", startingScore: 501, inRule: "STRAIGHT", outRule: "DOUBLE", scoringUnit: "LEGS", legsPerSet: null, structure: "LEAGUE",
  stages: [{ key: "league", kind: "LEAGUE", bestOfByRound: [bestOf] }, { key: "playoffs", kind: "KNOCKOUT", bestOfByRound: [bestOf + 8, bestOf + 10] }],
  days, firstThrowMethod: "BULL_UP", sideSize: 1, matchContext,
});
export const x01Variant = (startingScore: number, inRule: "STRAIGHT" | "DOUBLE", bestOfByRound: number[], matchContext: EventFormat["matchContext"]): EventFormat => ({
  ...knockout501(bestOfByRound, matchContext), startingScore, inRule,
});
export const specialGame = (gameType: Exclude<typeof GAME_TYPES[number], "X01">, bestOfByRound: number[]): EventFormat => ({
  gameType, startingScore: null, inRule: null, outRule: null, scoringUnit: "LEGS", legsPerSet: null, structure: "KNOCKOUT",
  stages: [{ key: "main", kind: "KNOCKOUT", bestOfByRound }], days: 1, firstThrowMethod: "BULL_UP", sideSize: 1, matchContext: "local",
});
export const pairs501 = (bestOfByRound: number[]): EventFormat => ({ ...knockout501(bestOfByRound, "local"), sideSize: 2 });
