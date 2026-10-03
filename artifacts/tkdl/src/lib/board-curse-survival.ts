import type { CurseGameMode } from "./board-curse-data";

/** Visit allowance for the next Endless leg. It tightens every two clears,
 * but never below ten visits so long streaks remain difficult, not impossible. */
export function endlessVisitLimit(gameMode: CurseGameMode, completedLegs: number): number {
  const startingLimit = gameMode === "X01" ? 18 : 20;
  return Math.max(10, startingLimit - Math.floor(Math.max(0, completedLegs) / 2));
}

export function dailyVisitLimit(gameMode: CurseGameMode): number {
  return gameMode === "X01" ? 15 : 17;
}
