/**
 * Board Curse Mode routes.
 *
 * Pure arcade — nothing here touches matches/Elo/stats.
 *
 * - GET  /api/board-curse/best/:playerId/:gameType        - personal bests (fewest visits, longest Endless streak)
 * - POST /api/board-curse/best                            - report a result, each field kept only if it's an improvement
 * - GET  /api/board-curse/record/:playerId/:format        - win/loss record vs Bot or vs Local
 * - POST /api/board-curse/record                          - report a vs Bot/vs Local result
 * - GET  /api/board-curse/leaderboard/:gameType            - top Solo bests and Endless streaks, across everyone
 */

import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { paramStr } from "../lib/http";
import { bossBattleRateLimit } from "../middleware/writeRateLimit";
import { checkBoardCurseAchievements } from "../lib/board-curse-achievements";
import { isRecentDuplicateSubmit } from "../lib/recentSubmitGuard";
import { requireAdminSession } from "../middleware/requireAdminSession";

const router = Router();

function isValidGameType(v: unknown): v is "X01" | "CRICKET" {
  return v === "X01" || v === "CRICKET";
}

function isValidFormat(v: unknown): v is "bot" | "local" {
  return v === "bot" || v === "local";
}

router.get("/board-curse/best/:playerId/:gameType", async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(paramStr(req.params.playerId), 10);
    const gameType = req.params.gameType;
    if (!Number.isFinite(playerId) || !isValidGameType(gameType)) {
      res.status(400).json({ error: "Invalid playerId or gameType" });
      return;
    }
    const rows = await db.execute(sql`
      SELECT best_visits, best_streak FROM board_curse_best WHERE player_id = ${playerId} AND game_type = ${gameType}
    `);
    const row = rows.rows[0] as any;
    res.json({
      bestVisits: row?.best_visits ?? null,
      bestStreak: row?.best_streak ?? null,
    });
  } catch (err) {
    (req as any).log?.error({ err }, "Failed to load board curse best");
    res.status(500).json({ error: "Failed to load board curse best" });
  }
});

router.post("/board-curse/best", bossBattleRateLimit, async (req: Request, res: Response) => {
  try {
    const { playerId, gameType, visits, streak, outcome } = req.body ?? {};
    const pid = parseInt(playerId, 10);
    const v = visits !== undefined ? parseInt(visits, 10) : null;
    const s = streak !== undefined ? parseInt(streak, 10) : null;
    if (!Number.isFinite(pid) || !isValidGameType(gameType) || (v === null && s === null)) {
      res.status(400).json({ error: "playerId, gameType, and at least one of visits/streak are required" });
      return;
    }

    // No login/session check here, on purpose — board-curse.tsx dropped its
    // login requirement so anyone can pick a name from the roster and play,
    // same as Master-501/Practice/Tour/Matches. bossBattleRateLimit (shared
    // with Boss Battle — both are the same "unauthenticated arcade write"
    // risk shape) is the guard for this route, not a login requirement.
    if (v !== null && (!Number.isFinite(v) || v <= 0)) {
      res.status(400).json({ error: "visits must be a positive number" });
      return;
    }
    if (s !== null && (!Number.isFinite(s) || s < 0)) {
      res.status(400).json({ error: "streak must be zero or a positive number" });
      return;
    }
    const safeOutcome = outcome === "loss" ? "loss" : "win";
    const savedVisits = safeOutcome === "win" ? v : null;
    const savedStreak = s !== null && s > 0 ? s : null;
    const [previous, player] = await Promise.all([
      db.execute(sql`SELECT best_visits,best_streak FROM board_curse_best WHERE player_id=${pid} AND game_type=${gameType}`),
      db.execute(sql`SELECT name FROM players WHERE id=${pid}`),
    ]);
    if (!player.rows[0]) { res.status(400).json({ error: "Player not found" }); return; }
    const old = previous.rows[0] as any;
    const newVisitBest = savedVisits !== null && (old?.best_visits == null || savedVisits < Number(old.best_visits));
    const newStreakBest = savedStreak !== null && (old?.best_streak == null || savedStreak > Number(old.best_streak));
    const milestoneKind = newStreakBest ? "curse_streak_best" : newVisitBest ? "curse_visit_best" : null;
    const playerName = String((player.rows[0] as any).name);
    const milestoneLabel = newStreakBest
      ? `${playerName} set a new Board Curse streak of ${s}`
      : newVisitBest ? `${playerName} cleared Board Curse in a personal-best ${v} visits` : null;
    await db.transaction(async tx => {
      await tx.execute(sql`
        INSERT INTO board_curse_best (player_id, game_type, best_visits, best_streak)
        VALUES (${pid}, ${gameType}, ${savedVisits}, ${savedStreak})
        ON CONFLICT (player_id, game_type) DO UPDATE SET
          best_visits = CASE
            WHEN ${savedVisits}::int IS NULL THEN board_curse_best.best_visits
            WHEN board_curse_best.best_visits IS NULL THEN ${savedVisits}::int
            ELSE LEAST(board_curse_best.best_visits, ${savedVisits}::int)
          END,
          best_streak = CASE
            WHEN ${savedStreak}::int IS NULL THEN board_curse_best.best_streak
            WHEN board_curse_best.best_streak IS NULL THEN ${savedStreak}::int
            ELSE GREATEST(board_curse_best.best_streak, ${savedStreak}::int)
          END,
          updated_at = NOW()
      `);
      await tx.execute(sql`
        INSERT INTO arcade_runs (player_id,mode,game_type,format,opponent_label,outcome,visits,streak,milestone_kind,milestone_label)
        VALUES (${pid},'board_curse',${gameType},'solo','The Board',${safeOutcome},${v},${s},${milestoneKind},${milestoneLabel})
      `);
    });
    // .catch() required — the route's own try/catch only guards the awaited
    // work above; a bare `void` fire-and-forget call with no handler becomes
    // an unhandled promise rejection if checkBoardCurseAchievements ever
    // throws, crashing the whole Node process (Node >=15 default behavior)
    // after this result has already committed and responded successfully.
    const achievements = await checkBoardCurseAchievements(pid);
    res.json({ success: true, saved: true, achievements, personalBest: newVisitBest || newStreakBest });
  } catch (err) {
    (req as any).log?.error({ err }, "Failed to record board curse result");
    res.status(500).json({ error: "Failed to record board curse result" });
  }
});

