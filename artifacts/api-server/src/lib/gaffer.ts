/**
 * The Gaffer: each month the league votes in a captain, who picks one challenge from a fixed menu and
 * how hard to make it. The app tracks everything from data it already records. Pure helpers (tested);
 * the DB side is in gaffer-db.ts.
 *
 * Sized for a small workplace league (about 20-30 matches a month, about 12 players, played on breaks):
 * every difficulty is worked out from the league's own last 2 months and held between a floor and a cap.
 */

export type ChallengeKey = "meet" | "oneEighties" | "gotm" | "revenge" | "finishing" | "drill";

export type ChallengeDef = { key: ChallengeKey; label: string; unit: string; floor: number; cap: number; blurb: string; contributes: string };

export const CHALLENGES: Record<ChallengeKey, ChallengeDef> = {
  meet:        { key: "meet", label: "Meet the League", unit: "players", floor: 3, cap: 11,
                 blurb: "Players who face at least 3 different opponents this month.", contributes: "Face 3 different opponents" },
  oneEighties: { key: "oneEighties", label: "180 Hunt", unit: "180s", floor: 2, cap: 12,
                 blurb: "180s thrown in league matches on the scorer.", contributes: "Throw a 180" },
  gotm:        { key: "gotm", label: "Game of the Month", unit: "matches", floor: 4, cap: 15,
                 blurb: "League matches played in the Gaffer's chosen game.", contributes: "Play a match in the chosen game" },
  revenge:     { key: "revenge", label: "Revenge Month", unit: "revenge wins", floor: 2, cap: 10,
                 blurb: "Singles wins over the player who beat you the last time you met.", contributes: "Win a rematch" },
  finishing:   { key: "finishing", label: "Finishing School", unit: "% checkout", floor: 20, cap: 45,
                 blurb: "The league's checkout % on the scorer this month (needs at least 20 attempts).", contributes: "Hit the checkout % yourself (5+ attempts)" },
  drill:       { key: "drill", label: "Drill Squad", unit: "drill days", floor: 8, cap: 60,
                 blurb: "Daily drills completed across the league (one per player per day).", contributes: "Do a daily drill" },
};

export const CHALLENGE_ORDER: ChallengeKey[] = ["meet", "oneEighties", "gotm", "revenge", "finishing", "drill"];

/** The challenge used when the Gaffer doesn't pick in time (or there's no Gaffer). */
export const DEFAULT_CHALLENGE: ChallengeKey = "meet";

export const LEVELS = [
  { level: 1, name: "Steady" },
  { level: 2, name: "Push" },
  { level: 3, name: "All in" },
] as const;

/** The three difficulty options for a challenge, from the previous 2 months' values (most recent first). */
export function levelTargets(key: ChallengeKey, previous: number[]): [number, number, number] {
  const { floor, cap } = CHALLENGES[key];
  const recent = previous.slice(0, 2).filter(v => v > 0);
  const avg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : floor;
  const clamp = (v: number) => Math.min(cap, Math.max(floor, Math.ceil(v)));
  const a = clamp(avg);
  const b = Math.min(cap, Math.max(a + 1, clamp(avg * 1.15)));
  const c = Math.min(cap, Math.max(b + 1, clamp(avg * 1.3)));
  return [a, b, c];
}

/** Match needed in a month to stand for Gaffer. */
export const CANDIDATE_MIN_MATCHES = 3;
/** Days at the end of the month the vote is open. */
export const VOTE_DAYS = 5;
/** Days at the start of the month the Gaffer has to pick. */
export const PICK_DAYS = 2;

/**
 * Who becomes Gaffer: most votes for an eligible candidate; ties go to whoever played more matches,
 * then the lower player id (stable). No valid votes: the eligible player with the most matches.
 */
export function electGaffer(
  candidates: { id: number; matches: number }[],
  votes: { voter: number; candidate: number }[],
): { id: number; by: "vote" | "most_matches" } | null {
  if (!candidates.length) return null;
  const ok = new Map(candidates.map(c => [c.id, c.matches]));
  const tally = new Map<number, number>();
  for (const v of votes) if (ok.has(v.candidate) && v.voter !== v.candidate) tally.set(v.candidate, (tally.get(v.candidate) ?? 0) + 1);
  const order = (a: { id: number; matches: number }, b: { id: number; matches: number }) => b.matches - a.matches || a.id - b.id;
  if (tally.size) {
    const best = Math.max(...tally.values());
    const top = candidates.filter(c => tally.get(c.id) === best).sort(order);
    return { id: top[0].id, by: "vote" };
  }
  return { id: [...candidates].sort(order)[0].id, by: "most_matches" };
}

