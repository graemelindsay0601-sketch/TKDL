/**
 * DEV-ONLY audit helper: an isolated in-memory PGlite Career database with exactly the
 * Career startup steps production runs (read from src/app.ts), plus the composed services.
 * Never touches a real database or save.
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { careerStartupSteps, runCareerStartupSteps } from "../career-startup-steps.ts";
import { createCareerService } from "../../src/career/service.ts";
import { createCareerSportingService } from "../../src/career/sporting/service.ts";
import { createCareerLiveMatchService } from "../../src/career/live/service.ts";
import { createCareerLegacyService } from "../../src/career/legacy/service.ts";
import { createShadowObservations } from "../../src/db/migrations/create_shadow_observations_sb21a.ts";

export async function auditDatabase() {
  // AUDIT_PGDATA=dir keeps the audit database on disk (long world runs exceed memory in-process).
  const pg = process.env.AUDIT_PGDATA ? new PGlite(process.env.AUDIT_PGDATA) : new PGlite();
  const db = drizzle(pg);
  await pg.exec(`CREATE TABLE IF NOT EXISTS players (id INTEGER PRIMARY KEY); INSERT INTO players VALUES (1) ON CONFLICT DO NOTHING;
    CREATE TABLE IF NOT EXISTS feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);
    INSERT INTO feature_flags VALUES ('tour_career_2', true, false, 'progression audit') ON CONFLICT DO NOTHING`);
  await runCareerStartupSteps(db, careerStartupSteps());
  // The live-match service mirrors completed sessions into the shared shadow-activity tables (non-Career migration).
  await db.transaction(async tx => createShadowObservations(tx as never));
  const saves = createCareerService(db);
  const career = createCareerSportingService(db);
  const live = createCareerLiveMatchService(db, career.calendar);
  const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rows as Record<string, unknown>[];
  const legacy = createCareerLegacyService(db);
  /** Season Review gate: the player reads the review and confirms "BEGIN SEASON" (same API the UI uses). */
  const beginPendingSeason = async (id: string) => {
    const p = (await rows(sql`SELECT season FROM career_legacy_reviews WHERE career_save_id = ${id} AND acknowledged = false ORDER BY season LIMIT 1`))[0];
    if (p) await legacy.begin({ playerId: 1 }, id, Number(p.season), { confirmation: "BEGIN SEASON" });
    return p ? Number(p.season) : null;
  };
  return { pg, db, saves, career, live, rows, legacy, beginPendingSeason, actor: { playerId: 1 } };
}
export type AuditDb = Awaited<ReturnType<typeof auditDatabase>>;