router.post("/board-curse/daily", bossBattleRateLimit, async (req: Request, res: Response) => {
  try {
    const pid = parseInt(req.body?.playerId, 10);
    const gameType = req.body?.gameType;
    const visits = Math.round(Number(req.body?.visits));
    const won = req.body?.won === true;
    const limit = gameType === "X01" ? 15 : 17;
    if (!Number.isFinite(pid) || !isValidGameType(gameType) || !Number.isFinite(visits) || visits <= 0 || visits > limit) {
      res.status(400).json({ error: "Invalid Daily Curse result" });
      return;
    }
    const player = await db.execute(sql`SELECT name FROM players WHERE id=${pid}`);
    if (!player.rows[0]) { res.status(400).json({ error: "Player not found" }); return; }
    const challengeDate = new Date().toISOString().slice(0, 10);
    const previous = won ? await db.execute(sql`
      SELECT 1 FROM arcade_runs WHERE player_id=${pid} AND mode='board_curse_daily' AND game_type=${gameType}
      AND played_at::date=CURRENT_DATE AND outcome='win' LIMIT 1
    `) : null;
    const firstDailyClear = won && previous?.rows.length === 0;
    await db.execute(sql`
      INSERT INTO arcade_runs (player_id,mode,game_type,format,opponent_label,outcome,visits,milestone_kind,milestone_label,metadata)
      VALUES (${pid},'board_curse_daily',${gameType},'solo','Daily Curse',${won ? "win" : "loss"},${visits},${firstDailyClear ? "daily_curse_clear" : null},${firstDailyClear ? `${String((player.rows[0] as any).name)} cleared the Daily Curse` : null},${JSON.stringify({ challengeDate, limit })}::jsonb)
    `);
    res.json({ success: true, saved: true, challengeDate, firstDailyClear });
  } catch (err) {
    (req as any).log?.error({ err }, "Failed to save Daily Curse");
    res.status(500).json({ error: "Failed to save Daily Curse" });
  }
});

router.get("/board-curse/record/:playerId/:format", async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(paramStr(req.params.playerId), 10);
    const format = req.params.format;
    if (!Number.isFinite(playerId) || !isValidFormat(format)) {
      res.status(400).json({ error: "Invalid playerId or format" });
      return;
    }
    const rows = await db.execute(sql`
      SELECT wins, losses FROM board_curse_records WHERE player_id = ${playerId} AND format = ${format}
    `);
    const row = rows.rows[0] as any;
    res.json({ wins: row?.wins ?? 0, losses: row?.losses ?? 0 });
  } catch (err) {
    (req as any).log?.error({ err }, "Failed to load board curse record");
    res.status(500).json({ error: "Failed to load board curse record" });
  }
});

