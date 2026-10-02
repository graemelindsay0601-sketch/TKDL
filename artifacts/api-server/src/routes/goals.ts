import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
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

async function currentValuesFor(playerId: number): Promise<Record<GoalType, number>> {
  const row = (await db.execute(sql`
    SELECT p.elo,
           p.career_wins,
           (SELECT COUNT(*)::int FROM player_achievements pa WHERE pa.player_id = p.id) AS achievements
    FROM players p
    WHERE p.id = ${playerId}
  `)).rows[0] as { elo: number; career_wins: number; achievements: number } | undefined;
  return {
    elo: row?.elo ?? 0,
    career_wins: row?.career_wins ?? 0,
    achievements: row?.achievements ?? 0,
  };
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

    const currentValues = await currentValuesFor(params.data.id);
    const goals = rows.map((r) => {
      const currentValue = currentValues[r.goal_type];
      return {
        id: r.id,
        goalType: r.goal_type,
        targetValue: r.target_value,
        currentValue,
        createdAt: r.created_at,
        achievedAt: r.achieved_at,
      };
    });

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
    const currentValue = (await currentValuesFor(playerId))[goalType];
    if (targetValue <= currentValue) {
      res.status(400).json({ error: `You're already at ${currentValue} — set a target above that` });
      return;
    }

    // Previously the active-count check and the insert were two separate
    // statements with no lock between them — a double-click or a retried
    // network call could both pass the count check before either insert
    // committed, letting a player end up with more than MAX_ACTIVE_GOALS.
    // Same per-key advisory-lock pattern already used for the player-code
    // race in players.ts/auth.ts, scoped to this player so it doesn't
    // serialize goal creation across the whole league.
    const inserted = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('tkdl-player-goals-' || ${playerId}::text))`);
      const activeCountRows = (await tx.execute(sql`
        SELECT COUNT(*)::int AS cnt FROM player_goals WHERE player_id = ${playerId} AND achieved_at IS NULL
      `)).rows as { cnt: number }[];
      if ((activeCountRows[0]?.cnt ?? 0) >= MAX_ACTIVE_GOALS) {
        throw new Error("TOO_MANY_ACTIVE_GOALS");
      }
      return (await tx.execute(sql`
        INSERT INTO player_goals (player_id, goal_type, target_value)
        VALUES (${playerId}, ${goalType}, ${targetValue})
        RETURNING id, goal_type, target_value, created_at, achieved_at
      `)).rows[0] as { id: number; goal_type: GoalType; target_value: number; created_at: string; achieved_at: string | null };
    });

    res.status(201).json({
      id: inserted.id,
      goalType: inserted.goal_type,
      targetValue: inserted.target_value,
      currentValue,
      createdAt: inserted.created_at,
      achievedAt: inserted.achieved_at,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "TOO_MANY_ACTIVE_GOALS") {
      res.status(400).json({ error: `You can only track ${MAX_ACTIVE_GOALS} active goals at once — finish or drop one first` });
      return;
    }
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
