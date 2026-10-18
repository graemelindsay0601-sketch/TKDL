import type { CareerSave } from "./types";

/**
 * Unlock as you go: a new player meets the extras one at a time instead of all at once. Each opens after a number of
 * events played (from season 2 everything is open). Nothing is ever blocked: a locked page still opens from a link;
 * it just isn't listed until it's useful.
 */
export const UNLOCKS = [
  { key: "road-trips", label: "Road trips", afterEvents: 1 },
  { key: "pro-am", label: "Pro-Am nights", afterEvents: 3 },
  { key: "cam-league", label: "the webcam league", afterEvents: 3 },
  { key: "sponsors", label: "sponsors and managers", afterEvents: 3 },
  { key: "streaming", label: "DartCast streaming", afterEvents: 5 },
] as const;
export type UnlockKey = typeof UNLOCKS[number]["key"];

const seenKey = (saveId: string, key: string) => `tkdl-career-visited-${key}-${saveId}`;
const seen = (saveId: string, key: string) => { try { return localStorage.getItem(seenKey(saveId, key)) === "1"; } catch { return true; } };
/** Remember (on this device) that a player has opened an unlocked page, so it stops being marked new. */
export function markSeen(saveId: string, key: UnlockKey) { try { localStorage.setItem(seenKey(saveId, key), "1"); } catch { /* convenience only */ } }

export function unlockState(save: Pick<CareerSave, "currentSeason" | "status">, played: number) {
  const everything = save.currentSeason > 1 || save.status === "RETIRED";
  // Pages without an unlock rule are always open.
  const isOpen = (key: UnlockKey) => { const u = UNLOCKS.find(x => x.key === key); return everything || !u || played >= u.afterEvents; };
  const next = everything ? null : UNLOCKS.find(u => played < u.afterEvents) ?? null;
  return { played, everything, isOpen, next };
}

/** "Road trips open after your first event" — the next thing to look forward to. */
export const nextUnlockLine = (next: typeof UNLOCKS[number] | null, played: number) => {
  if (!next) return null;
  const left = next.afterEvents - played;
  const what = next.label[0].toUpperCase() + next.label.slice(1);
  return `${what} ${next.label.endsWith("s") && !next.label.startsWith("the") ? "open" : "opens"} after ${left === 1 ? "your next event" : `${left} more events`}.`;
};