router.post("/board-curse/record", bossBattleRateLimit, async (req: Request, res: Response) => {
  try {
    const { playerId, format, won, gameType, opponentLabel, visits } = req.body ?? {};
    const pid = parseInt(playerId, 10);
    if (!Number.isFinite(pid) || !isValidFormat(format) || typeof won !== "boolean") {
      res.status(400).json({ error: "playerId, format, and won (boolean) are required" });
      return;
    }

    // Unlike practice.ts's richer session body, there's nothing here to hash
    // for real idempotency keying — a double-tap or retried request looks
    // identical to a second genuine result. Treat the exact same outcome
    // arriving again within a few seconds as a duplicate submit rather than
    // a second real match (see recentSubmitGuard.ts).
    if (isRecentDuplicateSubmit(`board-curse-record:${pid}:${format}:${won}`)) {
      res.json({ success: true });
      return;
    }

    const previous = await db.execute(sql`SELECT wins FROM board_curse_records WHERE player_id=${pid} AND format=${format}`);
    const firstWin = won && Number((previous.rows[0] as any)?.wins ?? 0) === 0;
    const player = await db.execute(sql`SELECT name FROM players WHERE id=${pid}`);
    if (!player.rows[0]) { res.status(400).json({ error: "Player not found" }); return; }
    const playerName = String((player.rows[0] as any).name);
    const safeGameType = isValidGameType(gameType) ? gameType : null;
    const safeVisits = Number.isFinite(Number(visits)) && Number(visits) > 0 ? Math.round(Number(visits)) : null;
    const milestoneKind = firstWin ? "curse_first_win" : null;
    const milestoneLabel = firstWin ? `${playerName} recorded a first Board Curse ${format} win` : null;
    await db.transaction(async tx => {
      await tx.execute(sql`
        INSERT INTO board_curse_records (player_id, format, wins, losses)
        VALUES (${pid}, ${format}, ${won ? 1 : 0}, ${won ? 0 : 1})
        ON CONFLICT (player_id, format) DO UPDATE SET
          wins = board_curse_records.wins + ${won ? 1 : 0},
          losses = board_curse_records.losses + ${won ? 0 : 1}
      `);
      await tx.execute(sql`
        INSERT INTO arcade_runs (player_id,mode,game_type,format,opponent_label,outcome,visits,milestone_kind,milestone_label)
        VALUES (${pid},'board_curse',${safeGameType},${format},${String(opponentLabel ?? "Opponent").slice(0,80)},${won ? "win" : "loss"},${safeVisits},${milestoneKind},${milestoneLabel})
      `);
    });
    const achievements = await checkBoardCurseAchievements(pid);
    res.json({ success: true, saved: true, achievements });
  } catch (err) {
    (req as any).log?.error({ err }, "Failed to record board curse match result");
    res.status(500).json({ error: "Failed to record board curse match result" });
  }
});

router.get("/arcade/history/:playerId", async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(paramStr(req.params.playerId), 10);
    const requested = Math.max(1, Math.min(50, Number(req.query.limit) || 12));
    if (!Number.isFinite(playerId)) { res.status(400).json({ error: "Invalid playerId" }); return; }
    const rows = await db.execute(sql`
      SELECT id,mode,game_type,format,boss_id,opponent_label,outcome,elapsed_seconds,visits,streak,milestone_kind,milestone_label,played_at
      FROM arcade_runs WHERE player_id=${playerId} ORDER BY played_at DESC LIMIT ${requested}
    `);
    res.json(rows.rows.map((row: any) => ({
      id:Number(row.id), mode:row.mode, gameType:row.game_type, format:row.format, bossId:row.boss_id,
      opponentLabel:row.opponent_label, outcome:row.outcome, elapsedSeconds:row.elapsed_seconds == null ? null : Number(row.elapsed_seconds),
      visits:row.visits == null ? null : Number(row.visits), streak:row.streak == null ? null : Number(row.streak),
      milestoneKind:row.milestone_kind, milestoneLabel:row.milestone_label, playedAt:row.played_at,
    })));
  } catch (err) {
    (req as any).log?.error({ err }, "Failed to load arcade history");
    res.status(500).json({ error: "Failed to load arcade history" });
  }
});

