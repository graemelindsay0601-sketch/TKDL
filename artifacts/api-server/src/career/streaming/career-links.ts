import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";
import { tierFor, type TierKey } from "./model.ts";

/**
 * Where DartCast meets your darts career (audience, fans and money only; never your darts):
 * - Darts sponsors notice a big channel: a creator premium on the signing bonus of darts-career sponsor offers.
 * - Your DartCast crowd turns up at your walk-ons in real tournaments, chanting your name.
 * - Pros you've played come on your podcast (their names bring listeners and fans for your darts career).
 */
export const CREATOR_SPONSOR_PREMIUM: Partial<Record<TierKey, number>> = { PARTNER: 0.05, STAR: 0.1, ICON: 0.15, LEGEND: 0.2 };

let channelsSeen = false;
/** The channel's handle, followers and tier, or null with no channel (or no streaming tables). */
export async function channelReach(tx: CareerExecutor, saveId: string) {
  if (!channelsSeen) channelsSeen = (await tx.execute(sql`SELECT to_regclass('career_stream_channels') IS NOT NULL AS ok`)).rows[0]?.ok === true;
  if (!channelsSeen) return null;
  const row = (await tx.execute(sql`SELECT handle, followers, emotes FROM career_stream_channels WHERE career_save_id=${saveId}`)).rows[0];
  if (!row) return null;
  const followers = Number(row.followers);
  return { handle: String(row.handle), followers, tier: tierFor(followers).key, emotes: ((row.emotes as (string | null)[] | null) ?? []).filter((e): e is string => !!e) };
}

/** The creator premium darts sponsors add to a signing bonus, from Partner up. */
export async function creatorSponsorPremium(tx: CareerExecutor, saveId: string) {
  const c = await channelReach(tx, saveId);
  const premium = c ? CREATOR_SPONSOR_PREMIUM[c.tier] ?? 0 : 0;
  return c && premium > 0 ? { handle: c.handle, followers: c.followers, tier: c.tier, premium } : null;
}

/** Your DartCast crowd at a real walk-on: from Partner up, a chant and a share of your audience in the hall. */
export function walkOnCrowd(c: { handle: string; followers: number; tier: TierKey; emotes: string[] } | null, playerName: string) {
  if (!c || !CREATOR_SPONSOR_PREMIUM[c.tier]) return null;
  const surname = playerName.trim().split(/\s+/).at(-1) ?? playerName;
  const chants = [`There's only one ${surname}!`, `${c.handle}! ${c.handle}!`, `Stand up for the DartCast!`, `Oh ${surname}, ${surname}!`];
  const chant = chants[(c.followers + surname.length) % chants.length];
  return { handle: c.handle, followers: c.followers, chant, inHall: Math.max(20, Math.min(3000, Math.round(c.followers * 0.01))), emote: c.emotes[0] ?? null };
}

/** Pro guests on the podcast: pros you've played (from Partner), and the world's top 16 once you're a Star. */
export const PRO_GUEST = Object.freeze({ minTier: "PARTNER" as TierKey, topTier: "STAR" as TierKey, topRank: 16, fansPerListener: 0.1, list: 10 });
/** How big a pro's name is, as podcast pull (a follower-equivalent): the world number one is worth a lot more than #64. */
export const proPull = (rank: number | null) => rank ? Math.round(300_000 / Math.pow(rank, 0.8)) : 3_000;

export async function proGuests(tx: CareerExecutor, saveId: string, tier: TierKey, atLeast: (t: TierKey, m: TierKey) => boolean) {
  const rows = (await tx.execute(sql`WITH snap AS (SELECT id FROM career_ranking_snapshots WHERE career_save_id=${saveId} AND list_key='pro-world' ORDER BY sequence DESC LIMIT 1),
      met AS (SELECT CASE WHEN a_key='HUMAN' THEN b_npc_id ELSE a_npc_id END AS npc, COUNT(*)::int AS n,
        SUM(CASE WHEN winner_key='HUMAN' THEN 1 ELSE 0 END)::int AS won
        FROM career_tournament_matches WHERE career_save_id=${saveId} AND status='COMPLETED' AND (a_key='HUMAN' OR b_key='HUMAN')
          AND COALESCE(result_source,'') NOT IN ('BYE','WALKOVER') GROUP BY 1),
      ranked AS (SELECT r.npc_id, r.position FROM career_ranking_snapshot_rows r WHERE r.career_save_id=${saveId} AND r.snapshot_id=(SELECT id FROM snap))
    SELECT p.id, p.first_name, p.surname, ranked.position, COALESCE(met.n,0) AS n, COALESCE(met.won,0) AS won
    FROM career_world_players p LEFT JOIN met ON met.npc=p.id LEFT JOIN ranked ON ranked.npc_id=p.id
    WHERE p.career_save_id=${saveId} AND p.status='ACTIVE' AND (met.n IS NOT NULL OR ranked.position <= ${PRO_GUEST.topRank})
    ORDER BY (met.n IS NOT NULL) DESC, ranked.position NULLS LAST, met.n DESC LIMIT 40`)).rows;
  return proGuestList(rows.map(r => ({ id: String(r.id), name: `${r.first_name} ${r.surname}`, meetings: Number(r.n), won: Number(r.won),
    rank: r.position === null || r.position === undefined ? null : Number(r.position) })), tier, atLeast);
}

/** Who'll come on (pure): pros you've met from Partner; the top 16 you haven't, from Star. */
export function proGuestList(rows: { id: string; name: string; meetings: number; won: number; rank: number | null }[], tier: TierKey, atLeast: (t: TierKey, m: TierKey) => boolean) {
  return rows.map(r => {
    const { meetings, won, rank } = r;
    const ok = meetings > 0 ? atLeast(tier, PRO_GUEST.minTier) : atLeast(tier, PRO_GUEST.topTier);
    return { key: `pro:${r.id}`, handle: r.name, rank, meetings, record: `${won}-${meetings - won}`,
      rival: meetings >= 2 && meetings - won > won, followers: proPull(rank), ok,
      why: ok ? null : meetings > 0 ? "Pros come on from Partner" : "The top 16 come on once you're a Star" };
  }).sort((a, b) => Number(b.ok) - Number(a.ok) || (a.rank ?? 999) - (b.rank ?? 999)).slice(0, PRO_GUEST.list);
}
