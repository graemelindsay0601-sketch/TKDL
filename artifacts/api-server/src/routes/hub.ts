import { Router } from "express";
import { sql } from "drizzle-orm";
import { db, playersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

// ═══════════════════════════════════════════════════════════════════════
// Hub rework — support endpoints for dashboard.tsx's "State Band" (form
// sparkline), "Pulse" (merged activity feed) and freshness bar (last-visit
// tracking). None of this duplicates existing generated-client endpoints —
// useGetLeaderboard/useGetStatsSummary etc. still supply the standing data
// itself; these three fill the specific gaps nothing else already covers.
// ═══════════════════════════════════════════════════════════════════════

// ── GET /hub/form/:playerId ───────────────────────────────────────────────
// A player's last 8 results as ordered win/loss booleans, oldest first (so
// a left-to-right sparkline reads as "trending toward now"). Deliberately
// simple compared to streak-service.ts's gaps-and-islands query — this
// isn't computing a streak, just the raw recent sequence.
router.get("/hub/form/:playerId", async (req, res): Promise<void> => {
  try {
    const playerId = parseInt(req.params.playerId, 10);
    if (isNaN(playerId)) { res.status(400).json({ error: "Invalid player ID" }); return; }

    const rows = (await db.execute(sql`
      SELECT (winner_id = ${playerId}) AS is_win, played_at
      FROM matches
      WHERE winner_id = ${playerId} OR loser_id = ${playerId}
      ORDER BY played_at DESC, id DESC
      LIMIT 8
    `)).rows as { is_win: boolean; played_at: string }[];

    res.json({ results: rows.map(r => r.is_win).reverse() });
  } catch (err) {
    logger.error({ err }, "Failed to get player form");
    res.status(500).json({ error: "Failed to get player form" });
  }
});

// ── GET /hub/pulse ─────────────────────────────────────────────────────────
// Merges six genuinely timestamped event sources — singles/team matches,
// Doubles Event matches, Shift Wars matches, tour trophies, achievement
// unlocks, community posts — into one feed sorted by recency. Deliberately
// does NOT include the old League card's "narrative cards" or
// danger-zone/rivalry content: those are live-computed snapshots of current
// state, not discrete events with a real timestamp, so they don't fit an
// activity feed honestly (they're still shown, just in the State Band
// instead). There's no real "bot" event log anywhere in the schema (bot
// level-ups aren't recorded with a timestamp), so that category comes back
// empty here rather than faking entries — the frontend shows an honest
// empty state for it instead of invented content.
//
// 2026-09-25: fixed a real gap — this feed used to query only the plain
// `matches` table. "Team matches" (2v2/3v3/multi-Killer, routes/team-matches.ts)
// already write into that same table with a `team_%`/`multi_killer` gameType,
// so those were always included. But Doubles Event and Shift Wars results are
// recorded in their own dedicated tables (doubles_matches/doubles_teams,
// shift_wars_matches/shift_wars_teams — see routes/doubles.ts and
// routes/shift-wars.ts), which this feed never touched, so a doubles or
// shift-wars result — despite firing a push notification via
// sendDoublesMatchResultNotification/sendShiftWarsMatchResultNotification —
// never showed up anywhere as "recent activity." Both are now merged in
// alongside the plain matches query below.
type PulseItem = {
  id: string;
  category: "league" | "tour" | "achievements" | "community";
  icon: string;
  title: string;
  subtitle: string;
  timestamp: string;
};

router.get("/hub/pulse", async (_req, res): Promise<void> => {
  try {
    const [matches, doublesMatches, shiftWarsMatches, trophies, achievements, posts] = await Promise.all([
      db.execute(sql`
        SELECT id, winner_name, loser_name, stake, played_at
        FROM matches
        ORDER BY played_at DESC
        LIMIT 8
      `),
      db.execute(sql`
        SELECT dm.id, wt.team_name AS winner_team_name, lt.team_name AS loser_team_name, dm.stake, dm.played_at
        FROM doubles_matches dm
        JOIN doubles_teams wt ON wt.id = dm.winner_team_id
        JOIN doubles_teams lt ON lt.id = dm.loser_team_id
        ORDER BY dm.played_at DESC
        LIMIT 8
      `),
      db.execute(sql`
        SELECT sm.id, wt.name AS winner_team_name, lt.name AS loser_team_name, sm.stake, sm.played_at
        FROM shift_wars_matches sm
        JOIN shift_wars_teams wt ON wt.id = sm.winner_team_id
        JOIN shift_wars_teams lt ON lt.id = sm.loser_team_id
        ORDER BY sm.played_at DESC
        LIMIT 8
      `),
      db.execute(sql`
        SELECT tt.id, p.name AS player_name, td.name AS tour_name, td.emoji, tt.difficulty, tt.awarded_at
        FROM tour_trophies tt
        JOIN players p ON p.id = tt.player_id
        JOIN tour_definitions td ON td.id = tt.tour_id
        ORDER BY tt.awarded_at DESC
        LIMIT 8
      `),
      db.execute(sql`
        SELECT pa.id, p.name AS player_name, a.name AS achievement_name, a.icon, a.rarity, pa.unlocked_at
        FROM player_achievements pa
        JOIN players p ON p.id = pa.player_id
        JOIN achievements a ON a.id = pa.achievement_id
        ORDER BY pa.unlocked_at DESC
        LIMIT 8
      `),
      db.execute(sql`
        SELECT cp.id, p.name AS player_name, cp.content, cp.photo_path,
          (SELECT COUNT(*)::int FROM post_reactions WHERE post_id = cp.id) AS reaction_count,
          (SELECT COUNT(*)::int FROM post_comments WHERE post_id = cp.id) AS comment_count,
          cp.created_at
        FROM community_posts cp
        JOIN players p ON p.id = cp.player_id
        WHERE cp.status = 'approved'
        ORDER BY cp.created_at DESC
        LIMIT 8
      `),
    ]);

    const items: PulseItem[] = [
      ...(matches.rows as any[]).map(m => ({
        id: `match-${m.id}`,
        category: "league" as const,
        icon: "🎯",
        title: `${m.winner_name} def. ${m.loser_name}`,
        subtitle: m.stake > 0 ? `${m.stake} pts` : "",
        timestamp: m.played_at,
      })),
      ...(doublesMatches.rows as any[]).map(m => ({
        id: `doubles-${m.id}`,
        category: "league" as const,
        icon: "🎯",
        title: `${m.winner_team_name} def. ${m.loser_team_name}`,
        subtitle: m.stake > 0 ? `Doubles Event · ${m.stake} pts` : "Doubles Event",
        timestamp: m.played_at,
      })),
      ...(shiftWarsMatches.rows as any[]).map(m => ({
        id: `shiftwars-${m.id}`,
        category: "league" as const,
        icon: "🏬",
        title: `${m.winner_team_name} def. ${m.loser_team_name}`,
        subtitle: m.stake > 0 ? `Shift Wars · ${m.stake} pts` : "Shift Wars",
        timestamp: m.played_at,
      })),
      ...(trophies.rows as any[]).map(t => ({
        id: `trophy-${t.id}`,
        category: "tour" as const,
        icon: t.emoji || "🏆",
        title: `${t.player_name} won the ${t.tour_name} trophy`,
        subtitle: `${t.difficulty} tier`,
        timestamp: t.awarded_at,
      })),
      ...(achievements.rows as any[]).map(a => ({
        id: `ach-${a.id}`,
        category: "achievements" as const,
        icon: a.icon || "🎖️",
        title: `${a.player_name} unlocked "${a.achievement_name.replace(/^[^\s]+\s/, "")}"`,
        subtitle: a.rarity,
        timestamp: a.unlocked_at,
      })),
      ...(posts.rows as any[]).map(p => ({
        id: `post-${p.id}`,
        category: "community" as const,
        icon: p.photo_path ? "📸" : "💬",
        title: `${p.player_name} ${p.content ? "posted: " + p.content.slice(0, 60) : "shared a photo"}`,
        subtitle: [p.reaction_count > 0 ? `${p.reaction_count} reactions` : null, p.comment_count > 0 ? `${p.comment_count} comments` : null].filter(Boolean).join(" · "),
        timestamp: p.created_at,
      })),
    ];

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json(items.slice(0, 25));
  } catch (err) {
    logger.error({ err }, "Failed to get hub pulse feed");
    res.status(500).json({ error: "Failed to get hub pulse feed" });
  }
});

// ── GET /hub/visit/:playerId ──────────────────────────────────────────────
// Returns the player's PREVIOUS last_seen_hub_at (before this call), then
// stamps it to now — same "read old value, then mark seen" shape as
// broadcast.ts's live-status/mark-seen pair, just combined into one call
// since loading the Hub itself is the "seeing" event (unlike TKDL LIVE,
// there's no separate render-then-confirm step to wait for).
router.get("/hub/visit/:playerId", async (req, res): Promise<void> => {
  try {
    const playerId = parseInt(req.params.playerId, 10);
    if (isNaN(playerId)) { res.status(400).json({ error: "Invalid player ID" }); return; }

    const [player] = await db.select({ lastSeenHubAt: playersTable.lastSeenHubAt })
      .from(playersTable).where(eq(playersTable.id, playerId));
    if (!player) { res.status(404).json({ error: "Player not found" }); return; }

    await db.update(playersTable)
      .set({ lastSeenHubAt: new Date() })
      .where(eq(playersTable.id, playerId));

    res.json({ previousVisit: player.lastSeenHubAt ?? null });
  } catch (err) {
    logger.error({ err }, "Failed to record hub visit");
    res.status(500).json({ previousVisit: null });
  }
});

// ── GET /hub/on-this-day/:playerId ────────────────────────────────────────
// A small nostalgia nudge for the Hub: did this player play a match on
// this exact calendar day in some earlier year? Scoped deliberately to the
// plain `matches` table (singles + Team matches, which already share that
// table — see the Pulse fix above) rather than Doubles Event / Shift Wars:
// those record results at the team level with no team-membership join in
// scope here, so a doubles/Shift-Wars anniversary won't surface via this
// endpoint yet. Returns null (not 404) when nothing matches today's
// month/day in a past year — that's the ordinary case on 364 days a year,
// not an error, so the frontend just renders nothing for this card.
router.get("/hub/on-this-day/:playerId", async (req, res): Promise<void> => {
  try {
    const playerId = parseInt(req.params.playerId, 10);
    if (isNaN(playerId)) { res.status(400).json({ error: "Invalid player ID" }); return; }

    const rows = (await db.execute(sql`
      SELECT id, winner_id, winner_name, loser_id, loser_name, game_type, elo_change, played_at
      FROM matches
      WHERE (winner_id = ${playerId} OR loser_id = ${playerId})
        AND EXTRACT(MONTH FROM played_at) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(DAY FROM played_at) = EXTRACT(DAY FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM played_at) < EXTRACT(YEAR FROM CURRENT_DATE)
      ORDER BY played_at DESC
      LIMIT 1
    `)).rows as {
      id: number; winner_id: number; winner_name: string; loser_id: number; loser_name: string;
      game_type: string; elo_change: number; played_at: string;
    }[];

    const row = rows[0];
    if (!row) { res.json(null); return; }

    const wasWin = row.winner_id === playerId;
    res.json({
      matchId: row.id,
      playedAt: row.played_at,
      yearsAgo: new Date().getFullYear() - new Date(row.played_at).getFullYear(),
      wasWin,
      opponentId: wasWin ? row.loser_id : row.winner_id,
      opponentName: wasWin ? row.loser_name : row.winner_name,
      gameType: row.game_type,
      eloChange: row.elo_change,
    });
  } catch (err) {
    logger.error({ err }, "Failed to get on-this-day match");
    res.status(500).json(null);
  }
});

export default router;