router.get("/admin/arcade/balance", requireAdminSession, async (req: Request, res: Response) => {
  try {
    const [bosses, curseModes, curseRecords, curseBests, recent] = await Promise.all([
      // Boss Battle already had trustworthy aggregate counters before the
      // run ledger existed, so the dashboard can show its full history on
      // day one rather than only attempts recorded after this deployment.
      db.execute(sql`SELECT boss_id,SUM(attempts)::int attempts,SUM(wins)::int wins,ROUND(AVG(best_seconds) FILTER(WHERE best_seconds IS NOT NULL))::int avg_seconds FROM boss_battle_stats GROUP BY boss_id ORDER BY CASE boss_id WHEN 'rookie-wall' THEN 1 WHEN 'old-jinx' THEN 2 WHEN 'the-warden' THEN 3 WHEN 'lockdown' THEN 4 WHEN 'the-annihilator' THEN 5 ELSE 6 END`),
      db.execute(sql`SELECT game_type,format,COUNT(*)::int runs,COUNT(*) FILTER(WHERE outcome='win')::int wins,ROUND(AVG(visits) FILTER(WHERE visits IS NOT NULL),1) avg_visits,MAX(streak)::int best_streak FROM arcade_runs WHERE mode='board_curse' GROUP BY game_type,format ORDER BY game_type,format`),
      db.execute(sql`SELECT format,SUM(wins+losses)::int runs,SUM(wins)::int wins FROM board_curse_records GROUP BY format ORDER BY format`),
      db.execute(sql`SELECT game_type,COUNT(*)::int players,MIN(best_visits)::int best_visits,MAX(best_streak)::int best_streak FROM board_curse_best GROUP BY game_type ORDER BY game_type`),
      db.execute(sql`SELECT COUNT(*) FILTER(WHERE played_at>NOW()-INTERVAL '7 days')::int week_runs,COUNT(DISTINCT player_id) FILTER(WHERE played_at>NOW()-INTERVAL '30 days')::int month_players FROM arcade_runs`),
    ]);
    res.json({
      bosses:bosses.rows.map((r:any)=>({bossId:r.boss_id,attempts:Number(r.attempts),wins:Number(r.wins),winRate:Number(r.attempts)?Math.round(Number(r.wins)*100/Number(r.attempts)):0,avgSeconds:r.avg_seconds==null?null:Number(r.avg_seconds)})),
      curseModes:curseModes.rows.map((r:any)=>({gameType:r.game_type,format:r.format,runs:Number(r.runs),wins:Number(r.wins),winRate:Number(r.runs)?Math.round(Number(r.wins)*100/Number(r.runs)):0,avgVisits:r.avg_visits==null?null:Number(r.avg_visits),bestStreak:r.best_streak==null?null:Number(r.best_streak)})),
      curseRecords:curseRecords.rows.map((r:any)=>({format:r.format,runs:Number(r.runs),wins:Number(r.wins),winRate:Number(r.runs)?Math.round(Number(r.wins)*100/Number(r.runs)):0})),
      curseBests:curseBests.rows.map((r:any)=>({gameType:r.game_type,players:Number(r.players),bestVisits:r.best_visits==null?null:Number(r.best_visits),bestStreak:r.best_streak==null?null:Number(r.best_streak)})),
      activity:{weekRuns:Number((recent.rows[0] as any)?.week_runs??0),monthPlayers:Number((recent.rows[0] as any)?.month_players??0)},
    });
  } catch (err) {
    (req as any).log?.error({ err }, "Failed to load arcade balancing data");
    res.status(500).json({ error: "Failed to load arcade balancing data" });
  }
});

router.get("/board-curse/leaderboard/:gameType", async (req: Request, res: Response) => {
  try {
    const gameType = req.params.gameType;
    if (!isValidGameType(gameType)) {
      res.status(400).json({ error: "Invalid gameType" });
      return;
    }
    const [bestVisitsRows, bestStreakRows, dailyRows] = await Promise.all([
      db.execute(sql`
        SELECT p.name AS player_name, b.best_visits AS value
        FROM board_curse_best b JOIN players p ON p.id = b.player_id
        WHERE b.game_type = ${gameType} AND b.best_visits IS NOT NULL
        ORDER BY b.best_visits ASC LIMIT 10
      `),
      db.execute(sql`
        SELECT p.name AS player_name, b.best_streak AS value
        FROM board_curse_best b JOIN players p ON p.id = b.player_id
        WHERE b.game_type = ${gameType} AND b.best_streak IS NOT NULL
        ORDER BY b.best_streak DESC LIMIT 10
      `),
      db.execute(sql`
        SELECT DISTINCT ON (ar.player_id) p.name AS player_name, ar.visits AS value, ar.outcome
        FROM arcade_runs ar JOIN players p ON p.id=ar.player_id
        WHERE ar.mode='board_curse_daily' AND ar.game_type=${gameType} AND ar.played_at::date=CURRENT_DATE
        ORDER BY ar.player_id, CASE WHEN ar.outcome='win' THEN 0 ELSE 1 END, ar.visits ASC, ar.played_at ASC
      `),
    ]);
    const daily = dailyRows.rows.map((r: any) => ({ playerName: String(r.player_name), value: Number(r.value), outcome: String(r.outcome) }))
      .sort((a, b) => Number(b.outcome === "win") - Number(a.outcome === "win") || a.value - b.value)
      .slice(0, 10);
    res.json({
      bestVisits: bestVisitsRows.rows.map((r: any) => ({ playerName: r.player_name as string, value: r.value as number })),
      bestStreak: bestStreakRows.rows.map((r: any) => ({ playerName: r.player_name as string, value: r.value as number })),
      daily,
    });
  } catch (err) {
    (req as any).log?.error({ err }, "Failed to load board curse leaderboard");
    res.status(500).json({ error: "Failed to load board curse leaderboard" });
  }
});

export default router;
