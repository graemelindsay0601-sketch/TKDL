/**
 * WDF Seniors World Ranking Systems Criteria, 50th revised edition
 * (17 August 2026), sections 14–15.
 *
 * This is deliberately separate from the PDC prize-money ranking engine.
 */
export type WdfGrade = "PLATINUM" | "GOLD" | "SILVER" | "BRONZE";

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
  if (band < 0 || entries < MINIMUM_ENTRIES[band]) return 0;
  const effectiveGrade = regional && (grade === "PLATINUM" || grade === "GOLD") ? "SILVER" : grade;
  return POINTS[effectiveGrade][band] ?? 0;
}

export type WdfAchievement = { points: number; completionIndex: number; eventId: string };

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
