import { sql } from "drizzle-orm";
import { createRequire } from "node:module";
import { drizzle } from "drizzle-orm/node-postgres";
import { readRetryingCareerDatabase } from "../src/career/request-scope.ts";
import { createCareerSportingService } from "../src/career/sporting/service.ts";
const pg = createRequire(new URL("../../../lib/db/package.json", import.meta.url))("pg") as typeof import("pg");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = readRetryingCareerDatabase(drizzle(pool) as never);
const s = createCareerSportingService(db);
const playerId = Number(process.argv[2]);
const id = String((await db.execute(sql`SELECT id FROM career_saves WHERE player_id=${playerId} ORDER BY created_at DESC LIMIT 1`)).rows[0].id);
const q = JSON.parse(process.argv[3] ?? '{"scope":"RELEVANT","fromWeek":1,"toWeek":12}');
for (let i = 0; i < 15; i++) { const t = performance.now(); await s.calendar.calendar({ playerId, isAdmin: false }, id, q); if (i > 11) console.log(Math.round(performance.now() - t), "ms"); }
await pool.end();
