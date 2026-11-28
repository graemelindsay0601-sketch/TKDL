// Profile 2.0: Player Card ratings for everyone in the league (rules in shared/darts-rules/player-ratings.ts).
// Worked out for all active players together so each card can say where you rank. Cached briefly.
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { playerRatings, cardBand, WINDOW, MIN_MATCHES, RATING_ORDER, type RatingMatch, type Ratings, type RatingKey } from "../shared/darts-rules/player-ratings";

type CardRow = { playerId: number; name: string; ratings: Ratings | null; played: number };
let cache: { at: number; rows: CardRow[] } | null = null;
export const clearCardCache = () => { cache = null; };

async function allCards(): Promise<CardRow[]> {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.rows;
  const players = (await db.execute(sql`SELECT id, name, elo FROM players WHERE COALESCE(is_active, true) AND status <> 'INACTIVE'`)).rows as any[];
  // Each player's most recent league matches, from their side. Doubles/Shift Wars captains count
  // (the stats on the match are the captain's), which is how the rest of the profile treats them.
  const m = (await db.execute(sql`
    SELECT p.id pid, x.* FROM players p
    CROSS JOIN LATERAL (
      SELECT (mt.winner_id = p.id) won, mt.game_type,
        CASE WHEN mt.winner_id = p.id THEN mt.winner_darts ELSE mt.loser_darts END darts,
        COALESCE(CASE WHEN mt.winner_id = p.id THEN mt.winner_100s ELSE mt.loser_100s END, 0) tons,
        COALESCE(CASE WHEN mt.winner_id = p.id THEN mt.winner_140s ELSE mt.loser_140s END, 0) t140,
        COALESCE(CASE WHEN mt.winner_id = p.id THEN mt.winner_180s ELSE mt.loser_180s END, 0) t180,
        CASE WHEN mt.winner_id = p.id THEN mt.winner_checkout_attempts ELSE mt.loser_checkout_attempts END co_att,
        CASE WHEN mt.winner_id = p.id THEN mt.winner_checkout_hits ELSE mt.loser_checkout_hits END co_hit,
        (mt.winner_id = p.id AND mt.was_upset_win) upset
      FROM matches mt WHERE mt.winner_id = p.id OR mt.loser_id = p.id
      ORDER BY mt.played_at DESC LIMIT ${WINDOW * 3}
    ) x
    WHERE COALESCE(p.is_active, true) AND p.status <> 'INACTIVE'`)).rows as any[];
  const byPlayer = new Map<number, RatingMatch[]>();
  for (const r of m) {
    const list = byPlayer.get(Number(r.pid)) ?? [];
    list.push({ won: !!r.won, gameType: String(r.game_type), darts: r.darts == null ? null : Number(r.darts), tons: Number(r.tons), t140: Number(r.t140),
      t180: Number(r.t180), coAttempts: r.co_att == null ? null : Number(r.co_att), coHits: r.co_hit == null ? null : Number(r.co_hit), upset: !!r.upset });
    byPlayer.set(Number(r.pid), list);
  }
  const rows = players.map(p => {
    const list = byPlayer.get(Number(p.id)) ?? [];
    return { playerId: Number(p.id), name: String(p.name), ratings: playerRatings({ matches: list, elo: Number(p.elo) }), played: list.length };
  });
  cache = { at: Date.now(), rows };
  return rows;
}

/** One player's card, with their league rank for each rating (1 = best among players with a card). */
export async function playerCard(id: number) {
  const rows = await allCards();
  const me = rows.find(r => r.playerId === id);
  if (!me) return null;
  const rated = rows.filter(r => r.ratings);
  const rankOf = (k: RatingKey | "overall") => {
    const v = (r: CardRow) => k === "overall" ? r.ratings!.overall : r.ratings!.ratings[k];
    const mine = me.ratings ? v(me) : null;
    if (mine == null) return null;
    return 1 + rated.filter(r => (v(r) ?? -1) > mine).length;
  };
  return {
    playerId: me.playerId, name: me.name, minMatches: MIN_MATCHES,
    card: me.ratings ? { ...me.ratings, band: cardBand(me.ratings.overall), of: rated.length,
      ranks: { overall: rankOf("overall"), ...Object.fromEntries(RATING_ORDER.map(k => [k, rankOf(k)])) } } : null,
  };
}

/** Every rated card, for Compare. */
export async function allPlayerCards() {
  return (await allCards()).filter(r => r.ratings).map(r => ({ playerId: r.playerId, name: r.name, overall: r.ratings!.overall, ratings: r.ratings!.ratings, band: cardBand(r.ratings!.overall) }));
}
