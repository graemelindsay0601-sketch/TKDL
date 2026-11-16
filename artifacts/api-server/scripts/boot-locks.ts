/** Dev tool: which tables does the every-boot schema repair lock exclusively on an up-to-date database? Rolls back. */
import { createRequire } from "node:module";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { repairCareerSchema } from "../src/db/migrations/repair_career_schema.ts";

const pg = createRequire(new URL("../../../lib/db/package.json", import.meta.url))("pg") as typeof import("pg");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);
class Rollback extends Error {}
let locks: string[] = [];
const probe = { transaction: (fn: (tx: unknown) => Promise<unknown>) => db.transaction(async tx => {
  await fn(tx);
  locks = (await tx.execute(sql`SELECT relation::regclass::text AS rel FROM pg_locks WHERE pid = pg_backend_pid() AND mode = 'AccessExclusiveLock' AND relation IS NOT NULL ORDER BY 1`)).rows.map(r => String(r.rel));
  throw new Rollback();
}).catch(e => { if (!(e instanceof Rollback)) throw e; }) };
const t = performance.now();
await repairCareerSchema(probe as never);
console.log(`repairCareerSchema: ${(performance.now() - t).toFixed(0)} ms, exclusive locks on ${locks.length} relation(s)`);
for (const l of [...new Set(locks)]) console.log("  " + l);
await pool.end();
