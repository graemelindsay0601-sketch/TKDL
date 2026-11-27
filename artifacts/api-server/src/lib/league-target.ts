/**
 * League Target: one goal for the whole league each month, set by the app from the league's own recent months.
 * Pure helpers (tested); the DB side is in league-target-db.ts.
 *
 * Sized for a small workplace league (about 20-30 matches a month, about 12 players, played on breaks):
 * target = average of the last 2 months + 10%, rounded up, then held between a floor and a cap.
 * Every match type counts (singles, doubles, Shift Wars, team games).
 */

export type TargetKind = "matches" | "pairings" | "oneEighties" | "players";

export type MonthStats = { matches: number; pairings: number; oneEighties: number; players: number };

export const KIND_INFO: Record<TargetKind, { label: string; unit: string; floor: number; cap: number; blurb: string }> = {
  matches:     { label: "Matches played",     unit: "matches",   floor: 15, cap: 40, blurb: "Every result saved this month counts — singles, doubles, Shift Wars." },
  pairings:    { label: "Different match-ups", unit: "match-ups", floor: 10, cap: 30, blurb: "Pairs of players who've faced each other at least once this month." },
  oneEighties: { label: "180s",               unit: "180s",      floor: 2,  cap: 10, blurb: "180s thrown in league matches on the scorer." },
  players:     { label: "Players involved",   unit: "players",   floor: 6,  cap: 11, blurb: "Players with at least 2 matches this month." },
};

/** Matches a player needs in a month to share in a hit (and to count toward the "players" target). */
export const MIN_MATCHES = 2;

/** The order the app rotates through. */
export const ROTATION: TargetKind[] = ["matches", "pairings", "players", "oneEighties"];

/** "2026-11" for a date, in London time. */
export function monthKey(d: Date): string {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit" }).formatToParts(d);
  return `${p.find(x => x.type === "year")!.value}-${p.find(x => x.type === "month")!.value}`;
}

export function shiftMonth(key: string, by: number): string {
  const [y, m] = key.split("-").map(Number);
  const t = y * 12 + (m - 1) + by;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

/** Target for one kind from the previous months' values (most recent first). Months with no data are skipped. */
export function targetFor(kind: TargetKind, previous: number[]): number {
  const { floor, cap } = KIND_INFO[kind];
  const recent = previous.slice(0, 2).filter(v => v > 0);
  if (!recent.length) return floor;
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  return Math.min(cap, Math.max(floor, Math.ceil(avg * 1.1)));
}

/**
 * Which kind runs this month. A kind is only used when the league has actually been reaching its floor
 * lately (so a 180s target never appears in a month the league isn't throwing 180s on the scorer).
 * Falls back to matches.
 */
export function pickKind(key: string, history: MonthStats[]): TargetKind {
  const [y, m] = key.split("-").map(Number);
  const eligible = ROTATION.filter(k => k === "matches" || (history.length > 0 && Math.max(...history.slice(0, 2).map(h => h[k])) >= KIND_INFO[k].floor));
  return eligible[(y * 12 + m) % eligible.length] ?? "matches";
}

/** Unlocks for the number of League Targets a player has shared in. Never sold in the Store. */
export type LadderStep = { hits: number; cosmetic: { id: string; category: string; name: string; rarity: string; color?: string; gradient?: string; glow?: string; iconKey?: string; sortOrder: number } };
export const LADDER: LadderStep[] = [
  { hits: 1,  cosmetic: { id: "tag-lt-on-target", category: "LEADERBOARD_TAG", name: "ON TARGET", rarity: "RARE", color: "#19c3c8", sortOrder: 200 } },
  { hits: 3,  cosmetic: { id: "banner-lt-target-board", category: "BANNER", name: "Target Board", rarity: "EPIC",
      gradient: "repeating-radial-gradient(circle at 85% 50%,rgba(25,195,200,0.30) 0 14px,rgba(13,31,69,0.92) 14px 30px)", glow: "#19c3c8", sortOrder: 200 } },
  { hits: 6,  cosmetic: { id: "frame-lt-bullseye", category: "FRAME", name: "Bullseye", rarity: "EPIC", color: "#ff3b3b", glow: "#19c3c8", sortOrder: 200 } },
  { hits: 9,  cosmetic: { id: "room-lt-shop-floor", category: "CLUBHOUSE_ROOM", name: "The Shop Floor", rarity: "LEGENDARY", iconKey: "shopfloor", sortOrder: 200 } },
  { hits: 12, cosmetic: { id: "name-lt-year-on-target", category: "NAME_STYLE", name: "Year on Target", rarity: "LEGENDARY",
      gradient: "linear-gradient(90deg,#19c3c8,#fff7d6,#ff3b3b,#fff7d6,#19c3c8)", glow: "#19c3c8", sortOrder: 200 } },
];

export const LADDER_EARNED_BY: Record<string, string> = Object.fromEntries(
  LADDER.map(s => [s.cosmetic.id, `Help hit ${s.hits === 1 ? "a League Target" : `${s.hits} League Targets`}`]));

/** Ladder unlocks due at a given hit count. */
export function unlocksFor(hits: number): LadderStep[] { return LADDER.filter(s => s.hits <= hits); }

/** Next ladder step after a hit count, or null at the top. */
export function nextStep(hits: number): LadderStep | null { return LADDER.find(s => s.hits > hits) ?? null; }

/** Unordered key for a pair of players. */
export const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
