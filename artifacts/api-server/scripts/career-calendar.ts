/**
 * A3 validation harness. Generates a season calendar (static report) and plays a
 * complete Career season with no human participation in an isolated in-memory
 * PostgreSQL (PGlite), through the real A1/A2/A3 services. Dev-only.
 *   node scripts/career-calendar.ts [seed] [--replay]
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { createCareerSaves } from "../src/db/migrations/create_career_saves.ts";
import { createCareerWorld } from "../src/db/migrations/create_career_world.ts";
import { createCareerCalendar } from "../src/db/migrations/create_career_calendar.ts";
import { createCareerService } from "../src/career/service.ts";
import { createCareerCalendarService } from "../src/career/calendar/service.ts";
import { staticCalendarReport, seasonReport, HARNESS_SEED } from "../src/career/calendar/harness.ts";
import { canonicalJson } from "../src/career/calendar/generation.ts";

const seed = process.argv.find(a => /^[a-f0-9]{64}$/.test(a)) ?? HARNESS_SEED;
const replay = process.argv.includes("--replay");

async function playSeason() {
  const pg = new PGlite();
  const db = drizzle(pg);
  await pg.exec(`CREATE TABLE players (id INTEGER PRIMARY KEY); INSERT INTO players VALUES (1);
    CREATE TABLE feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);
    INSERT INTO feature_flags VALUES ('tour_career_2', true, false, 'harness')`);
  await createCareerSaves(db); await createCareerWorld(db); await createCareerCalendar(db);
  const save = await createCareerService(db).create(1, { slot: 1 });
  await db.execute(sql`UPDATE career_saves SET world_seed = ${seed} WHERE id = ${save.id}`);
  const calendar = createCareerCalendarService(db);
  const actor = { playerId: 1 };
  const started = performance.now();
  await calendar.initialize(actor, save.id);
  const advance = await calendar.advance(actor, save.id, { operationKey: "harness-season-1", expectedSeason: 1, expectedWeek: 1, target: { kind: "WEEKS", weeks: 52 } }) as { stop: unknown; to: unknown; weeksPlayed: number; steps: { summary: { simulatedMatches: number } | null; offSeason?: unknown }[] };
  const seasonMs = performance.now() - started;
  const retry = await calendar.advance(actor, save.id, { operationKey: "harness-season-1", expectedSeason: 1, expectedWeek: 1, target: { kind: "WEEKS", weeks: 52 } }) as { to: unknown };
  const report = await seasonReport(db, save.id, 1);
  const storage = (await pg.query(`SELECT COUNT(*)::int AS matches, pg_size_pretty(SUM(pg_column_size(m.*))) AS a2_match_storage FROM career_simulated_matches m`)).rows[0];
  await pg.close();
  return { advance: { stop: advance.stop, to: advance.to, weeksPlayed: advance.weeksPlayed, simulatedMatches: advance.steps.reduce((n, s) => n + (s.summary?.simulatedMatches ?? 0), 0),
    offSeason: advance.steps.find(s => s.offSeason)?.offSeason ? "processed once" : "missing", retryReturnedStoredResult: canonicalJson(retry.to) === canonicalJson(advance.to) },
    report, storage, runtimeSeconds: +(seasonMs / 1000).toFixed(1) };
}

const t0 = performance.now();
const calendarReport = staticCalendarReport(seed);
const season = await playSeason();
const second = replay ? await playSeason() : null;
console.log(JSON.stringify({
  staticCalendar: calendarReport,
  fullNpcSeason: season,
  deterministicReplay: second ? { championsIdentical: second.report.championHash === season.report.championHash, statusesIdentical: JSON.stringify(second.report.eventStatuses) === JSON.stringify(season.report.eventStatuses) } : "run with --replay",
  totalRuntimeSeconds: +((performance.now() - t0) / 1000).toFixed(1),
}, null, 2));
