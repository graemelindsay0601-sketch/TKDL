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
    const { playerId, gameType, visits, streak } = req.body ?? {};
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
    if (s !== null && (!Number.isFinite(s) || s <= 0)) {
      res.status(400).json({ error: "streak must be a positive number" });
      return;
    }
    await db.execute(sql`
      INSERT INTO board_curse_best (player_id, game_type, best_visits, best_streak)
      VALUES (${pid}, ${gameType}, ${v}, ${s})
      ON CONFLICT (player_id, game_type) DO UPDATE SET
        best_visits = CASE
          WHEN ${v}::int IS NULL THEN board_curse_best.best_visits
          WHEN board_curse_best.best_visits IS NULL THEN ${v}::int
          ELSE LEAST(board_curse_best.best_visits, ${v}::int)
        END,
        best_streak = CASE
          WHEN ${s}::int IS NULL THEN board_curse_best.best_streak
          WHEN board_curse_best.best_streak IS NULL THEN ${s}::int
          ELSE GREATEST(board_curse_best.best_streak, ${s}::int)
        END,
        updated_at = NOW()
    `);
    res.json({ success: true });
  } catch (err) {
    (req as any).log?.error({ err }, "Failed to record board curse result");
    res.status(500).json({ error: "Failed to record board curse result" });
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
    const { playerId, format, won } = req.body ?? {};
    const pid = parseInt(playerId, 10);
    if (!Number.isFinite(pid) || !isValidFormat(format) || typeof won !== "boolean") {
      res.status(400).json({ error: "playerId, format, and won (boolean) are required" });
      return;
    }

    await db.execute(sql`
      INSERT INTO board_curse_records (player_id, format, wins, losses)
      VALUES (${pid}, ${format}, ${won ? 1 : 0}, ${won ? 0 : 1})
      ON CONFLICT (player_id, format) DO UPDATE SET
        wins = board_curse_records.wins + ${won ? 1 : 0},
        losses = board_curse_records.losses + ${won ? 0 : 1}
    `);
    res.json({ success: true });
  } catch (err) {
    (req as any).log?.error({ err }, "Failed to record board curse match result");
    res.status(500).json({ error: "Failed to record board curse match result" });
  }
});

router.get("/board-curse/leaderboard/:gameType", async (req: Request, res: Response) => {
  try {
    const gameType = req.params.gameType;
    if (!isValidGameType(gameType)) {
      res.status(400).json({ error: "Invalid gameType" });
      return;
    }
    const [bestVisitsRows, bestStreakRows] = await Promise.all([
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
    ]);
    res.json({
      bestVisits: bestVisitsRows.rows.map((r: any) => ({ playerName: r.player_name as string, value: r.value as number })),
      bestStreak: bestStreakRows.rows.map((r: any) => ({ playerName: r.player_name as string, value: r.value as number })),
    });
  } catch (err) {
    (req as any).log?.error({ err }, "Failed to load board curse leaderboard");
    res.status(500).json({ error: "Failed to load board curse leaderboard" });
  }
});

export default router;
