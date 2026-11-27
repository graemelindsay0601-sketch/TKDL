// Scratch: for a save, how many members each club in the human's darts nation has free on each team night so far.
import { sql } from "drizzle-orm";
import { createRequire } from "node:module";
import { drizzle } from "drizzle-orm/node-postgres";
import { loadNpcs } from "../src/career/world/repository.ts";
import { LOCALITIES, localityByRegion } from "../src/career/calendar/geography.ts";
import { dartsNation } from "../src/career/calendar/pairs.ts";
import { teamNightDay } from "../src/career/club/teams.ts";
const pg = createRequire(new URL("../../../lib/db/package.json", import.meta.url))("pg") as typeof import("pg");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL }); const db = drizzle(pool) as any;
const playerId = Number(process.argv[2]);
const save = (await db.execute(sql`SELECT id, current_week FROM career_saves WHERE player_id=${playerId} ORDER BY created_at DESC LIMIT 1`)).rows[0];
const home = LOCALITIES.find(l => l.key === "ayrshire")!; const nation = dartsNation(home.country, home.key);
const clubs = LOCALITIES.filter(l => l.country === home.country && dartsNation(l.country, l.key) === nation).map(l => l.key);
const npcs = await loadNpcs(db, save.id, { activeOnly: true, nationality: home.country });
const clubOf = (n: any) => localityByRegion(n.homeRegion)?.key ?? null;
for (let w = 4; w < Number(save.current_week); w++) {
  const busy = new Set((await db.execute(sql`SELECT DISTINCT participant_key FROM career_participant_bookings WHERE career_save_id=${save.id} AND season=1 AND day=${teamNightDay(w)}`)).rows.map((r: any) => String(r.participant_key)));
  const line = clubs.map(c => { const m = npcs.filter(n => clubOf(n) === c); const free = m.filter(n => !busy.has(n.id)).length; return `${c}:${free}/${m.length}`; });
  console.log(`week ${w}: ${line.join("  ")}`);
}
await pool.end();
