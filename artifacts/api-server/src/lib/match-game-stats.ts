// Validation for the Cricket / Around the World stats a live-scored league
// match sends (see routes/match-game-stats.ts). Pure, so it's unit-tested.

export const CRICKET_KEYS = ["cricket", "cutthroat_cricket", "cricket_no_bull", "tactics"] as const;
export const ATW_KEYS = ["around_the_world", "atw"] as const;

export type GameKind = "cricket" | "atw";

export function gameStatsKind(gameType: string | null | undefined): GameKind | null {
  if ((CRICKET_KEYS as readonly string[]).includes(gameType ?? "")) return "cricket";
  if ((ATW_KEYS as readonly string[]).includes(gameType ?? "")) return "atw";
  return null;
}

const int = (v: unknown, max: number) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max ? (v as number) : null);

export type CleanCricket = { darts: number; visits: number; marks: number; bestVisit: number; nineMarkVisits: number; blankVisits: number };
export type CleanAtw = { darts: number; visits: number; bestVisit: number; trebleSkips: number; doubleSkips: number; bullDarts: number; blankVisits: number };

export function cleanGameStats(kind: GameKind, raw: unknown): CleanCricket | CleanAtw | null {
  if (!raw || typeof raw !== "object") return null;
  const x = raw as Record<string, unknown>;
  const darts = int(x.darts, 3000), visits = int(x.visits, 1000), blankVisits = int(x.blankVisits, 1000);
  if (darts === null || visits === null || blankVisits === null) return null;
  if (visits > darts || darts > visits * 3 || blankVisits > visits) return null;
  if (kind === "cricket") {
    const marks = int(x.marks, 9000), bestVisit = int(x.bestVisit, 9), nineMarkVisits = int(x.nineMarkVisits, 1000);
    if (marks === null || bestVisit === null || nineMarkVisits === null) return null;
    if (marks > darts * 3 || nineMarkVisits > visits || bestVisit > marks) return null;
    return { darts, visits, marks, bestVisit, nineMarkVisits, blankVisits };
  }
  const bestVisit = int(x.bestVisit, 9), trebleSkips = int(x.trebleSkips, 3000), doubleSkips = int(x.doubleSkips, 3000), bullDarts = int(x.bullDarts, 3000);
  if (bestVisit === null || trebleSkips === null || doubleSkips === null || bullDarts === null) return null;
  if (trebleSkips + doubleSkips > darts || bullDarts > darts) return null;
  return { darts, visits, bestVisit, trebleSkips, doubleSkips, bullDarts, blankVisits };
}
