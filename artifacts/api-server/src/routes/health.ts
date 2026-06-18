import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/healthz/tables", async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    const tables = (result.rows as any[]).map(r => r.tablename as string);
    const required = [
      "community_posts", "post_reactions", "post_comments",
      "notifications", "players", "seasons", "matches",
      "settings", "achievements", "player_achievements",
      "season_standings", "game_types", "practice_sessions",
      "tour_definitions", "player_tour_runs", "tour_trophies",
    ];
    const status: Record<string, boolean> = {};
    for (const t of required) status[t] = tables.includes(t);
    res.json({ tables, status });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

export default router;
