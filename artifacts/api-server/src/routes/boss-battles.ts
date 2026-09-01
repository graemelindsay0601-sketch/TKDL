/**
 * Boss Battle Mode routes.
 *
 * Pure arcade progress tracking — which bosses a player has beaten, attempts
 * and best time per boss, and a friends leaderboard. Never touches
 * matches/Elo/stats; fights played here aren't submitted anywhere else.
 *
 * - GET  /api/boss-battles/progress/:playerId - defeated boss IDs + per-boss stats
 * - POST /api/boss-battles/attempt            - record one fight's outcome (win or lose)
 * - GET  /api/boss-battles/leaderboard        - friends' ladder progress + fastest times
 *
 * Hardening note: this used to be a single POST /complete that trusted
 * whatever { playerId, bossId } the client sent, with no proof a match was
 * actually played or that the ladder was cleared in order — a defeat could
 * be spoofed by calling the endpoint directly. /attempt now checks bossId
 * against a real allowlist and, for a win, that the previous boss on the
 * ladder is already beaten.
 */

import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { paramStr } from "../lib/http";
import { bossBattleRateLimit } from "../middleware/writeRateLimit";

const router = Router();

// Keep this in sync with artifacts/tkdl/src/lib/boss-battles-data.ts — this
// route never needs the moves/effects content, just enough to (a) reject an
// unknown bossId outright and (b) enforce that the ladder is cleared in
// order, order 1 first.
const BOSS_ORDER: Record<string, number> = {
  "rookie-wall":      1,
  "old-jinx":         2,
  "the-warden":       3,
  "lockdown":         4,
  "the-annihilator":  5,
  "the-reckoning":    6,
};
const TOTAL_BOSSES = Object.keys(BOSS_ORDER).length;
const bossIdForOrder = (order: number) => Object.keys(BOSS_ORDER).find(id => BOSS_ORDER[id] === order);

/** Clamp an untrusted client-reported fight duration to something sane, or
 *  null if it's missing/garbage — a bad timer value should never fail the
 *  whole request, it just means no time gets recorded for this attempt. */
function sanitizeSeconds(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > 3600) return null;
  return Math.round(n);
}

router.get("/boss-battles/progress/:playerId", async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(paramStr(req.params.playerId), 10);
    if (!Number.isFinite(playerId)) {
      res.status(400).json({ error: "Invalid playerId" });
      return;
    }
    const [progressRows, statsRows] = await Promise.all([
      db.execute(sql`SELECT boss_id FROM boss_battle_progress WHERE player_id = ${playerId}`),
      db.execute(sql`SELECT boss_id, attempts, wins, best_seconds FROM boss_battle_stats WHERE player_id = ${playerId}`),
    ]);
    const stats: Record<string, { attempts: number; wins: number; bestSeconds: number | null }> = {};
    for (const r of statsRows.rows as any[]) {
      stats[r.boss_id as string] = {
        attempts: Number(r.attempts),
        wins: Number(r.wins),
        bestSeconds: r.best_seconds === null ? null : Number(r.best_seconds),
      };
    }
    res.json({ defeated: progressRows.rows.map((r: any) => r.boss_id as string), stats });
  } catch (err) {
    (req as any).log?.error({ err }, "Failed to load boss battle progress");
    res.status(500).json({ error: "Failed to load boss battle progress" });
  }
});

