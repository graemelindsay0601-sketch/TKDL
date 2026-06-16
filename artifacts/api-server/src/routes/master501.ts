import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";
import { logger } from "../lib/logger";
import { checkM501Achievements } from "../lib/master501-achievements";
import { checkAndGrantTitles } from "../lib/titles";

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
      WITH run_stats AS (
        SELECT player_id,
               COUNT(*)                                    AS total_runs,
               COUNT(CASE WHEN result = 'win'  THEN 1 END) AS total_wins,
               COUNT(CASE WHEN result = 'loss' THEN 1 END) AS total_losses
        FROM master501_runs
        WHERE result IS NOT NULL
        GROUP BY player_id
      ),
      session_stats AS (
        SELECT player1_id,
               COALESCE(SUM(p1_180s),             0)::int                                                                 AS total_180s,
               COALESCE(SUM(p1_checkout_hits),    0)::int                                                                 AS co_hits,
               COALESCE(SUM(p1_checkout_attempts),0)::int                                                                 AS co_attempts,
               COALESCE(MAX(CASE WHEN p1_darts > 0 THEN (p1_score::float / p1_darts) * 3.0 END), 0)::numeric(6,2)        AS best_avg
        FROM practice_sessions
        WHERE session_data->>'mode' = 'master501'
        GROUP BY player1_id
      )
      SELECT
        p.id, p.name,
        COALESCE(m.current_tier,  1)::int AS tier,
        COALESCE(m.current_round, 1)::int AS round,
        COALESCE(rs.total_wins,   0)::int AS total_wins,
        COALESCE(rs.total_losses, 0)::int AS total_losses,
        COALESCE(rs.total_runs,   0)::int AS total_runs,
        COALESCE(ss.best_avg,     0)      AS best_avg,
        COALESCE(ss.total_180s,   0)      AS total_180s,
        COALESCE(ss.co_hits,      0)      AS co_hits,
        COALESCE(ss.co_attempts,  0)      AS co_attempts
      FROM players p
      LEFT JOIN master501_progress m ON m.player_id = p.id
      LEFT JOIN run_stats     rs     ON rs.player_id   = p.id
      LEFT JOIN session_stats ss     ON ss.player1_id  = p.id
      WHERE p.status = 'ACTIVE'
      ORDER BY
        COALESCE(m.current_tier,  1) DESC,
        COALESCE(m.current_round, 1) DESC,
        COALESCE(rs.total_wins,   0) DESC,
        p.name
    `);
    res.json(result.rows as any[]);
  } catch (err) {
    logger.error({ err });
    res.status(500).json({ error: "Failed" });
  }
});

// GET /api/master501/achievement-definitions
router.get("/master501/achievement-definitions", async (_req, res): Promise<void> => {
  try {
    const result = await db.execute(sql`
      SELECT a.id, a.key, a.name, a.description, a.icon, a.rarity, a.hidden,
             a.criteria_type, a.criteria_value, a.priority,
             COUNT(pa.id)::int AS unlocked_count
      FROM achievements a
      LEFT JOIN player_achievements pa ON pa.achievement_id = a.id
      WHERE a.category = 'Master-501'
      GROUP BY a.id
      ORDER BY a.priority DESC, a.rarity DESC, a.name
    `);
    res.json(result.rows as any[]);
  } catch (err) {
    logger.error({ err });
    res.status(500).json({ error: "Failed" });
  }
});

// POST /api/master501/runs — start a run at the player's current tier/round, or at a
// specific tier/round if the player has already unlocked it (for replay).
router.post("/master501/runs", async (req, res): Promise<void> => {
  try {
    const { playerId, tier: reqTier, round: reqRound } = z.object({
      playerId: z.number().int().positive(),
      tier:     z.number().int().min(1).max(5).optional(),
      round:    z.number().int().min(1).max(3).optional(),
    }).parse(req.body);

    await db.execute(sql`
      INSERT INTO master501_progress (player_id, current_tier, current_round)
      VALUES (${playerId}, 1, 1)
      ON CONFLICT (player_id) DO NOTHING
    `);

    const progResult = await db.execute(sql`
      SELECT current_tier, current_round FROM master501_progress WHERE player_id = ${playerId}
    `);
    const prog       = (progResult.rows as any[])[0] as any;
    const curTier    = prog?.current_tier  ?? 1;
    const curRound   = prog?.current_round ?? 1;

    // Resolve the tier/round to actually play
    let tier  = curTier;
    let round = curRound;

    if (reqTier && reqRound) {
      // Allow replay only if the requested position is at or behind current progress
      const curPos = (curTier  - 1) * 3 + curRound;
      const reqPos = (reqTier  - 1) * 3 + reqRound;
      if (reqPos <= curPos) {
        tier  = reqTier;
        round = reqRound;
      }
    }

    const cfg = getM501Config(tier, round)!;

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

    const legsFormatVal = getM501Config(run.tier as number, run.round as number)?.legs ?? 5;

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

      // Only advance progress if winning this run would actually move it forward.
      // Replay wins (at a tier/round already behind current progress) are counted
      // in stats and achievements but must never regress the progress pointer.
      const curProgResult = await db.execute(sql`
        SELECT current_tier, current_round FROM master501_progress WHERE player_id = ${run.player_id}
      `);
      const curProg  = (curProgResult.rows as any[])[0] as any;
      const curTier  = curProg?.current_tier  ?? 1;
      const curRound = curProg?.current_round ?? 1;
      const curPos   = (curTier  - 1) * 3 + curRound;
      const nextPos  = (nextTier - 1) * 3 + nextRound;

      if (nextPos > curPos) {
        await db.execute(sql`
          UPDATE master501_progress
          SET current_tier = ${nextTier}, current_round = ${nextRound}, updated_at = NOW()
          WHERE player_id = ${run.player_id}
        `);
      } else {
        // Replay win: return the player's actual current position instead of the
        // next-step from the replayed round (so the UI can show their real progress).
        nextTier  = curTier;
        nextRound = curRound;
      }
    }

    void (async () => {
      await checkM501Achievements(Number(run.player_id), {
        tier:        Number(run.tier),
        round:       Number(run.round),
        result,
        legsWon,
        legsLost,
        legsFormat:  legsFormatVal,
      });
      await checkAndGrantTitles(Number(run.player_id));
    })();

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
