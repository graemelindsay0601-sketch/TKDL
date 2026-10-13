import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";
import type { Npc } from "../world/types.ts";
import { npcFacts } from "./providers.ts";

/**
 * Event database v13 pairs. Teams form when the field locks and never change. The bracket, matches and
 * results hold the captain; the partner is entered and booked like any player and is named in
 * career_event_pairs. The human always captains their own pair.
 */
/** Darts nations: the United Kingdom competes as England, Scotland, Wales and Northern Ireland, as in the real World Cup. */
const SCOTLAND = new Set(["ayrshire", "highlands", "glasgow-clyde", "central-scotland", "edinburgh-lothians", "borders", "north-east-scotland", "tayside"]);
export function dartsNation(country: string, locality: string | null): string {
  if (country !== "GBR") return country;
  return locality && SCOTLAND.has(locality) ? "SCO" : locality === "south-wales" ? "WAL" : locality === "northern-ireland" ? "NIR" : "ENG";
}
/**
 * World Cup selection order inside a nation: the published World Ranking first, then players outside it by
 * the Open World Ranking, then by the Amateur Circuit Ranking (the affiliate-qualifier route smaller darting
 * nations use). Players on none of them are not selectable — no hidden ratings.
 */
export function selectionRank(rankings: Record<string, number>): number | undefined {
  if (rankings["pro-world"] !== undefined) return rankings["pro-world"];
  if (rankings["open-world"] !== undefined) return 1000 + rankings["open-world"];
  if (rankings.amateur !== undefined) return 2000 + rankings.amateur;
  return undefined;
}

export type PairRow = { captain_key: string; captain_npc_id: string | null; partner_key: string; partner_npc_id: string; nation: string | null };
export type PairCandidate = { key: string; npcId: string | null; country: string; rank: number };

/**
 * World Cup selection: each darts nation's two best players by selectionRank (unavailable players are skipped
 * and the next best is picked), nations ordered by their pair's combined ranking; the human
 * captains their nation's pair when selected, otherwise the higher-ranked player does.
 */
export function nationTeams(candidates: readonly PairCandidate[], maxTeams: number): { teams: PairRow[]; players: PairCandidate[] } {
  const byNation = new Map<string, PairCandidate[]>();
  for (const c of candidates) byNation.set(c.country, [...(byNation.get(c.country) ?? []), c]);
  const nations = [...byNation.entries()].map(([nation, list]) => [nation, [...list].sort((a, b) => a.rank - b.rank || (a.key < b.key ? -1 : 1)).slice(0, 2)] as const)
    .filter(([, pair]) => pair.length === 2)
    .sort((a, b) => (a[1][0].rank + a[1][1].rank) - (b[1][0].rank + b[1][1].rank) || a[1][0].rank - b[1][0].rank || (a[0] < b[0] ? -1 : 1))
    .slice(0, Math.max(0, maxTeams));
  const teams = nations.map(([nation, pair]) => {
    const [captain, partner] = pair[1].key === "HUMAN" ? [pair[1], pair[0]] : pair;
    return { captain_key: captain.key, captain_npc_id: captain.npcId, partner_key: partner.key, partner_npc_id: partner.npcId!, nation };
  });
  return { teams, players: nations.flatMap(([, pair]) => pair) };
}

/**
 * Local pairs: the human (when entered) partners the first selected compatriot — same locality first,
 * then same country, then anyone; the other selected players pair up in selection order. An odd player
 * out is not entered.
 */
export function localTeams(players: readonly { key: string; npc: Npc | null }[], human: { country: string; locality: string | null } | null): { teams: PairRow[]; unpaired: string[] } {
  const pool = players.filter(p => p.npc);
  const teams: PairRow[] = [];
  if (human && players.some(p => p.key === "HUMAN") && pool.length) {
    const pick = pool.find(p => human.locality && npcFacts(p.npc!).locality === human.locality) ?? pool.find(p => p.npc!.nationality === human.country) ?? pool[0];
    pool.splice(pool.indexOf(pick), 1);
    teams.push({ captain_key: "HUMAN", captain_npc_id: null, partner_key: pick.key, partner_npc_id: pick.npc!.id, nation: null });
  }
  for (let i = 0; i + 1 < pool.length; i += 2) teams.push({ captain_key: pool[i].key, captain_npc_id: pool[i].npc!.id, partner_key: pool[i + 1].key, partner_npc_id: pool[i + 1].npc!.id, nation: null });
  const paired = new Set(teams.flatMap(t => [t.captain_key, t.partner_key]));
  return { teams, unpaired: players.map(p => p.key).filter(k => !paired.has(k)) };
}

export async function loadPairs(tx: CareerExecutor, saveId: string, eventIds: readonly string[]): Promise<Map<string, PairRow & { event_id: string }>> {
  if (!eventIds.length) return new Map();
  const rows = (await tx.execute(sql`SELECT * FROM career_event_pairs WHERE career_save_id = ${saveId}
    AND event_id IN (${sql.join(eventIds.map(id => sql`${id}::uuid`), sql`, `)})`)).rows;
  return new Map(rows.map(r => [`${r.event_id}|${r.captain_key}`, { event_id: String(r.event_id), captain_key: String(r.captain_key), captain_npc_id: r.captain_npc_id ? String(r.captain_npc_id) : null,
    partner_key: String(r.partner_key), partner_npc_id: String(r.partner_npc_id), nation: r.nation ? String(r.nation) : null }]));
}

export async function insertPairs(tx: CareerExecutor, saveId: string, eventId: string, teams: readonly PairRow[]) {
  if (!teams.length) return;
  await tx.execute(sql`INSERT INTO career_event_pairs (career_save_id, event_id, captain_key, captain_npc_id, partner_key, partner_npc_id, nation)
    SELECT ${saveId}::uuid, ${eventId}::uuid, t.captain_key, t.captain_npc_id, t.partner_key, t.partner_npc_id, t.nation
    FROM jsonb_to_recordset(${JSON.stringify(teams)}::jsonb) AS t(captain_key text, captain_npc_id uuid, partner_key text, partner_npc_id uuid, nation text)`);
}
