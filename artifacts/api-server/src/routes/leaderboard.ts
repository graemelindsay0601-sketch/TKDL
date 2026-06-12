import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, playersTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { calcTier } from "../lib/elo";
import { computeIdentity } from "../lib/identity";
import { seasonStandingsTable } from "@workspace/db";
import { SHADOW_BOT_ACHIEVEMENT_DEFS, gamerscoreForRarity } from "../lib/shadow-bot-achievements";

const router = Router();

// ── Season leaderboard ──────────────────────────────────────────────────────
router.get("/leaderboard", async (_req, res): Promise<void> => {
  const players = await db.select().from(playersTable).where(eq(playersTable.isActive, true));

  const active     = players.filter(p => p.status !== "ELIMINATED");
  const eliminated = players.filter(p => p.status === "ELIMINATED");

  const sortByPoints = (a: typeof players[0], b: typeof players[0]) =>
    b.points - a.points || b.elo - a.elo;

  const sorted = [...active.sort(sortByPoints), ...eliminated.sort(sortByPoints)];

  const allStandings = await db.select().from(seasonStandingsTable).where(eq(seasonStandingsTable.isChampion, true));
  const titleCounts = new Map<number, number>();
  for (const s of allStandings) {
    titleCounts.set(s.playerId, (titleCounts.get(s.playerId) ?? 0) + 1);
  }

  const leaderboard = sorted.map((p, i) => {
    const rank = i + 1;
    const isChampion = (titleCounts.get(p.id) ?? 0) > 0;
    const identity = computeIdentity(p, rank, isChampion);
    const games = p.seasonWins + p.seasonLosses;
    return {
      position:      rank,
      positionChange: 0,
      playerId:      p.id,
      playerName:    p.name,
      wins:          p.seasonWins,
      losses:        p.seasonLosses,
      gamesPlayed:   games,
      points:        p.points,
      peakPoints:    p.peakPoints,
      elo:           p.elo,
      tier:          calcTier(p.elo),
      winRate:       games > 0 ? p.seasonWins / games : 0,
      currentStreak: p.currentWinStreak > 0 ? p.currentWinStreak : -p.currentLossStreak,
      status:        p.status,
      archetype:     identity.archetype,
      archetypeIcon: identity.archetypeIcon,
      aura:          identity.aura,
      auraColor:     identity.auraColor,
      title:         identity.title,
    };
  });

  res.json(leaderboard);
});

// ── Career / All-Time leaderboard ───────────────────────────────────────────
router.get("/leaderboard/career", async (req, res): Promise<void> => {
  const sortBy = (req.query.sortBy as string) ?? "wins";

  const players = await db.select().from(playersTable).where(eq(playersTable.isActive, true));

  const allStandings = await db.select().from(seasonStandingsTable).where(eq(seasonStandingsTable.isChampion, true));
  const titleCounts = new Map<number, number>();
  for (const s of allStandings) {
    titleCounts.set(s.playerId, (titleCounts.get(s.playerId) ?? 0) + 1);
  }

  const sortFn = (a: typeof players[0], b: typeof players[0]): number => {
    switch (sortBy) {
      case "wins":    return b.careerWins - a.careerWins || b.elo - a.elo;
      case "losses":  return b.careerLosses - a.careerLosses;
      case "elo":     return b.elo - a.elo;
      case "peakElo": return b.careerPeakElo - a.careerPeakElo;
      case "points":  return b.careerPoints - a.careerPoints;
      case "winRate": {
        const aRate = a.careerGamesPlayed > 0 ? a.careerWins / a.careerGamesPlayed : 0;
        const bRate = b.careerGamesPlayed > 0 ? b.careerWins / b.careerGamesPlayed : 0;
        return bRate - aRate;
      }
      default:        return b.careerWins - a.careerWins;
    }
  };

  const sorted = [...players].sort(sortFn);

  const result = sorted.map((p, i) => {
    const titles = titleCounts.get(p.id) ?? 0;
    const isChampion = titles > 0;
    const identity = computeIdentity(p, i + 1, isChampion);
    const wr = p.careerGamesPlayed > 0 ? Math.round((p.careerWins / p.careerGamesPlayed) * 100) : 0;
    return {
      position:          i + 1,
      playerId:          p.id,
      playerName:        p.name,
      careerWins:        p.careerWins,
      careerLosses:      p.careerLosses,
      careerGamesPlayed: p.careerGamesPlayed,
      careerPoints:      p.careerPoints,
      peakElo:           p.careerPeakElo,
      elo:               p.elo,
      tier:              calcTier(p.elo),
      winRate:           wr,
      titles:            titles,
      longestStreak:     p.longestWinStreak,
      status:            p.status,
      archetype:         identity.archetype,
      archetypeIcon:     identity.archetypeIcon,
      title:             identity.title,
    };
  });

  res.json(result);
});

