import { sql } from "drizzle-orm";
import { createRequire } from "node:module";
import { brotliCompressSync } from "node:zlib";
import { drizzle } from "drizzle-orm/node-postgres";
import { readRetryingCareerDatabase } from "../src/career/request-scope.ts";
import { createCareerSportingService } from "../src/career/sporting/service.ts";
import { listEvent } from "../src/career/calendar/service.ts";
const pg = createRequire(new URL("../../../lib/db/package.json", import.meta.url))("pg") as typeof import("pg");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = readRetryingCareerDatabase(drizzle(pool) as never);
const s = createCareerSportingService(db);
const playerId = Number(process.argv[2]);
const id = String((await db.execute(sql`SELECT id FROM career_saves WHERE player_id=${playerId} ORDER BY created_at DESC LIMIT 1`)).rows[0].id);
const q = JSON.parse(process.argv[3]);
let ms = 0, kb = 0, n = 0;
for (let i = 0; i < 6; i++) { const t = performance.now(); const c = await s.calendar.calendar({ playerId, isAdmin: false }, id, q) as any; const out = { ...c, events: c.events.map(listEvent) };
  if (i >= 2) { ms += performance.now() - t; kb = brotliCompressSync(JSON.stringify(out)).length / 1024; n = c.events.length; } }
console.log(`${Math.round(ms / 4)} ms, ${n} events, ${kb.toFixed(0)} KB br  ${process.argv[3]}`);
await pool.end();
