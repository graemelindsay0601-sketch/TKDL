/**
 * Board Marks v1 — public exports.
 *
 * This is the only import path other code (Chaos Lab integration, cards,
 * tests) should use — `import { ... } from "@/lib/card-clash/boardMarks"`.
 */

export * from "./boardMarkTypes";
export * from "./boardMarkTargets";
export * from "./boardMarkMatcher";
export * from "./boardMarkConflicts";
export * from "./boardMarkState";
export * from "./boardMarkResolver";
export * from "./boardMarkLifecycle";
export * from "./boardMarkPrototypeCards";
export * from "./boardMarkRewards";
