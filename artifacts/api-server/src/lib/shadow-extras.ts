// Pure bits for Legend shadows, Haunt a friend and Possession (database side in shadow-extras-db.ts).

export const LEGEND_UNLOCK = { id: "tag-sh-legend-slayer", category: "LEADERBOARD_TAG", name: "LEGEND SLAYER", rarity: "LEGENDARY", color: "#ffd24a", sortOrder: 221 };
export const EXORCIST_UNLOCK = { id: "tag-sh-exorcist", category: "LEADERBOARD_TAG", name: "EXORCIST", rarity: "EPIC", color: "#7dd3fc", sortOrder: 222 };
export const EXTRAS_EARNED_BY: Record<string, string> = {
  [LEGEND_UNLOCK.id]: "Beat a Legend shadow (a past season's top 3, frozen at their best)",
  [EXORCIST_UNLOCK.id]: "Beat this week's possessed boss in Boss Battle",
};

export const LEGEND_TOP = 3;
export const HAUNT_DAYS = 7;
export const MAX_OPEN_HAUNTS = 5;

export function legendLabel(season: string, position: number): string {
  return `${season} ${position === 1 ? "champion" : position === 2 ? "runner-up" : "3rd place"}`;
}

/** Season darts first; if there aren't enough thrown one at a time, everything up to the season's end. */
export function legendWindow<T extends { at: string; phase: string }>(darts: T[], start: string, end: string): T[] {
  const endT = new Date(`${end}T23:59:59Z`).getTime(), startT = new Date(`${start}T00:00:00Z`).getTime();
  const upToEnd = darts.filter(d => new Date(d.at).getTime() <= endT);
  const season = upToEnd.filter(d => new Date(d.at).getTime() >= startT);
  return season.filter(d => d.phase === "scoring").length >= 60 ? season : upToEnd;
}

export function validateHaunt(fromId: number, toId: number, targetActive: boolean, alreadyOpen: boolean, openSent: number): string | null {
  if (!Number.isInteger(toId) || toId <= 0) return "Pick someone to haunt";
  if (fromId === toId) return "You can't haunt yourself";
  if (!targetActive) return "That player isn't active";
  if (alreadyOpen) return "Your shadow is already haunting them";
  if (openSent >= MAX_OPEN_HAUNTS) return `Your shadow can only haunt ${MAX_OPEN_HAUNTS} people at once`;
  return null;
}
