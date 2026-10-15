import pg from "/home/user/TKDL/node_modules/.pnpm/node_modules/pg/lib/index.js";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { careerStartupSteps, runCareerStartupSteps } from "./career-startup-steps.ts";
import { createCareerService } from "../src/career/service.ts";
import { createCareerSportingService } from "../src/career/sporting/service.ts";
const pool = new pg.Pool({ connectionString: "postgresql://tkdl_dev:devpass@127.0.0.1:55432/tkdl_prof" });
const db = drizzle(pool);
await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS players (id INTEGER PRIMARY KEY); INSERT INTO players VALUES (1) ON CONFLICT DO NOTHING;
  CREATE TABLE IF NOT EXISTS feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);
  INSERT INTO feature_flags VALUES ('tour_career_2', true, false, 'prof') ON CONFLICT DO NOTHING`));
await runCareerStartupSteps(db as never, careerStartupSteps());
const saves = createCareerService(db as never), career = createCareerSportingService(db as never), actor = { playerId: 1 };
const s0 = await saves.create(1, { slot: 1, dateOfBirth: "1995-06-15", homeLocality: "ayrshire" });
let t = performance.now(); await career.initialize(actor, s0.id); console.log("init", Math.round(performance.now() - t));
for (let w = 0; w < Number(process.argv[2] ?? 12); w++) {
  const s = await saves.read(1, s0.id); t = performance.now();
  await career.calendar.advance(actor, s0.id, { operationKey: `prof-week-${w}`, expectedSeason: s.currentSeason, expectedWeek: s.currentWeek, target: { kind: "WEEKS", weeks: 1 } });
  console.log("week", s.currentWeek, Math.round(performance.now() - t));
}
await pool.end();
