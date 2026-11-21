// Scratch profiler (not committed): times each "Play on" (NEXT_MEANINGFUL advance, human enters nothing) on a fresh
// save and attributes database time by statement.
import { sql } from "drizzle-orm";
import { createRequire } from "node:module";
import { drizzle } from "drizzle-orm/node-postgres";
import { readRetryingCareerDatabase } from "../src/career/request-scope.ts";
import { createCareerService } from "../src/career/service.ts";
import { createCareerSportingService } from "../src/career/sporting/service.ts";

const pg = createRequire(new URL("../../../lib/db/package.json", import.meta.url))("pg") as typeof import("pg");
const stats = new Map<string, { n: number; ms: number }>(); let dbMs = 0, dbN = 0, sent = 0;
const origQuery = pg.Client.prototype.query;
(pg.Client.prototype as any).query = function (...args: any[]) {
  const text = typeof args[0] === "string" ? args[0] : args[0]?.text ?? "?";
  const key = String(text).replace(/\s+/g, " ").slice(0, 90);
  const values = typeof args[0] === "string" ? args[1] : args[0]?.values; sent += Buffer.byteLength(String(text)) + (values ? Buffer.byteLength(JSON.stringify(values)) : 0);
  const t = performance.now();
  const r = origQuery.apply(this, args as never);
  if (r && typeof (r as Promise<unknown>).then === "function") (r as Promise<unknown>).finally(() => {
    const ms = performance.now() - t; dbMs += ms; dbN++; const s = stats.get(key) ?? { n: 0, ms: 0 }; s.n++; s.ms += ms; stats.set(key, s); }).catch(() => {});
  return r;
};
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = readRetryingCareerDatabase(drizzle(pool) as never);
const saves = createCareerService(db), sporting = createCareerSportingService(db);
const playerId = Number(process.argv[2] ?? 5), weeks = Number(process.argv[3] ?? 6);
const actor = { playerId, isAdmin: false };
await db.execute(sql`DELETE FROM career_saves WHERE player_id = ${playerId}`);
const save = await saves.create(playerId, { slot: 1, careerName: "Profile", dateOfBirth: "1998-04-02", homeLocality: "ayrshire" });
let t = performance.now();
await sporting.initialize(actor, save.id);
console.log(`initialize ${Math.round(performance.now() - t)}ms`);
for (let i = 0; i < weeks; i++) {
  const now = await saves.read(playerId, save.id);
  stats.clear(); dbMs = 0; dbN = 0; sent = 0; t = performance.now();
  const r = await sporting.calendar.advance(actor, save.id, { operationKey: `profile-${save.id}-${i}`, expectedSeason: now.currentSeason, expectedWeek: now.currentWeek, target: { kind: "NEXT_MEANINGFUL" } }) as any;
  const total = performance.now() - t;
  const T=(globalThis as any).__zzT as Map<string,number>|undefined; if (T) { console.log('   phases', JSON.stringify(Object.fromEntries([...T].map(([k,v])=>[k,Math.round(v)])))); T.clear(); }
  console.log(`advance from w${now.currentWeek} → ${JSON.stringify(r.to)} ${r.stop?.reason}: ${Math.round(total)}ms total, db ${Math.round(dbMs)}ms in ${dbN} queries, sent to DB ${(sent/1048576).toFixed(2)} MB`);
  if (i === weeks - 1 || process.env.ALL) for (const [k, v] of [...stats].sort((a, b) => (process.env.BYN ? b[1].n - a[1].n : b[1].ms - a[1].ms)).slice(0, 25)) console.log(`   ${Math.round(v.ms)}ms ×${v.n}  ${k}`);
}
await pool.end();
