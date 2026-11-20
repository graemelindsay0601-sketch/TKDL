import { sql } from "drizzle-orm";
import { createRequire } from "node:module";
import { drizzle } from "drizzle-orm/node-postgres";
import { readRetryingCareerDatabase } from "../src/career/request-scope.ts";
import { createCareerGoalsService } from "../src/career/goals/service.ts";
const pg = createRequire(new URL("../../../lib/db/package.json", import.meta.url))("pg") as typeof import("pg");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = readRetryingCareerDatabase(drizzle(pool) as never);
const goals = createCareerGoalsService(db);
const playerId = Number(process.argv[2]);
const id = String((await db.execute(sql`SELECT id FROM career_saves WHERE player_id=${playerId} ORDER BY created_at DESC LIMIT 1`)).rows[0].id);
for (let i = 0; i < 12; i++) { const t = performance.now(); await goals.read({ playerId, isAdmin: false }, id); console.log(Math.round(performance.now() - t), "ms"); }
await pool.end();
