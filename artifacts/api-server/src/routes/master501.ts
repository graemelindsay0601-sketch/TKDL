import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";
import { logger } from "../lib/logger";

const router = Router();

export const M501_TIERS = [
  { tier: 1, name: "Challenger",         color: "#94a3b8", dartLimits: [60, 55, 50] },
  { tier: 2, name: "Pro Circuit",        color: "#4ade80", dartLimits: [48, 45, 42] },
  { tier: 3, name: "Premier",            color: "#38bdf8", dartLimits: [39, 36, 33] },
  { tier: 4, name: "Grand Prix",         color: "#ffd24a", dartLimits: [30, 27, 24] },
  { tier: 5, name: "World Championship", color: "#ff005c", dartLimits: [21, 18, 15] },
] as const;

export const M501_ROUNDS = [
  { round: 1, legs: 5,  legsNeeded: 3, label: "Best of 5"  },
  { round: 2, legs: 9,  legsNeeded: 5, label: "Best of 9"  },
  { round: 3, legs: 11, legsNeeded: 6, label: "Best of 11" },
] as const;

export function getM501Config(tier: number, round: number) {
  const t = M501_TIERS[tier - 1 as 0|1|2|3|4];
  const r = M501_ROUNDS[round - 1 as 0|1|2];
  if (!t || !r) return null;
  return { ...t, ...r, dartLimit: t.dartLimits[round - 1 as 0|1|2] };
}

function nextTierRound(tier: number, round: number): { tier: number; round: number } {
  if (round < 3) return { tier, round: round + 1 };
  if (tier < 5)  return { tier: tier + 1, round: 1 };
  return { tier: 5, round: 3 };
}

// GET /api/master501/config
router.get("/master501/config", (_req, res) => {
  res.json({ tiers: M501_TIERS, rounds: M501_ROUNDS });
});

// GET /api/master501/progress/:playerId
router.get("/master501/progress/:playerId", async (req, res): Promise<void> => {
  try {
    const playerId = Number(req.params.playerId);
    const progResult = await db.execute(sql`
      SELECT current_tier, current_round FROM master501_progress WHERE player_id = ${playerId}
    `);
    const prog  = (progResult.rows as any[])[0] as any;
    const tier  = prog?.current_tier  ?? 1;
    const round = prog?.current_round ?? 1;

    const runsResult = await db.execute(sql`
      SELECT id, tier, round, dart_limit, legs_format, legs_won, legs_lost, result,
             started_at, completed_at
      FROM master501_runs
      WHERE player_id = ${playerId} AND result IS NOT NULL
      ORDER BY completed_at DESC LIMIT 20
    `);

    res.json({
      currentTier:  tier,
      currentRound: round,
      config:       getM501Config(tier, round),
      history:      runsResult.rows as any[],
    });
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Failed to load progress" });
  }
});

// GET /api/master501/leaderboard
router.get("/master501/leaderboard", async (_req, res): Promise<void> => {
  try {
    const result = await db.execute(sql`
      SELECT p.id, p.name,
             COALESCE(m.current_tier,  1) AS tier,
             COALESCE(m.current_round, 1) AS round,
             (SELECT COUNT(*) FROM master501_runs r
              WHERE r.player_id = p.id AND r.result = 'win') AS total_wins
      FROM players p
      LEFT JOIN master501_progress m ON m.player_id = p.id
      WHERE p.status = 'ACTIVE'
      ORDER BY COALESCE(m.current_tier, 1) DESC,
               COALESCE(m.current_round, 1) DESC,
               (SELECT COUNT(*) FROM master501_runs r WHERE r.player_id = p.id AND r.result = 'win') DESC,
               p.name
    `);
    res.json(result.rows as any[]);
  } catch (err) {
    logger.error({ err });
    res.status(500).json({ error: "Failed" });
  }
});

// POST /api/master501/runs — start a run at the player's current tier/round
router.post("/master501/runs", async (req, res): Promise<void> => {
  try {
    const { playerId } = z.object({ playerId: z.number().int().positive() }).parse(req.body);

    await db.execute(sql`
      INSERT INTO master501_progress (player_id, current_tier, current_round)
      VALUES (${playerId}, 1, 1)
      ON CONFLICT (player_id) DO NOTHING
    `);

    const progResult = await db.execute(sql`
      SELECT current_tier, current_round FROM master501_progress WHERE player_id = ${playerId}
    `);
    const prog  = (progResult.rows as any[])[0] as any;
    const tier  = prog?.current_tier  ?? 1;
    const round = prog?.current_round ?? 1;
    const cfg   = getM501Config(tier, round)!;

    const runResult = await db.execute(sql`
      INSERT INTO master501_runs (player_id, tier, round, dart_limit, legs_format, legs_won, legs_lost)
      VALUES (${playerId}, ${tier}, ${round}, ${cfg.dartLimit}, ${cfg.legs}, 0, 0)
      RETURNING id
    `);
    const runRow = (runResult.rows as any[])[0] as any;

    res.json({ runId: runRow.id, tier, round, config: cfg });
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Failed to start run" });
  }
});

// PATCH /api/master501/runs/:runId — record final match result
router.patch("/master501/runs/:runId", async (req, res): Promise<void> => {
  try {
    const runId = Number(req.params.runId);
    const { result, legsWon, legsLost } = z.object({
      result:   z.enum(["win", "loss"]),
      legsWon:  z.number().int().min(0),
      legsLost: z.number().int().min(0),
    }).parse(req.body);

    const runResult = await db.execute(sql`
      SELECT player_id, tier, round FROM master501_runs WHERE id = ${runId}
    `);
    const run = (runResult.rows as any[])[0] as any;
    if (!run) { res.status(404).json({ error: "Run not found" }); return; }

    await db.execute(sql`
      UPDATE master501_runs
      SET legs_won = ${legsWon}, legs_lost = ${legsLost},
          result = ${result}, completed_at = NOW()
      WHERE id = ${runId}
    `);

    let nextTier  = run.tier  as number;
    let nextRound = run.round as number;

    if (result === "win") {
      const n = nextTierRound(run.tier, run.round);
      nextTier  = n.tier;
      nextRound = n.round;
      await db.execute(sql`
        UPDATE master501_progress
        SET current_tier = ${nextTier}, current_round = ${nextRound}, updated_at = NOW()
        WHERE player_id = ${run.player_id}
      `);
    }

    res.json({
      result,
      nextTier,
      nextRound,
      nextConfig: getM501Config(nextTier, nextRound),
      maxed: nextTier === 5 && nextRound === 3 && result === "win",
    });
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Failed to record result" });
  }
});

export default router;