// ── Achievements leaderboard ────────────────────────────────────────────────
router.get("/leaderboard/achievements", async (_req, res): Promise<void> => {
  try {
    // Use separate CTEs to avoid cartesian product between player_achievements
    // and player_tour_achievements (cross-join inflates every SUM by N×M).
    const [playerRows, shadowRows] = await Promise.all([
      db.execute(sql`
        WITH lg AS (
          SELECT pa.player_id,
            COUNT(pa.id)::int AS league_count,
            COALESCE(SUM(CASE a.rarity
              WHEN 'Common'    THEN 5
              WHEN 'Uncommon'  THEN 10
              WHEN 'Rare'      THEN 25
              WHEN 'Epic'      THEN 50
              WHEN 'Legendary' THEN 100
              WHEN 'Mythic'    THEN 250
              ELSE 5 END), 0)::int AS league_gs
          FROM player_achievements pa
          JOIN achievements a ON a.id = pa.achievement_id
          GROUP BY pa.player_id
        ),
        tg AS (
          SELECT pta.player_id,
            COUNT(pta.id)::int AS tour_count,
            COALESCE(SUM(tad.gamerscore), 0)::int AS tour_gs
          FROM player_tour_achievements pta
          JOIN tour_achievement_definitions tad ON tad.key = pta.achievement_key
          GROUP BY pta.player_id
        ),
        tt AS (
          SELECT player_id,
            COALESCE(SUM(gamerscore), 0)::int AS trophy_gs
          FROM tour_trophies
          GROUP BY player_id
        )
        SELECT
          p.id   AS player_id,
          p.name AS player_name,
          p.status,
          COALESCE(lg.league_count, 0) AS league_count,
          COALESCE(lg.league_gs,    0) AS league_gs,
          COALESCE(tg.tour_count,   0) AS tour_count,
          COALESCE(tg.tour_gs,      0) AS tour_gs,
          COALESCE(tt.trophy_gs,    0) AS trophy_gs
        FROM players p
        LEFT JOIN lg ON lg.player_id = p.id
        LEFT JOIN tg ON tg.player_id = p.id
        LEFT JOIN tt ON tt.player_id = p.id
        WHERE p.is_active = true
      `),
      db.execute(sql`
        SELECT player_id, achievement_key
        FROM shadow_bot_achievements
        WHERE player_id IN (SELECT id FROM players WHERE is_active = true)
      `),
    ]);

    const shadowGsMap = new Map<number, number>();
    for (const row of shadowRows.rows as { player_id: number; achievement_key: string }[]) {
      const def = SHADOW_BOT_ACHIEVEMENT_DEFS.find(d => d.key === row.achievement_key);
      const gs  = def ? gamerscoreForRarity(def.rarity) : 0;
      shadowGsMap.set(Number(row.player_id), (shadowGsMap.get(Number(row.player_id)) ?? 0) + gs);
    }

    const mapped = (playerRows.rows as any[]).map(r => {
      const pid      = Number(r.player_id);
      const leagueGs = Number(r.league_gs);
      const tourGs   = Number(r.tour_gs) + Number(r.trophy_gs) + (shadowGsMap.get(pid) ?? 0);
      const totalGs  = leagueGs + tourGs;
      return {
        playerId:    pid,
        playerName:  r.player_name,
        status:      r.status,
        leagueCount: Number(r.league_count),
        leagueGs,
        tourCount:   Number(r.tour_count),
        tourGs,
        totalCount:  Number(r.league_count) + Number(r.tour_count),
        totalGs,
      };
    });

    mapped.sort((a, b) => b.totalGs - a.totalGs || b.leagueCount - a.leagueCount);
    res.json(mapped.map((r, i) => ({ position: i + 1, ...r })));
  } catch (err) {
    (_req as any)?.log?.error({ err }, "Failed achievements leaderboard");
    res.status(500).json({ error: "Failed" });
  }
});

