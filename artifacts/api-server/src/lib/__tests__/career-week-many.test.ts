/** A week is not one event: the human can play a Tuesday night, a Friday night and a Saturday open in the same week. */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { createCareerSaves } from "../../db/migrations/create_career_saves.ts";
import { createCareerWorld } from "../../db/migrations/create_career_world.ts";
import { createCareerSponsorshipFoundation } from "../../db/migrations/create_career_sponsorship_foundation.ts";
import { createCareerNpcSponsorMarketSPF } from "../../db/migrations/create_career_npc_sponsor_market_spf.ts";
import { createCareerCalendar } from "../../db/migrations/create_career_calendar.ts";
import { createCareerFinance } from "../../db/migrations/create_career_finance.ts";
import { createCareerSponsorJourneysSPB } from "../../db/migrations/create_career_sponsor_journeys_spb.ts";
import { createCareerSponsorJourneysSPB3 } from "../../db/migrations/create_career_sponsor_journeys_spb3.ts";
import { createCareerFinanceSPC } from "../../db/migrations/create_career_finance_spc.ts";
import { createCareerSponsorHQSPD } from "../../db/migrations/create_career_sponsor_hq_spd.ts";
import { createCareerSponsorContractActionsSPE2 } from "../../db/migrations/create_career_sponsor_contract_actions_spe2.ts";
import { createCareerSporting } from "../../db/migrations/create_career_sporting.ts";
import { createShadowObservations } from "../../db/migrations/create_shadow_observations_sb21a.ts";
import { repairCareerSchema } from "../../db/migrations/repair_career_schema.ts";
import { createCareerService } from "../../career/service.ts";
import { createCareerSportingService } from "../../career/sporting/service.ts";

const pg = new PGlite(), db = drizzle(pg);
const saves = createCareerService(db), career = createCareerSportingService(db);
const actor = { playerId: 1 };
let id = "", op = 0;

before(async () => {
  await pg.exec(`CREATE TABLE players (id INTEGER PRIMARY KEY); INSERT INTO players VALUES (1);
    CREATE TABLE feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);
    INSERT INTO feature_flags VALUES ('tour_career_2', true, false, 'test')`);
  for (const m of [createCareerSaves, createCareerWorld, createCareerSponsorshipFoundation, createCareerNpcSponsorMarketSPF, createCareerCalendar, createCareerFinance,
    createCareerSponsorJourneysSPB, createCareerSponsorJourneysSPB3, createCareerFinanceSPC, createCareerSponsorHQSPD, createCareerSponsorContractActionsSPE2, createCareerSporting, createShadowObservations]) await m(db);
  await repairCareerSchema(db);
  id = (await saves.create(1, { slot: 1, careerName: "Busy week", dateOfBirth: "1996-06-15" })).id;
  await career.initialize(actor, id);
  await db.execute(sql`UPDATE career_saves SET balance_pence = 50000 WHERE id = ${id}`);
});
after(async () => { await pg.close(); });

test("the human enters events on three different days of one week and plays them all", async () => {
  const events = ((await career.calendar.calendar(actor, id, { scope: "AVAILABLE" })).events as any[])
    .filter(e => e.capability.executable && e.human?.canEnter && !e.series && e.dates.startDay === e.dates.endDay && e.finance?.travelBand === "LOCAL" && e.series == null);
  const byWeek = new Map<number, any[]>();
  for (const e of events) byWeek.set(e.dates.startWeek, [...(byWeek.get(e.dates.startWeek) ?? []), e]);
  const week = [...byWeek].map(([w, list]) => [w, [...new Map(list.map(e => [e.dates.startDay, e])).values()]] as const)
    .filter(([, list]) => list.length >= 2).sort((a, b) => b[1].length - a[1].length || a[0] - b[0])[0];
  assert.ok(week, "some week offers events on at least two different days");
  const picked = week[1].slice(0, 3);
  for (const e of picked) {
    const r = await career.calendar.enter(actor, id, { eventId: e.id });
    assert.equal(r.entered, true, `${e.name} (day ${e.dates.startDay}): ${r.denials?.join(",")}`);
  }
  for (let i = 0; i < 80; i++) {
    const done = (await db.execute(sql`SELECT COUNT(*)::int AS n FROM career_event_results WHERE career_save_id=${id} AND participant_key='HUMAN'
      AND event_id IN (${sql.join(picked.map(e => sql`${e.id}::uuid`), sql`,`)})`)).rows[0].n;
    if (Number(done) === picked.length) return;
    const s = await saves.read(1, id);
    const r = await career.calendar.advance(actor, id, { operationKey: `busy-week-${++op}`, expectedSeason: s.currentSeason, expectedWeek: s.currentWeek, target: { kind: "NEXT_MEANINGFUL" } }) as any;
    if (r.stop.reason === "HUMAN_MATCH_PENDING") for (const matchId of r.stop.detail.matchIds) {
      const eventId = String((await db.execute(sql`SELECT event_id FROM career_tournament_matches WHERE career_save_id=${id} AND id=${matchId}`)).rows[0].event_id);
      await career.calendar.quickSimMatch(actor, id, eventId, { matchId, confirmation: "QUICK_SIM" });
    }
    assert.ok((await saves.read(1, id)).currentWeek <= week[0] + 1, `still in week ${week[0]} (stop: ${r.stop.reason})`);
  }
  assert.fail("not every entered event was played");
});

test("Home's RELEVANT scope keeps every event you can enter or are booked into, and drops the rest of the world", async () => {
  const q = { fromWeek: 1, toWeek: 52 };
  const ids = async (scope: string) => new Set(((await career.calendar.calendar(actor, id, { ...q, scope })).events as any[]).map(e => e.id));
  const [world, relevant, available, mine] = await Promise.all(["WORLD", "RELEVANT", "AVAILABLE", "MY_SCHEDULE"].map(ids));
  assert.ok(mine.size > 0 && available.size > 0);
  for (const e of [...available, ...mine]) assert.ok(relevant.has(e), "kept");
  for (const e of relevant) assert.ok(world.has(e));
  assert.ok(relevant.size < world.size, `${relevant.size} of ${world.size}`);
});
