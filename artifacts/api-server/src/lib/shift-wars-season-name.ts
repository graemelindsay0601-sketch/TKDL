export const TEAM_LEADERSHIP_EFFECTIVE_DATE = "2026-11-01";

/** The department rename is applied only when opening a November 2026+ season. */
export function shouldUseTeamLeadershipName(seasonStartDate: string): boolean {
  return seasonStartDate >= TEAM_LEADERSHIP_EFFECTIVE_DATE;
}