/** Unlocks for Gaffers whose challenge was hit, and for the squad who contributed. Never sold in the Store. */
export type LadderStep = { hits: number; cosmetic: { id: string; category: string; name: string; rarity: string; color?: string; gradient?: string; glow?: string; iconKey?: string; sortOrder: number } };

export const GAFFER_LADDER: LadderStep[] = [
  { hits: 1, cosmetic: { id: "tag-gf-the-gaffer", category: "LEADERBOARD_TAG", name: "THE GAFFER", rarity: "EPIC", color: "#ffd24a", sortOrder: 210 } },
  { hits: 2, cosmetic: { id: "banner-gf-touchline", category: "BANNER", name: "Touchline", rarity: "EPIC",
      gradient: "linear-gradient(115deg,rgba(255,210,74,0.28) 0%,rgba(8,40,22,0.95) 40%,rgba(8,40,22,0.95) 60%,rgba(255,255,255,0.12) 61%,rgba(8,40,22,0.95) 62%)", glow: "#ffd24a", sortOrder: 210 } },
  { hits: 3, cosmetic: { id: "room-gf-gaffers-office", category: "CLUBHOUSE_ROOM", name: "The Gaffer's Office", rarity: "LEGENDARY", iconKey: "gaffer", sortOrder: 210 } },
  { hits: 5, cosmetic: { id: "name-gf-manager-of-the-year", category: "NAME_STYLE", name: "Manager of the Year", rarity: "LEGENDARY",
      gradient: "linear-gradient(90deg,#b8892f,#ffd24a,#fff7d6,#ffd24a,#b8892f)", glow: "#ffd24a", sortOrder: 210 } },
];

export const SQUAD_LADDER: LadderStep[] = [
  { hits: 1, cosmetic: { id: "tag-gf-squad", category: "LEADERBOARD_TAG", name: "SQUAD", rarity: "RARE", color: "#22c55e", sortOrder: 211 } },
  { hits: 3, cosmetic: { id: "frame-gf-dressing-room", category: "FRAME", name: "Dressing Room", rarity: "EPIC", color: "#22c55e", glow: "#ffd24a", sortOrder: 211 } },
  { hits: 6, cosmetic: { id: "banner-gf-first-team", category: "BANNER", name: "First Team", rarity: "LEGENDARY",
      gradient: "repeating-linear-gradient(90deg,rgba(34,197,94,0.22) 0 26px,rgba(8,40,22,0.95) 26px 52px)", glow: "#22c55e", sortOrder: 211 } },
];

export const GAFFER_EARNED_BY: Record<string, string> = Object.fromEntries([
  ...GAFFER_LADDER.map(s => [s.cosmetic.id, `Be the Gaffer when ${s.hits === 1 ? "your challenge is hit" : `${s.hits} of your challenges are hit`}`]),
  ...SQUAD_LADDER.map(s => [s.cosmetic.id, `Help hit ${s.hits === 1 ? "a Gaffer's challenge" : `${s.hits} Gaffer challenges`}`]),
]);

export const unlocksFor = (ladder: LadderStep[], hits: number) => ladder.filter(s => s.hits <= hits);
export const nextStep = (ladder: LadderStep[], hits: number) => ladder.find(s => s.hits > hits) ?? null;

/**
 * Revenge wins in a month: a singles win over the opponent who won your previous meeting.
 * `history` is every singles result in time order (including before the month); `from` marks the month start.
 */
export function revengeWins(history: { winner: number; loser: number; at: Date }[], from: Date, to: Date): Map<number, number> {
  const last = new Map<string, number>(); // pair -> who won the previous meeting
  const out = new Map<number, number>();
  for (const m of history) {
    const pair = m.winner < m.loser ? `${m.winner}-${m.loser}` : `${m.loser}-${m.winner}`;
    if (m.at >= from && m.at < to && last.get(pair) === m.loser) out.set(m.winner, (out.get(m.winner) ?? 0) + 1);
    last.set(pair, m.winner);
  }
  return out;
}

/** Normalise a stored game type ("Cricket", "cricket") for Game of the Month. */
export const gameKey = (g: string | null | undefined) => (g ?? "").trim().toLowerCase();
