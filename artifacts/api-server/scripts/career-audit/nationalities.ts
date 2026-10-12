/** DEV-ONLY: active NPCs by nationality in a fresh world (pool sizes that regional events draw on). */
import { sql } from "drizzle-orm";
import { auditDatabase } from "./db.ts";
const a = await auditDatabase();
const s = await a.saves.create(1, { slot: 1, careerName: "Nat", dateOfBirth: "2000-06-15", homeLocality: "ayrshire" });
await a.career.initialize(a.actor, s.id);
const r = await a.rows(sql`SELECT nationality, COUNT(*)::int n, COUNT(*) FILTER (WHERE tier IN ('GRASSROOTS','AMATEUR'))::int am, COUNT(*) FILTER (WHERE professional_status='AMATEUR')::int amstatus
  FROM career_world_players WHERE career_save_id=${s.id} AND status='ACTIVE' GROUP BY 1 ORDER BY 2 DESC`);
console.log(r.map(x => `${x.nationality}:${x.n}(am ${x.amstatus})`).join(" "));
await a.pg.close();
