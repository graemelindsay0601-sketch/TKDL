import { CareerError } from "../service.ts";
import type { MatchRow } from "./engine.ts";

/** Positions are sporting draw seats, not an ordering by participant identity. */
export const GROUP_SCHEDULE = [[[0, 3], [1, 2]], [[0, 2], [3, 1]], [[0, 1], [2, 3]]] as const;
export const GROUP_KEYS = ["A", "B", "C", "D"] as const;

/** Circle-method round robin for any field size; `double` repeats it with sides swapped. */
export function roundRobin(n: number, double = false): [number, number][][] {
  const field: (number | null)[] = Array.from({ length: n }, (_, i) => i);
  if (field.length % 2) field.push(null);
  const rounds: [number, number][][] = [];
  for (let r = 0; r < field.length - 1; r++) {
    const rotated = [field[0], ...field.slice(1).map((_, i) => field[1 + ((i + r) % (field.length - 1))])];
    const fixtures: [number, number][] = [];
    for (let i = 0; i < field.length / 2; i++) {
      const a = rotated[i], b = rotated[field.length - 1 - i];
      if (a === null || b === null) continue;
      fixtures.push((r % 2 === 0 ? [a, b] : [b, a]) as [number, number]);
    }
    rounds.push(fixtures);
  }
  return double ? [...rounds, ...rounds.map(pairs => pairs.map(([a, b]) => [b, a] as [number, number]))] : rounds;
}
/**
 * Grouped formats. VAULT (A8.2): four groups of four, top two to cross-group quarter-finals.
 * LEAGUE (event database v11): one table of eight, double round robin on weekly nights, top four to
 * semi-finals (1st v 4th, 2nd v 3rd) and a final on play-off night — the Premier League shape.
 * WORLD_CUP: twelve groups of three, one qualifier each, then a 16-team seeded knockout.
 */
export type GroupLayout = { kind: "VAULT" | "LEAGUE" | "WORLD_CUP"; keys: readonly string[]; size: number; schedule: readonly (readonly (readonly [number, number])[])[];
  qualifiers: number; knockoutRounds: number; fixtures: number };
export const VAULT_LAYOUT: GroupLayout = { kind: "VAULT", keys: GROUP_KEYS, size: 4, schedule: GROUP_SCHEDULE, qualifiers: 2, knockoutRounds: 3, fixtures: 31 };
const LEAGUE_SCHEDULE = roundRobin(8, true);
export const LEAGUE_LAYOUT: GroupLayout = { kind: "LEAGUE", keys: ["L"], size: 8, schedule: LEAGUE_SCHEDULE, qualifiers: 4, knockoutRounds: 2,
  fixtures: LEAGUE_SCHEDULE.flat().length + 3 };
export const WORLD_CUP_LAYOUT: GroupLayout = { kind: "WORLD_CUP", keys: "ABCDEFGHIJKL".split(""), size: 3,
  schedule: roundRobin(3), qualifiers: 1, knockoutRounds: 4, fixtures: 12 * roundRobin(3).flat().length + 15 };
export const isGroupedStructure = (structure: string) => ["GROUP_KNOCKOUT", "WORLD_CUP", "LEAGUE"].includes(structure);
export const layoutFor = (structure: string): GroupLayout => structure === "LEAGUE" ? LEAGUE_LAYOUT
  : structure === "WORLD_CUP" ? WORLD_CUP_LAYOUT : VAULT_LAYOUT;
export const groupStage = (key: string) => `groups:${key}`;
export const isGroupMatch = (m: Pick<MatchRow, "stage_key">) => m.stage_key.startsWith("groups:");
export type GroupStanding = {
  key: string; played: number; wins: number; losses: number; legsFor: number; legsAgainst: number;
  legDifference: number; walkoverWins: number; withdrawn: boolean;
};
export type GroupTable = { key: string; finished: boolean; buckets: GroupStanding[][]; pendingTie: string[] | null };

export function groupSeats(matches: MatchRow[], group: string, layout: GroupLayout = VAULT_LAYOUT): string[] {
  const fixtures = matches.filter(m => m.stage_key === groupStage(group)).sort((a, b) => a.round - b.round || a.slot - b.slot);
  if (fixtures.length !== layout.schedule.flat().length || fixtures.some(m => !m.a_key || !m.b_key))
    throw new CareerError(409, "Group draw is incomplete; no replacement draw has been generated");
  const seats: string[] = Array(layout.size);
  const seatRounds = layout.kind === "LEAGUE" ? layout.schedule.slice(0, layout.size - 1) : layout.schedule;
  seatRounds.forEach((round, r) => round.forEach((pair, s) => {
    const m = fixtures.find(x => x.round === r + 1 && x.slot === s + 1)!;
    seats[pair[0]] = m.a_key!; seats[pair[1]] = m.b_key!;
  }));
  if (new Set(seats).size !== layout.size) throw new CareerError(409, "Group draw has duplicate participants");
  return seats;
}