// ── Bot / Practice leaderboard ───────────────────────────────────────────────
router.get("/leaderboard/bot", async (_req, res): Promise<void> => {
  try {
    const rows = (await db.execute(sql`
      SELECT
        p.id                                      AS player_id,
        p.name                                    AS player_name,
        p.status,
        COUNT(ps.id)::int                              AS total_sessions,
        COALESCE(SUM(ps.p1_darts), 0)::int            AS total_darts,
        COALESCE(SUM(ps.p1_score), 0)::int            AS total_score,
        COALESCE(SUM(ps.p1_checkout_hits), 0)::int    AS checkout_hits,
        COALESCE(SUM(ps.p1_180s), 0)::int             AS total_180s,
        COUNT(DISTINCT ps.game_type_key)::int          AS unique_games,
        COALESCE(SUM(ps.p1_checkout_attempts), 0)::int AS checkout_attempts
      FROM players p
      LEFT JOIN practice_sessions ps ON ps.player1_id = p.id
      WHERE p.is_active = true
      GROUP BY p.id, p.name, p.status
      ORDER BY total_darts DESC, total_sessions DESC
    `)).rows as any[];

    res.json(rows.map((r, i) => ({
      position:           i + 1,
      playerId:           r.player_id,
      playerName:         r.player_name,
      status:             r.status,
      totalSessions:      Number(r.total_sessions),
      totalDarts:         Number(r.total_darts),
      totalScore:         Number(r.total_score),
      checkoutHits:       Number(r.checkout_hits),
      total180s:          Number(r.total_180s),
      uniqueGames:        Number(r.unique_games),
      checkoutAttempts:   Number(r.checkout_attempts),
    })));
  } catch (err) {
    (_req as any)?.log?.error({ err }, "Failed bot leaderboard");
    res.status(500).json({ error: "Failed" });
  }
});

// ── Tour leaderboard ─────────────────────────────────────────────────────────
router.get("/leaderboard/tour", async (_req, res): Promise<void> => {
  try {
    const rows = (await db.execute(sql`
      SELECT
        p.id   AS player_id,
        p.name AS player_name,
        p.status,
        COUNT(tt.id)::int                                       AS total_trophies,
        COUNT(CASE WHEN td.tier = 1 THEN 1 END)::int           AS t1,
        COUNT(CASE WHEN td.tier = 2 THEN 1 END)::int           AS t2,
        COUNT(CASE WHEN td.tier = 3 THEN 1 END)::int           AS t3,
        COUNT(CASE WHEN td.tier = 4 THEN 1 END)::int           AS t4,
        COUNT(CASE WHEN td.tier = 5 THEN 1 END)::int           AS t5,
        COUNT(CASE WHEN td.tier = 6 THEN 1 END)::int           AS t6,
        COALESCE(MAX(td.tier), 0)::int                         AS highest_tier,
        COUNT(CASE WHEN tt.difficulty = 'elite' THEN 1 END)::int   AS elite_wins,
        COUNT(CASE WHEN tt.difficulty = 'pro'   THEN 1 END)::int   AS pro_wins,
        COUNT(DISTINCT tt.tour_id)::int                        AS unique_tours
      FROM players p
      LEFT JOIN tour_trophies tt     ON tt.player_id = p.id
      LEFT JOIN tour_definitions td  ON td.id        = tt.tour_id
      WHERE p.is_active = true
      GROUP BY p.id, p.name, p.status
      ORDER BY total_trophies DESC, highest_tier DESC, elite_wins DESC
    `)).rows as any[];

    res.json(rows.map((r, i) => ({
      position:     i + 1,
      playerId:     r.player_id,
      playerName:   r.player_name,
      status:       r.status,
      totalTrophies:Number(r.total_trophies),
      t1: Number(r.t1), t2: Number(r.t2), t3: Number(r.t3),
      t4: Number(r.t4), t5: Number(r.t5), t6: Number(r.t6),
      highestTier:  Number(r.highest_tier),
      eliteWins:    Number(r.elite_wins),
      proWins:      Number(r.pro_wins),
      uniqueTours:  Number(r.unique_tours),
    })));
  } catch (err) {
    (_req as any)?.log?.error({ err }, "Failed tour leaderboard");
    res.status(500).json({ error: "Failed" });
  }
});

export default router;
