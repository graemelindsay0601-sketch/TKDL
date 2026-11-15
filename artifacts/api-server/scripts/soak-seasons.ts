// Not part of the test suite (no .test.ts): a season soak across many world seeds, run by hand:
//   node scripts/soak-seasons.ts <careers> <seasons>
// Every failure prints the real database error (constraint, detail), so random-path bugs (a tie that needs a bull-off,
// a champion who dropped a group game) surface across seeds instead of once in a while in CI.
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { createCareerSaves } from "../src/db/migrations/create_career_saves.ts";
import { createCareerWorld } from "../src/db/migrations/create_career_world.ts";
import { createCareerSponsorshipFoundation } from "../src/db/migrations/create_career_sponsorship_foundation.ts";
import { createCareerNpcSponsorMarketSPF } from "../src/db/migrations/create_career_npc_sponsor_market_spf.ts";
import { createCareerCalendar } from "../src/db/migrations/create_career_calendar.ts";
import { createCareerFinance } from "../src/db/migrations/create_career_finance.ts";
import { createCareerSponsorJourneysSPB } from "../src/db/migrations/create_career_sponsor_journeys_spb.ts";
import { createCareerSponsorJourneysSPB3 } from "../src/db/migrations/create_career_sponsor_journeys_spb3.ts";
import { createCareerFinanceSPC } from "../src/db/migrations/create_career_finance_spc.ts";
import { createCareerSponsorHQSPD } from "../src/db/migrations/create_career_sponsor_hq_spd.ts";
import { createCareerSponsorContractActionsSPE2 } from "../src/db/migrations/create_career_sponsor_contract_actions_spe2.ts";
import { createCareerSporting } from "../src/db/migrations/create_career_sporting.ts";
import { createShadowObservations } from "../src/db/migrations/create_shadow_observations_sb21a.ts";
import { repairCareerSchema, syncCareerEventDefinitions } from "../src/db/migrations/repair_career_schema.ts";
import { createCareerService } from "../src/career/service.ts";
import { createCareerSportingService } from "../src/career/sporting/service.ts";
import { createCareerFinanceService } from "../src/career/finance/service.ts";

const careers = Number(process.argv[2] ?? 4), seasons = Number(process.argv[3] ?? 1);
const pg = new PGlite(), db = drizzle(pg);
const saves = createCareerService(db), sporting = createCareerSportingService(db), finance = createCareerFinanceService(db);
const actor = { playerId: 1 };
await pg.exec(`CREATE TABLE players (id INTEGER PRIMARY KEY); INSERT INTO players VALUES (1);
  CREATE TABLE feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);
  INSERT INTO feature_flags VALUES ('tour_career_2', true, false, 'test')`);
for (const m of [createCareerSaves, createCareerWorld, createCareerSponsorshipFoundation, createCareerNpcSponsorMarketSPF, createCareerCalendar, createCareerFinance,
  createCareerSponsorJourneysSPB, createCareerSponsorJourneysSPB3, createCareerFinanceSPC, createCareerSponsorHQSPD, createCareerSponsorContractActionsSPE2, createCareerSporting, createShadowObservations]) await m(db);
await repairCareerSchema(db); await syncCareerEventDefinitions(db);

const why = (e: unknown) => { const c = (e as { cause?: Record<string, unknown> }).cause ?? {};
  return `${String((e as Error).message).split("\n")[0].slice(0, 120)} | ${c.message ?? ""} ${c.constraint ? `[${c.constraint}]` : ""} ${c.detail ?? ""}`.trim(); };
const failures: string[] = [], stops = new Map<string, number>();
for (let n = 0; n < careers; n++) {
  await pg.exec("DELETE FROM career_saves");
  const save = await saves.create(1, { slot: 1, careerName: `Soak${n}`, dateOfBirth: "1995-05-05", homeLocality: "ayrshire" });
  await sporting.initialize(actor, save.id);
  let steps = 0, matches = 0, wins = 0, entries = 0;
  const t0 = Date.now();
  try {
    for (; steps < 400; steps++) {
      const root = await saves.read(1, save.id);
      if (root.currentSeason > seasons) break;
      // Enter what's open (a couple at a time), so the human plays real matches too.
      if (steps % 2 === 0) {
        const cal = await finance.calendar.calendar(actor, save.id, { scope: "AVAILABLE" }, { overview: false }) as { events: { id: string; human?: { canEnter?: boolean } }[] };
        let entered = 0;
        for (const e of cal.events) { if (entered >= 2) break; if (!e.human?.canEnter) continue;
          const out = await finance.calendar.enter(actor, save.id, { eventId: e.id }) as { entered: boolean }; if (out.entered) { entered++; entries++; } }
      }
      const r = await finance.calendar.advance(actor, save.id, { operationKey: `soak-${n}-${steps}`, expectedSeason: root.currentSeason, expectedWeek: root.currentWeek,
        target: { kind: "WEEKS", weeks: 1 } }) as { stop: { reason: string; detail?: { matchIds?: string[] } } };
      stops.set(r.stop.reason, (stops.get(r.stop.reason) ?? 0) + 1);
      if (r.stop.reason === "HUMAN_MATCH_PENDING") for (const matchId of r.stop.detail?.matchIds ?? []) {
        const m = (await db.execute(sql`SELECT best_of FROM career_tournament_matches WHERE career_save_id=${save.id} AND id=${matchId}`)).rows[0];
        const target = (Number(m.best_of) + 1) / 2, win = (steps + matches + n) % 3 !== 0;
        matches++; if (win) wins++;
        await finance.calendar.recordHumanMatchResult(actor, save.id, { matchId, humanLegs: win ? target : target - 1, opponentLegs: win ? target - 1 : target, humanThrewFirst: matches % 2 === 0 });
      } else if (!["TARGET_REACHED", "MEANINGFUL_DATE", "SEASON_BOUNDARY", "LIMIT"].includes(r.stop.reason)) {
        failures.push(`career ${n}: stuck on ${r.stop.reason} at S${root.currentSeason} W${root.currentWeek}`); break;
      }
    }
  } catch (e) {
    const root = await saves.read(1, save.id).catch(() => null);
    failures.push(`career ${n}: S${root?.currentSeason} W${root?.currentWeek}: ${why(e)}`);
  }
  const root = await saves.read(1, save.id);
  console.log(`career ${n}: reached S${root.currentSeason} W${root.currentWeek} in ${steps} steps, ${entries} entries, ${matches} matches (${wins} won), ${Math.round((Date.now() - t0) / 1000)}s`);
}
console.log("stops:", JSON.stringify(Object.fromEntries(stops)));
console.log(failures.length ? `FAILURES (${failures.length}):\n${failures.join("\n")}` : "NO FAILURES");
await pg.close();
