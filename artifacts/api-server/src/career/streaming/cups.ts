import { scopedRandom } from "../world/random.ts";
import { STREAM, activeStreamers, streamerFollowers, type TierKey } from "./model.ts";

/**
 * Creator Cups: four one-night knockout tournaments a season, streamed live on DartCast and extra to your stream nights.
 * The bracket grows with your channel (8 creators, 16 from Partner) and is drawn from creators around your size, so a
 * small channel meets pub streamers and a Star meets the giants. Early rounds are best of 5 legs, the final best of 7.
 * Prize money by round reached; the winner lifts a trophy and wins fans for their darts career too.
 * Matches you're not in are settled by the field's averages (deterministic per save), so the bracket is real.
 */
export const CUPS = Object.freeze({
  /** Opening week of each cup; each stays open for `window` weeks. */
  weeks: [10, 23, 36, 49] as readonly number[], window: 2,
  names: ["Spring Cup", "Summer Cup", "Autumn Cup", "Winter Cup"] as readonly string[],
  legsToWin: 3, finalLegsToWin: 4,
  /** Prize pool by tier (pence): what the winner takes; earlier exits take a share. */
  winnerPrize: { NEWCOMER: 5_000, AFFILIATE: 15_000, PARTNER: 60_000, STAR: 200_000 } as Record<TierKey, number>,
  /** Share of the winner's prize by round reached (out in round 1, round 2, ...). */
  share8: [0.05, 0.15, 0.4, 1] as readonly number[], share16: [0.03, 0.08, 0.18, 0.4, 1] as readonly number[],
  winnerFans: { 8: 120, 16: 350 } as Record<number, number>, finalistFans: { 8: 40, 16: 110 } as Record<number, number>,
  winnerFollowers: 0.05, crowd: 1.6,
});

export type CupEntrant = { key: string; handle: string; avg: number; followers: number; you?: boolean; catchphrase?: string };
export type CupDef = { n: number; name: string; opens: number; closes: number };
export type CupState = { n: number; name: string; season: number; size: number; field: CupEntrant[] };

/** The cup open this week, if any. */
export function cupThisWeek(week: number): CupDef | null {
  const i = CUPS.weeks.findIndex(w => week >= w && week < w + CUPS.window);
  return i < 0 ? null : { n: i + 1, name: CUPS.names[i], opens: CUPS.weeks[i], closes: CUPS.weeks[i] + CUPS.window - 1 };
}
/** The next cup to come this season (null after the last). */
export function nextCup(week: number): CupDef | null {
  const i = CUPS.weeks.findIndex(w => w + CUPS.window - 1 >= week);
  return i < 0 ? null : { n: i + 1, name: CUPS.names[i], opens: CUPS.weeks[i], closes: CUPS.weeks[i] + CUPS.window - 1 };
}
export const cupSize = (tier: TierKey) => tier === "PARTNER" || tier === "STAR" ? 16 : 8;
export const roundsFor = (size: number) => Math.round(Math.log2(size));
export function roundName(size: number, round: number) {
  const left = roundsFor(size) - round;
  return left === 1 ? "Final" : left === 2 ? "Semi-final" : left === 3 ? "Quarter-final" : "Round of 16";
}
export const legsToWinIn = (size: number, round: number) => round === roundsFor(size) - 1 ? CUPS.finalLegsToWin : CUPS.legsToWin;

/** The field: creators around your size (a little randomness so it changes cup to cup), you included, best-known first. */
export function cupField(seed: string, season: number, n: number, week: number, you: CupEntrant, size: number): CupEntrant[] {
  const rng = scopedRandom(seed, STREAM.version, "creator-cup-field", season, n);
  const me = Math.max(1, you.followers);
  const pool = activeStreamers(season).map(s => ({ key: s.key, handle: s.handle, avg: s.avg, catchphrase: s.catchphrase, followers: streamerFollowers(s.followers, season, week),
    fit: Math.abs(Math.log(Math.max(1, streamerFollowers(s.followers, season, week)) / me)) + rng() * 0.8 }));
  const field = pool.sort((a, b) => a.fit - b.fit).slice(0, size - 1).map(({ fit: _fit, ...e }) => e);
  return [...field, { ...you, you: true }].sort((a, b) => b.followers - a.followers || a.handle.localeCompare(b.handle));
}

/** Standard seeding order for a bracket of `size` (1 v size, and so on, halves kept apart). */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) { const m = order.length * 2 + 1; order = order.flatMap(s => [s, m - s]); }
  return order;
}
/** Chance the first player beats the second over a short match, from their averages. */
export const beats = (a: number, b: number) => 1 / (1 + Math.exp(-(a - b) / 5));

/**
 * The whole bracket, round by round. Matches without you are settled by the averages; yours by what you actually do
 * (`yourResults[r]` true for a win). Where you haven't played yet, the bracket stops at your match.
 */
export function bracket(seed: string, cup: CupState, yourResults: readonly boolean[]) {
  const rng = scopedRandom(seed, STREAM.version, "creator-cup-bracket", cup.season, cup.n);
  let alive: (CupEntrant | null)[] = seedOrder(cup.size).map(s => cup.field[s - 1]);
  const rounds: { name: string; matches: { a: CupEntrant | null; b: CupEntrant | null; winner: CupEntrant | null; you: boolean }[] }[] = [];
  for (let r = 0; r < roundsFor(cup.size); r++) {
    const matches: (typeof rounds)[number]["matches"] = [], next: (CupEntrant | null)[] = [];
    for (let i = 0; i < alive.length; i += 2) {
      const a = alive[i], b = alive[i + 1];
      const roll = rng();
      let winner: CupEntrant | null = null;
      const you = !!(a?.you || b?.you);
      if (a && b) {
        if (you) { const res = yourResults[r]; winner = res === undefined ? null : (res ? (a.you ? a : b) : (a.you ? b : a)); }
        else winner = roll < beats(a.avg, b.avg) ? a : b;
      }
      matches.push({ a, b, winner, you }); next.push(winner);
    }
    rounds.push({ name: roundName(cup.size, r), matches });
    alive = next;
  }
  const champion = alive[0] ?? null;
  return { rounds, champion };
}

/** Your opponent in round `round` (they must have come through their side of the draw). */
export function cupOpponent(seed: string, cup: CupState, round: number, yourResults: readonly boolean[]): CupEntrant | null {
  const assumeWins = [...yourResults.slice(0, round), ...Array(Math.max(0, roundsFor(cup.size) - round)).fill(true)];
  const b = bracket(seed, cup, assumeWins);
  const m = b.rounds[round]?.matches.find(x => x.you);
  return m ? (m.a?.you ? m.b : m.a) : null;
}

/** Prize for reaching a round (wins = matches won; all of them = the cup). */
export function cupPrize(tier: TierKey, size: number, wins: number) {
  const shares = size === 16 ? CUPS.share16 : CUPS.share8;
  return Math.round(CUPS.winnerPrize[tier] * shares[Math.min(shares.length - 1, wins)] / 100) * 100;
}
