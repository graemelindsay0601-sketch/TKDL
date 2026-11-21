// Scratch (not committed): DB round trips, DB time and JSON size per Career read, for an existing save.
import { sql } from "drizzle-orm";
import { createRequire } from "node:module";
import { brotliCompressSync } from "node:zlib";
import { drizzle } from "drizzle-orm/node-postgres";
import { readRetryingCareerDatabase } from "../src/career/request-scope.ts";
import { createCareerSportingService } from "../src/career/sporting/service.ts";
import { createCareerGoalsService } from "../src/career/goals/service.ts";
import { createCareerStreamingService } from "../src/career/streaming/service.ts";
import { createCareerMoneyService } from "../src/career/money/service.ts";
import { createCareerGuideService } from "../src/career/guide/service.ts";
import { createCareerInboxService } from "../src/career/inbox/service.ts";
const pg = createRequire(new URL("../../../lib/db/package.json", import.meta.url))("pg") as typeof import("pg");
let n = 0; const keys = new Map<string, number>();
const orig = pg.Client.prototype.query;
(pg.Client.prototype as any).query = function (...a: any[]) { n++; const t = typeof a[0] === "string" ? a[0] : a[0]?.text ?? "?"; const k = String(t).replace(/\s+/g, " ").slice(0, 80); keys.set(k, (keys.get(k) ?? 0) + 1); return orig.apply(this, a as never); };
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = readRetryingCareerDatabase(drizzle(pool) as never);
const sporting = createCareerSportingService(db), goals = createCareerGoalsService(db), streaming = createCareerStreamingService(db), money = createCareerMoneyService(db);
const guide = createCareerGuideService(db, { calendar: sporting.calendar, goals, sponsors: sporting.finance, streaming, money });
const inbox = createCareerInboxService(db, { calendar: sporting.calendar, streaming, money, sponsors: sporting.finance });
const playerId = Number(process.argv[2]);
const id = String((await db.execute(sql`SELECT id FROM career_saves WHERE player_id=${playerId} ORDER BY created_at DESC LIMIT 1`)).rows[0].id);
const actor = { playerId, isAdmin: false };
const show = async (name: string, f: () => Promise<unknown>) => {
  await f().catch(() => {}); // warm
  n = 0; keys.clear(); const t = performance.now();
  try { const j = JSON.stringify(await f()); const ms = performance.now() - t;
    console.log(`${String(n).padStart(5)} queries ${String(Math.round(ms)).padStart(6)} ms ${String((brotliCompressSync(j).length/1024).toFixed(0)).padStart(5)} KB br  ${name}`);
    if (process.env.TOP) for (const [k, v] of [...keys].sort((a, b) => b[1] - a[1]).slice(0, 6)) console.log(`         ×${v} ${k}`);
  } catch (e) { console.log(`ERR ${name}: ${(e as Error).message.slice(0, 120)}`); }
};
await show("guide", () => guide.read(actor, id));
await show("calendar overview", () => sporting.calendar.calendar(actor, id, {}, { overview: true }));
await show("calendar glance", () => sporting.calendar.glance(actor, id));
await show("calendar RELEVANT 10wk", () => sporting.calendar.calendar(actor, id, { scope: "RELEVANT", fromWeek: 1, toWeek: 12 }));
await show("calendar WORLD season", () => sporting.calendar.calendar(actor, id, { scope: "WORLD" }));
await show("inbox", () => inbox.read(actor, id));
await show("money", () => money.read(actor, id));
await show("goals", () => goals.read(actor, id));
await show("streaming", () => streaming.read(actor, id));
await show("sponsors", () => sporting.finance.sponsors(actor, id));
await pool.end();
