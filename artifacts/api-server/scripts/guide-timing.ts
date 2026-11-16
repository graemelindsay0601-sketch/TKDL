/** Times the Career Guide read for a save (dev tool): node scripts/guide-timing.ts <playerId> <saveId> [runs] */
import { createRequire } from "node:module";
import { drizzle } from "drizzle-orm/node-postgres";
import { readRetryingCareerDatabase } from "../src/career/request-scope.ts";
import { createCareerSportingService } from "../src/career/sporting/service.ts";
import { createCareerGoalsService } from "../src/career/goals/service.ts";
import { createCareerStreamingService } from "../src/career/streaming/service.ts";
import { createCareerMoneyService } from "../src/career/money/service.ts";
import { createCareerGuideService } from "../src/career/guide/service.ts";

const [playerId, saveId, runs = "4"] = process.argv.slice(2);
const pg = createRequire(new URL("../../../lib/db/package.json", import.meta.url))("pg") as typeof import("pg");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = readRetryingCareerDatabase(drizzle(pool) as never);
const sporting = createCareerSportingService(db), goals = createCareerGoalsService(db);
const guide = createCareerGuideService(db, { calendar: sporting.calendar, goals, sponsors: sporting.finance, streaming: createCareerStreamingService(db), money: createCareerMoneyService(db) });
const actor = { playerId: Number(playerId), isAdmin: false };
for (let i = 0; i < Number(runs); i++) {
  const t = performance.now(); const g = await guide.read(actor, saveId);
  console.log(`guide ${(performance.now() - t).toFixed(0)} ms · path ${g.path.label} · steps ${g.nextSteps.map(s => s.key.split(":")[0]).join(",")}`);
}
await pool.end();
