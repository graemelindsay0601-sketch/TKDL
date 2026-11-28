// Profile 2.0: Player Cards for everyone in the league, one per game (rules in
// shared/darts-rules/player-ratings.ts). Worked out for all active players together so each card
// can say where you rank. Cached briefly.
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { ensureMatchGameStats } from "../routes/match-game-stats";
import { CARD_GAMES, MIN_MATCHES, cardBand, cardGameOf, gameCard, type CardGame, type CardMatch, type GameCardRatings } from "../shared/darts-rules/player-ratings";

type Row = { playerId: number; name: string; cards: Record<CardGame, GameCardRatings | null>; played: Record<CardGame, number> };
let cache: { at: number; rows: Row[] } | null = null;
export const clearCardCache = () => { cache = null; };

const num = (v: unknown) => (v == null ? null : Number(v));

async function allRows(): Promise<Row[]> {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.rows;
  await ensureMatchGameStats(); // the Cricket/ATW detail table is created on first use
  const players = (await db.execute(sql`SELECT id, name FROM players WHERE COALESCE(is_active, true) AND status <> 'INACTIVE'`)).rows as any[];
  // Each player's recent league matches, from their side, with the live-scorer detail for Cricket/ATW.
  const m = (await db.execute(sql`
    SELECT p.id pid, x.* FROM players p
    CROSS JOIN LATERAL (
      SELECT (mt.winner_id = p.id) won, mt.game_type, mt.elo_change,
        CASE WHEN mt.winner_id = p.id THEN mt.winner_darts ELSE mt.loser_darts END darts,
        COALESCE(CASE WHEN mt.winner_id = p.id THEN mt.winner_100s ELSE mt.loser_100s END, 0) t100,
        COALESCE(CASE WHEN mt.winner_id = p.id THEN mt.winner_140s ELSE mt.loser_140s END, 0) t140,
        COALESCE(CASE WHEN mt.winner_id = p.id THEN mt.winner_180s ELSE mt.loser_180s END, 0) t180,
        CASE WHEN mt.winner_id = p.id THEN mt.winner_checkout_attempts ELSE mt.loser_checkout_attempts END co_att,
        CASE WHEN mt.winner_id = p.id THEN mt.winner_checkout_hits ELSE mt.loser_checkout_hits END co_hit,
        g.game detail_game, CASE WHEN mt.winner_id = p.id THEN g.winner ELSE g.loser END detail
      FROM matches mt LEFT JOIN match_game_stats g ON g.match_id = mt.id
      WHERE mt.winner_id = p.id OR mt.loser_id = p.id
      ORDER BY mt.played_at DESC LIMIT 240
    ) x
    WHERE COALESCE(p.is_active, true) AND p.status <> 'INACTIVE'`)).rows as any[];
  const byPlayer = new Map<number, CardMatch[]>();
  for (const r of m) {
    const game = cardGameOf(String(r.game_type));
    if (!game) continue;
    const d = r.detail as any;
    const list = byPlayer.get(Number(r.pid)) ?? [];
    list.push({
      game, won: !!r.won, eloChange: Number(r.elo_change ?? 16),
      darts: num(r.darts), t100: Number(r.t100), t140: Number(r.t140), t180: Number(r.t180), coAttempts: num(r.co_att), coHits: num(r.co_hit),
      cricket: r.detail_game === "cricket" && d ? { darts: +d.darts, visits: +d.visits, marks: +d.marks, bestVisit: +d.bestVisit, nineMarkVisits: +d.nineMarkVisits, blankVisits: +d.blankVisits } : null,
      atw: r.detail_game === "atw" && d ? { darts: +d.darts, visits: +d.visits, trebleSkips: +d.trebleSkips, doubleSkips: +d.doubleSkips, bullDarts: +d.bullDarts, blankVisits: +d.blankVisits } : null,
    });
    byPlayer.set(Number(r.pid), list);
  }
  const rows = players.map(p => {
    const list = byPlayer.get(Number(p.id)) ?? [];
    const cards = Object.fromEntries(CARD_GAMES.map(g => [g, gameCard(g, list)])) as Row["cards"];
    const played = Object.fromEntries(CARD_GAMES.map(g => [g, list.filter(x => x.game === g).length])) as Row["played"];
    return { playerId: Number(p.id), name: String(p.name), cards, played };
  });
  cache = { at: Date.now(), rows };
  return rows;
}

/** A player's four cards, each with its league ranks (1 = best among players with that card). */
export async function playerCards(id: number) {
  const rows = await allRows();
  const me = rows.find(r => r.playerId === id);
  if (!me) return null;
  const cards = CARD_GAMES.map(game => {
    const c = me.cards[game];
    if (!c) return { game, locked: true as const, played: me.played[game], need: MIN_MATCHES };
    const rated = rows.filter(r => r.cards[game]);
    const rankOf = (v: (x: GameCardRatings) => number | null) => {
      const mine = v(c);
      return mine == null ? null : 1 + rated.filter(r => (v(r.cards[game]!) ?? -1) > mine).length;
    };
    // Outright best: top and nobody else on the same value (a 40 that everyone shares isn't "best").
    const sole = (k: string) => { const mine = c.ratings[k]; return mine != null && rated.every(r => r.playerId === id || (r.cards[game]!.ratings[k] ?? -1) < mine); };
    return { ...c, locked: false as const, band: cardBand(c.overall), of: rated.length,
      ranks: { overall: rankOf(x => x.overall), ...Object.fromEntries(Object.keys(c.ratings).map(k => [k, rankOf(x => x.ratings[k])])) },
      best: Object.keys(c.ratings).filter(sole) };
  });
  return { playerId: me.playerId, name: me.name, cards };
}

/** Every unlocked card, for Compare. */
export async function allPlayerCards() {
  return (await allRows()).map(r => ({ playerId: r.playerId, name: r.name,
    cards: Object.fromEntries(CARD_GAMES.map(g => [g, r.cards[g] ? { overall: r.cards[g]!.overall, ratings: r.cards[g]!.ratings, band: cardBand(r.cards[g]!.overall) } : null])) }));
}