/** P/W/L/legs count played darts only; W/O wins separately count toward sporting wins. */
export function groupTable(matches: MatchRow[], group: string, withdrawn = new Set<string>(), layout: GroupLayout = VAULT_LAYOUT): GroupTable {
  const fixtures = matches.filter(m => m.stage_key === groupStage(group));
  const seats = groupSeats(matches, group, layout);
  if (fixtures.length !== layout.schedule.flat().length || layout.schedule.some((pairs, r) => pairs.some(([a, b], s) =>
    !fixtures.some(m => m.round === r + 1 && m.slot === s + 1 && m.a_key === seats[a] && m.b_key === seats[b]))))
    throw new CareerError(409, "Group fixtures differ from the official draw");
  const rows = seats.map(key => {
    const played = fixtures.filter(m => m.status === "COMPLETED" && (m.a_key === key || m.b_key === key));
    if (played.some(m => m.legs_a === null || m.legs_b === null || ![m.a_key, m.b_key].includes(m.winner_key)))
      throw new CareerError(409, "Group result is corrupt");
    const legsFor = played.reduce((n, m) => n + (m.a_key === key ? m.legs_a! : m.legs_b!), 0);
    const legsAgainst = played.reduce((n, m) => n + (m.a_key === key ? m.legs_b! : m.legs_a!), 0);
    return { key, played: played.length, wins: played.filter(m => m.winner_key === key).length,
      losses: played.filter(m => m.winner_key !== key).length, legsFor, legsAgainst, legDifference: legsFor - legsAgainst,
      walkoverWins: fixtures.filter(m => m.status === "WALKOVER" && m.winner_key === key).length, withdrawn: withdrawn.has(key) };
  });
  const compare = (a: GroupStanding, b: GroupStanding) => Number(a.withdrawn) - Number(b.withdrawn)
    || (b.wins + b.walkoverWins) - (a.wins + a.walkoverWins) || b.legDifference - a.legDifference || b.legsFor - a.legsFor;
  rows.sort(compare); // stable seat order is display order ONLY; equal rows remain one tied bucket.
  const buckets: GroupStanding[][] = [];
  for (const row of rows) {
    const last = buckets.at(-1);
    if (last && compare(last[0], row) === 0) last.push(row); else buckets.push([row]);
  }
  // Only a clean two-way head-to-head resolves equal aggregate criteria. Circular ties remain tied.
  for (let i = 0; i < buckets.length; i++) {
    const bucket = buckets[i];
    if (bucket.length !== 2) continue;
    const meeting = fixtures.find(m => ["COMPLETED", "WALKOVER"].includes(m.status)
      && bucket.some(p => p.key === m.a_key) && bucket.some(p => p.key === m.b_key));
    if (meeting?.winner_key) {
      const winner = bucket.find(p => p.key === meeting.winner_key)!;
      buckets.splice(i, 1, [winner], [bucket.find(p => p !== winner)!]); i++;
    }
  }
  const finished = fixtures.every(m => ["COMPLETED", "WALKOVER", "VOID"].includes(m.status));
  let rank = 0, pendingTie: string[] | null = null;
  if (finished) for (const bucket of buckets) {
    if (rank < layout.qualifiers && bucket.length > 1 && !bucket[0].withdrawn) { pendingTie = bucket.map(p => p.key); break; }
    rank += bucket.length;
  }
  return { key: group, finished, buckets, pendingTie };
}

/** Sporting bull knockout selects a tied rank, then repeats for the remaining rank.
 * Pair scheduling follows the original draw seats. Every rank requires actual bull wins. */
export function bullRanking(keys: string[], results: { a_key: string; b_key: string; winner_key: string | null }[], needed: number) {
  const remaining = [...keys], ranked: string[] = [];
  let ordinal = 0;
  while (ranked.length < needed && remaining.length) {
    let winner = remaining[0];
    for (const challenger of remaining.slice(1)) {
      const r = results[ordinal++];
      if (!r?.winner_key) return { ranked, pair: [winner, challenger] as [string, string], ordinal };
      if (r.a_key !== winner || r.b_key !== challenger || ![winner, challenger].includes(r.winner_key))
        throw new CareerError(409, "Persisted bull playoff conflicts with the sporting tie");
      winner = r.winner_key;
    }
    ranked.push(winner); remaining.splice(remaining.indexOf(winner), 1);
  }
  return { ranked, pair: null, ordinal };
}
