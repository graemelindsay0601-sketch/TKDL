/**
 * WDF Seniors World Ranking Systems Criteria, 50th revised edition
 * (17 August 2026), sections 14–15.
 *
 * This is deliberately separate from the PDC prize-money ranking engine.
 */
export type WdfGrade = "PLATINUM" | "GOLD" | "SILVER" | "BRONZE";

/** Official WDF grades where the event is a real WDF event. */
const OFFICIAL_WDF_EVENT_GRADES: Readonly<Record<string, WdfGrade>> = Object.freeze({
  "wdf-world-championship": "PLATINUM",
  "women-world-championship": "PLATINUM",
  // WDF 2026 event pages identify both World Masters divisions as Platinum.
  "wdf-world-masters": "PLATINUM",
  "women-masters": "PLATINUM",
  "wdf-gold-open": "GOLD",
  "wdf-silver-open": "SILVER",
  "wdf-bronze-open": "BRONZE",
});
/**
 * These named events are fictional WDF-inspired Career fixtures, not claims
 * about WDF-sanctioned grades. Their explicit Career tiers make the game
 * ranking complete while keeping official and authored grading distinguishable.
 * Global headline events are Gold, established regional events Silver, and
 * the smaller national opens Bronze; WDF regional tables still cap Gold at Silver.
 */
const CAREER_AUTHORED_EVENT_GRADES: Readonly<Record<string, WdfGrade>> = Object.freeze({
  "wdf-nevada-open": "GOLD",
  "wdf-low-countries-open": "GOLD",
  "wdf-caledonian-open": "SILVER",
  "wdf-manx-open": "BRONZE",
  "wdf-ulster-open": "BRONZE",
  "wdf-baltic-open": "SILVER",
  "wdf-britannia-open": "GOLD",
  "wdf-danube-masters": "SILVER",
  "wdf-emerald-open": "SILVER",
  "wdf-bohemian-open": "BRONZE",
  "wdf-mediterranean-masters": "GOLD",
  "wdf-southern-cross-open": "GOLD",
  "women-tour": "SILVER",
  "world-ranking-open": "BRONZE",
  "women-world-ranking-open": "BRONZE",
  "youth-world-championship": "GOLD",
  "wdf-world-girls-championship": "GOLD",
  "youth-masters": "GOLD",
  "youth-world-ranking-open": "BRONZE",
  "girls-world-ranking-open": "BRONZE",
  "u23-world-ranking-open": "BRONZE",
  "u23-girls-world-ranking-open": "BRONZE",
});
export const WDF_OFFICIAL_GRADE_KEYS = new Set(Object.keys(OFFICIAL_WDF_EVENT_GRADES));
export const WDF_CAREER_GRADE_KEYS = new Set(Object.keys(CAREER_AUTHORED_EVENT_GRADES));
export const WDF_EVENT_GRADES: Readonly<Record<string, WdfGrade>> = Object.freeze({
  ...OFFICIAL_WDF_EVENT_GRADES, ...CAREER_AUTHORED_EVENT_GRADES,
});
export const wdfGradeForEvent = (definitionKey: string): WdfGrade | null => WDF_EVENT_GRADES[definitionKey] ?? null;
export const WDF_MAJOR_EVENT_KEYS = new Set([
  "wdf-world-championship", "wdf-world-masters", "women-world-championship", "women-masters",
  "youth-world-championship", "wdf-world-girls-championship", "youth-masters",
]);

const POINTS: Record<WdfGrade, readonly number[]> = {
  PLATINUM: [270, 167, 103, 64, 39, 26, 13],
  GOLD: [180, 111, 68, 43, 26, 17, 9],
  SILVER: [90, 56, 34, 21, 13, 9, 0],
  BRONZE: [45, 28, 17, 11, 6, 0, 0],
};
const MINIMUM_ENTRIES = [2, 4, 8, 16, 32, 64, 128] as const;

/** Return the official points for a finishing position, or zero when the draw/
 * completed-round requirements do not permit that points band. */
export function wdfPointsForFinish(input: {
  grade: WdfGrade;
  position: number;
  entries: number;
  completeRoundPlayed: boolean;
  regional?: boolean;
}): number {
  const { grade, position, entries, completeRoundPlayed, regional = false } = input;
  if (!completeRoundPlayed || !Number.isInteger(position) || position < 1 || entries < 2) return 0;
  const band = position <= 1 ? 0 : position <= 2 ? 1 : position <= 4 ? 2 : position <= 8 ? 3
    : position <= 16 ? 4 : position <= 32 ? 5 : position <= 64 ? 6 : -1;
  if (band < 0) return 0;
  const minimumEntries = (MINIMUM_ENTRIES as readonly number[])[band];
  if (minimumEntries === undefined || entries < minimumEntries) return 0;
  const effectiveGrade = regional && (grade === "PLATINUM" || grade === "GOLD") ? "SILVER" : grade;
  return POINTS[effectiveGrade][band] ?? 0;
}

export type WdfAchievement = { points: number; completionIndex: number; eventId: string };

export type WdfMatch = { stage_key: string; round: number; status: string; a_key: string | null; b_key: string | null; winner_key: string | null };

/** A points-eligible round has no allocated byes and is fully played. A
 * walkover counts only when the withdrawing opponent completed an earlier round. */
export function hasCompleteWdfRound(matches: readonly WdfMatch[]): boolean {
  const completed = matches.filter(m => m.status === "COMPLETED");
  const validWalkovers = new Set<WdfMatch>();
  for (const match of matches.filter(m => m.status === "WALKOVER")) {
    const loser = match.winner_key === match.a_key ? match.b_key : match.a_key;
    if (loser && completed.some(previous => previous.stage_key === match.stage_key
      && previous.round < match.round && (previous.a_key === loser || previous.b_key === loser))) validWalkovers.add(match);
  }
  const rounds = new Map<string, WdfMatch[]>();
  for (const match of matches) {
    const key = `${match.stage_key}:${match.round}`;
    const group = rounds.get(key) ?? [];
    group.push(match);
    rounds.set(key, group);
  }
  return [...rounds.values()].some(round => round.length > 0
    && round.every(match => match.status !== "BYE")
    && round.every(match => match.status === "COMPLETED" || validWalkovers.has(match)));
}

/** WDF rolling tables count only the best N results in the active 52-week window. */
export function bestWdfAchievements(
  achievements: readonly WdfAchievement[],
  publicationIndex: number,
  bestN: 8 | 10,
): WdfAchievement[] {
  return achievements
    .filter(a => a.points > 0 && a.completionIndex <= publicationIndex && a.completionIndex > publicationIndex - 52)
    .slice()
    .sort((a, b) => b.points - a.points || b.completionIndex - a.completionIndex || a.eventId.localeCompare(b.eventId))
    .slice(0, bestN);
}
