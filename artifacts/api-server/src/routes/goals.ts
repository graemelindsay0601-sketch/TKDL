import { Router } from "express";
import { sql } from "drizzle-orm";
import { db, playersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// ═══════════════════════════════════════════════════════════════════════
// Personal Goals (2026-09-25) — a player sets their own target (reach an
// Elo, a career win count, or an achievement-unlock count) and gets a
// progress bar toward it. Deliberately NOT the fixed, curated achievement
// system (achievements.ts) — these are player-chosen numbers, not
// league-defined milestones, and deliberately scoped to career-wide stats
// (Elo, careerWins, achievements unlocked) rather than anything
// season-scoped, since seasons here reset monthly (see seasonReset.ts) and
// a "win 10 this season" goal would go stale/confusing the moment the
// season rolled over mid-goal.
// ═══════════════════════════════════════════════════════════════════════

const GOAL_TYPES = ["elo", "career_wins", "achievements"] as const;
type GoalType = (typeof GOAL_TYPES)[number];

const IdParam = z.object({ id: z.coerce.number().int().positive() });
const GoalIdParam = z.object({ goalId: z.coerce.number().int().positive() });
const CreateGoalBody = z.object({
  goalType: z.enum(GOAL_TYPES),
  targetValue: z.coerce.number().int().positive(),
});

const MAX_ACTIVE_GOALS = 3;

async function currentValueFor(playerId: number, goalType: GoalType): Promise<number> {
  if (goalType === "elo" || goalType === "career_wins") {
    const [player] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
    if (!player) return 0;
    return goalType === "elo" ? player.elo : player.careerWins;
  }
  // achievements: total unlocked in the core system, same scope as the
  // "X achievements to unlock" count on rules.tsx (GET /achievements/counts).
  const rows = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM player_achievements WHERE player_id = ${playerId}
  `);
  return (rows.rows as { cnt: number }[])[0]?.cnt ?? 0;
}

// ── GET /players/:id/goals ───────────────────────────────────────────────
// Public read, same as every other per-player stat in this app (Elo,
// achievements, etc. are all visible league-wide) — only the write side
// needs an ownership check.
router.get("/players/:id/goals", async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const rows = (await db.execute(sql`
      SELECT id, goal_type, target_value, created_at, achieved_at
      FROM player_goals
      WHERE player_id = ${params.data.id}
      ORDER BY achieved_at IS NOT NULL, created_at DESC
    `)).rows as { id: number; goal_type: GoalType; target_value: number; created_at: string; achieved_at: string | null }[];

    const goals = await Promise.all(rows.map(async (r) => {
      const currentValue = await currentValueFor(params.data.id, r.goal_type);
      let achievedAt = r.achieved_at;
      // Lazily mark achieved the first time this is read after crossing the
      // target, so "achieved 3 days ago" reflects when it actually happened
      // rather than always showing "just now" on whatever page load notices.
      if (!achievedAt && currentValue >= r.target_value) {
        await db.execute(sql`UPDATE player_goals SET achieved_at = NOW() WHERE id = ${r.id} AND achieved_at IS NULL`);
        achievedAt = new Date().toISOString();
      }
      return {
        id: r.id,
        goalType: r.goal_type,
        targetValue: r.target_value,
        currentValue,
        createdAt: r.created_at,
        achievedAt,
      };
    }));

    res.json({ goals });
  } catch (err) {
    req.log.error({ err }, "GET /players/:id/goals failed");
    res.status(500).json({ error: "Failed to load goals" });
  }
});

// ── POST /goals ───────────────────────────────────────────────────────────
// Player identity comes from the session, never the request body — same
// fix already applied to this file's siblings (card favorites, active
// title, notification prefs) after an earlier audit found a trusted-body
// player id here.
router.post("/goals", async (req, res): Promise<void> => {
  const playerId = (req.session as any)?.playerId ?? null;
  if (!playerId) { res.status(401).json({ error: "Login required" }); return; }

  const body = CreateGoalBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid goal" }); return; }
  const { goalType, targetValue } = body.data;

  try {
    const activeCountRows = (await db.execute(sql`
      SELECT COUNT(*)::int AS cnt FROM player_goals WHERE player_id = ${playerId} AND achieved_at IS NULL
    `)).rows as { cnt: number }[];
    if ((activeCountRows[0]?.cnt ?? 0) >= MAX_ACTIVE_GOALS) {
      res.status(400).json({ error: `You can only track ${MAX_ACTIVE_GOALS} active goals at once — finish or drop one first` });
      return;
    }

    const currentValue = await currentValueFor(playerId, goalType);
    if (targetValue <= currentValue) {
      res.status(400).json({ error: `You're already at ${currentValue} — set a target above that` });
      return;
    }

    const inserted = (await db.execute(sql`
      INSERT INTO player_goals (player_id, goal_type, target_value)
      VALUES (${playerId}, ${goalType}, ${targetValue})
      RETURNING id, goal_type, target_value, created_at, achieved_at
    `)).rows[0] as { id: number; goal_type: GoalType; target_value: number; created_at: string; achieved_at: string | null };

    res.status(201).json({
      id: inserted.id,
      goalType: inserted.goal_type,
      targetValue: inserted.target_value,
      currentValue,
      createdAt: inserted.created_at,
      achievedAt: inserted.achieved_at,
    });
  } catch (err) {
    req.log.error({ err }, "POST /goals failed");
    res.status(500).json({ error: "Failed to create goal" });
  }
});

// ── DELETE /goals/:goalId ─────────────────────────────────────────────────
router.delete("/goals/:goalId", async (req, res): Promise<void> => {
  const playerId = (req.session as any)?.playerId ?? null;
  if (!playerId) { res.status(401).json({ error: "Login required" }); return; }

  const params = GoalIdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid goal id" }); return; }

  try {
    const deleted = await db.execute(sql`
      DELETE FROM player_goals WHERE id = ${params.data.goalId} AND player_id = ${playerId} RETURNING id
    `);
    if ((deleted.rows as any[]).length === 0) { res.status(404).json({ error: "Goal not found" }); return; }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "DELETE /goals/:goalId failed");
    res.status(500).json({ error: "Failed to delete goal" });
  }
});

export default router;
