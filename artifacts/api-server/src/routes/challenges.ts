import { Router }     from "express";
import { eq, sql }    from "drizzle-orm";
import { db, playersTable } from "@workspace/db";
import { CHALLENGE_DEFS } from "../lib/challengeDefs";

const router = Router();

router.get("/challenges", async (req, res): Promise<void> => {
  const playerId = req.query.playerId ? Number(req.query.playerId) : null;

  if (!playerId || isNaN(playerId)) {
    res.json(CHALLENGE_DEFS.map(c => ({
      ...c,
      current: 0,
      target: c.criteriaTarget < 0 ? 1 : c.criteriaTarget,
      completed: false,
      pct: 0,
    })));
    return;
  }

  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }

  const [
    practiceQ,
    m501ProgressQ,
    m501RunsQ,
    m501PerfectQ,
    tourRunsQ,
    tourTrophiesQ,
    eliteTourQ,
    proTrophyQ,
    seasonTitleQ,
    opponentsQ,
    activePlayersQ,
    beatHighTierQ,
    total180Q,
  ] = await Promise.all([
    db.execute(sql`
      SELECT COUNT(*)::int AS sessions,
             COALESCE(SUM(darts_thrown), 0)::int AS total_darts,
             COALESCE(MAX(CASE WHEN game_type_key LIKE '%01%' THEN p1_avg ELSE 0 END), 0)::float AS max_avg
      FROM practice_sessions WHERE player_id = ${playerId}
    `),
    db.execute(sql`SELECT COALESCE(MAX(current_tier),0)::int AS tier FROM master501_progress WHERE player_id = ${playerId}`),
    db.execute(sql`SELECT COUNT(*)::int AS cnt FROM master501_runs WHERE player_id = ${playerId}`),
    db.execute(sql`SELECT COUNT(*)::int AS cnt FROM master501_runs WHERE player_id = ${playerId} AND legs_lost = 0 AND result = 'win'`),
    db.execute(sql`SELECT COUNT(*)::int AS cnt FROM player_tour_runs WHERE player_id = ${playerId}`).catch(() => ({ rows: [{ cnt: 0 }] })),
    db.execute(sql`SELECT COUNT(*)::int AS cnt FROM tour_trophies WHERE player_id = ${playerId}`).catch(() => ({ rows: [{ cnt: 0 }] })),
    db.execute(sql`SELECT COUNT(*)::int AS cnt FROM player_tour_runs WHERE player_id = ${playerId} AND difficulty = 'elite'`).catch(() => ({ rows: [{ cnt: 0 }] })),
    db.execute(sql`SELECT COUNT(*)::int AS cnt FROM tour_trophies WHERE player_id = ${playerId} AND difficulty IN ('pro','elite')`).catch(() => ({ rows: [{ cnt: 0 }] })),
    db.execute(sql`SELECT COUNT(*)::int AS cnt FROM season_standings WHERE player_id = ${playerId} AND is_champion = true`),
    db.execute(sql`
      SELECT COUNT(DISTINCT CASE WHEN winner_id = ${playerId} THEN loser_id ELSE winner_id END)::int AS opponents
      FROM matches WHERE winner_id = ${playerId} OR loser_id = ${playerId}
    `),
    db.execute(sql`SELECT COUNT(*)::int AS cnt FROM players WHERE status = 'ACTIVE'`),
    db.execute(sql`
      SELECT COUNT(*)::int AS cnt FROM matches m
      JOIN players opp ON opp.id = m.loser_id
      WHERE m.winner_id = ${playerId} AND opp.elo >= 1100
    `),
    db.execute(sql`SELECT COALESCE(SUM(p1_180s),0)::int AS total FROM practice_sessions WHERE player_id = ${playerId}`),
  ]);

  const pr  = practiceQ.rows[0]     as any;
  const practiceCount  = pr?.sessions    ?? 0;
  const totalDarts     = pr?.total_darts ?? 0;
  const maxAvg         = Math.floor(pr?.max_avg ?? 0);

  const m501Tier       = (m501ProgressQ.rows[0]  as any)?.tier ?? 0;
  const m501Runs       = (m501RunsQ.rows[0]       as any)?.cnt  ?? 0;
  const m501Perfect    = (m501PerfectQ.rows[0]    as any)?.cnt  ?? 0;

  const tourRuns       = (tourRunsQ.rows[0]        as any)?.cnt  ?? 0;
  const tourTrophies   = (tourTrophiesQ.rows[0]    as any)?.cnt  ?? 0;
  const eliteTours     = (eliteTourQ.rows[0]       as any)?.cnt  ?? 0;
  const proWins        = (proTrophyQ.rows[0]        as any)?.cnt  ?? 0;

  const seasonTitles   = (seasonTitleQ.rows[0]     as any)?.cnt  ?? 0;
  const opponents      = (opponentsQ.rows[0]       as any)?.opponents ?? 0;
  const activePlayers  = (activePlayersQ.rows[0]   as any)?.cnt  ?? 1;
  const beatHighTier   = (beatHighTierQ.rows[0]    as any)?.cnt  ?? 0;
  const total180s      = (total180Q.rows[0]         as any)?.total ?? 0;

  const peakElo = player.careerPeakElo ?? player.elo;

  const result = CHALLENGE_DEFS.map(c => {
    let current = 0;
    let target  = c.criteriaTarget;

    switch (c.criteriaType) {
      case "career_wins":       current = player.careerWins;             break;
      case "win_streak":        current = player.longestWinStreak ?? 0;  break;
      case "beat_high_tier":    current = beatHighTier;                  break;
      case "season_title":      current = seasonTitles;                  break;
      case "play_all":
        current = opponents;
        target  = Math.max(1, activePlayers - 1);
        break;
      case "practice_sessions": current = practiceCount;                 break;
      case "total_darts":       current = totalDarts;                    break;
      case "max_avg":           current = maxAvg;                        break;
      case "m501_runs":         current = m501Runs;                      break;
      case "m501_tier":         current = m501Tier;                      break;
      case "m501_perfect":      current = m501Perfect;                   break;
      case "max_180s":          current = total180s;                     break;
      case "tour_runs":         current = tourRuns;                      break;
      case "tour_trophies":     current = tourTrophies;                  break;
      case "elite_tour":        current = eliteTours;                    break;
      case "pro_tour_win":      current = proWins;                       break;
      case "peak_elo":          current = peakElo;                       break;
      case "career_games":      current = player.careerGamesPlayed ?? 0; break;
    }

    const completed = target > 0 ? current >= target : false;
    const pct       = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
    return { ...c, current, target, completed, pct };
  });

  res.json(result);
});

export default router;