router.post("/boss-battles/attempt", bossBattleRateLimit, async (req: Request, res: Response) => {
  try {
    const { playerId, bossId, won, elapsedSeconds } = req.body ?? {};
    const pid = parseInt(playerId, 10);
    if (!Number.isFinite(pid) || typeof bossId !== "string" || !(bossId in BOSS_ORDER)) {
      res.status(400).json({ error: "A valid playerId and bossId are required" });
      return;
    }
    const order = BOSS_ORDER[bossId];
    const didWin = won === true;

    const [player] = (await db.execute(sql`SELECT id FROM players WHERE id = ${pid}`)).rows as any[];
    if (!player) {
      res.status(400).json({ error: "Player not found" });
      return;
    }

    // Server-side unlock check — mirrors the client's isUnlocked logic, but
    // this is the copy that actually matters: a win can't be recorded for
    // any boss past order 1 unless the previous one is already beaten.
    if (didWin && order > 1) {
      const prevBossId = bossIdForOrder(order - 1);
      const [prevDefeat] = (await db.execute(sql`
        SELECT 1 FROM boss_battle_progress WHERE player_id = ${pid} AND boss_id = ${prevBossId} LIMIT 1
      `)).rows as any[];
      if (!prevDefeat) {
        res.status(400).json({ error: "Beat the previous boss on the ladder first" });
        return;
      }
    }

    const bestSeconds = didWin ? sanitizeSeconds(elapsedSeconds) : null;

    await db.execute(sql`
      INSERT INTO boss_battle_stats (player_id, boss_id, attempts, wins, best_seconds)
      VALUES (${pid}, ${bossId}, 1, ${didWin ? 1 : 0}, ${bestSeconds})
      ON CONFLICT (player_id, boss_id) DO UPDATE SET
        attempts     = boss_battle_stats.attempts + 1,
        wins         = boss_battle_stats.wins + ${didWin ? 1 : 0},
        best_seconds = CASE
          WHEN ${bestSeconds}::int IS NULL THEN boss_battle_stats.best_seconds
          WHEN boss_battle_stats.best_seconds IS NULL THEN ${bestSeconds}
          WHEN ${bestSeconds}::int < boss_battle_stats.best_seconds THEN ${bestSeconds}
          ELSE boss_battle_stats.best_seconds
        END
    `);

    if (didWin) {
      await db.execute(sql`
        INSERT INTO boss_battle_progress (player_id, boss_id)
        VALUES (${pid}, ${bossId})
        ON CONFLICT (player_id, boss_id) DO NOTHING
      `);
    }

    res.json({ success: true });
  } catch (err) {
    (req as any).log?.error({ err }, "Failed to record boss battle attempt");
    res.status(500).json({ error: "Failed to record boss battle attempt" });
  }
});

router.get("/boss-battles/leaderboard", async (req: Request, res: Response) => {
  try {
    const progressRows = (await db.execute(sql`
      SELECT bp.player_id, p.name AS player_name, bp.boss_id, bp.defeated_at
      FROM boss_battle_progress bp
      JOIN players p ON p.id = bp.player_id
      ORDER BY bp.defeated_at ASC
    `)).rows as any[];

    const byPlayer = new Map<number, { playerId: number; playerName: string; bossesDefeated: number; lastDefeatAt: string }>();
    for (const r of progressRows) {
      const existing = byPlayer.get(r.player_id);
      if (existing) {
        existing.bossesDefeated += 1;
        existing.lastDefeatAt = r.defeated_at;
      } else {
        byPlayer.set(r.player_id, { playerId: r.player_id, playerName: r.player_name, bossesDefeated: 1, lastDefeatAt: r.defeated_at });
      }
    }
    const players = Array.from(byPlayer.values())
      .map(p => ({ ...p, fullClear: p.bossesDefeated >= TOTAL_BOSSES }))
      .sort((a, b) => b.bossesDefeated - a.bossesDefeated || new Date(a.lastDefeatAt).getTime() - new Date(b.lastDefeatAt).getTime());

    const statsRows = (await db.execute(sql`
      SELECT bs.boss_id, p.name AS player_name, bs.best_seconds
      FROM boss_battle_stats bs
      JOIN players p ON p.id = bs.player_id
      WHERE bs.best_seconds IS NOT NULL
      ORDER BY bs.best_seconds ASC
    `)).rows as any[];
    const fastestPerBoss: Record<string, { playerName: string; seconds: number }> = {};
    for (const r of statsRows) {
      if (!fastestPerBoss[r.boss_id]) {
        fastestPerBoss[r.boss_id] = { playerName: r.player_name, seconds: Number(r.best_seconds) };
      }
    }

    res.json({ totalBosses: TOTAL_BOSSES, players, fastestPerBoss });
  } catch (err) {
    (req as any).log?.error({ err }, "Failed to load boss battle leaderboard");
    res.status(500).json({ error: "Failed to load boss battle leaderboard" });
  }
});

export default router;
