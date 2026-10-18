/** Career reminders: a nudge for a Career left a few days with something waiting; never for nothing, never forever. */
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
import { findCareerReminders, REMINDER } from "../../career/reminders.ts";

const pg = new PGlite(), db = drizzle(pg);
const saves = createCareerService(db), career = createCareerSportingService(db);
const actor = { playerId: 1 };
let id = "";
const away = (days: number) => db.execute(sql`UPDATE career_saves SET updated_at = NOW() - make_interval(days => ${days}) WHERE id = ${id}`);
const mine = async () => (await db.transaction(tx => findCareerReminders(tx))).filter(r => r.saveId === id);

before(async () => {
  await pg.exec(`CREATE TABLE players (id INTEGER PRIMARY KEY); INSERT INTO players VALUES (1);
    CREATE TABLE feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);
    INSERT INTO feature_flags VALUES ('tour_career_2', true, false, 'test')`);
  for (const m of [createCareerSaves, createCareerWorld, createCareerSponsorshipFoundation, createCareerNpcSponsorMarketSPF, createCareerCalendar, createCareerFinance,
    createCareerSponsorJourneysSPB, createCareerSponsorJourneysSPB3, createCareerFinanceSPC, createCareerSponsorHQSPD, createCareerSponsorContractActionsSPE2, createCareerSporting, createShadowObservations]) await m(db);
  await repairCareerSchema(db);
  id = (await saves.create(1, { slot: 1, careerName: "Away", dateOfBirth: "1995-03-02", homeLocality: "ayrshire" })).id;
  await career.initialize(actor, id);
  await db.execute(sql`UPDATE career_saves SET balance_pence = 100000 WHERE id = ${id}`);
});
after(async () => { await pg.close(); });

test("nothing waiting, no reminder; a booked event after a few days away, one reminder that opens the Career", async () => {
  await db.execute(sql`DELETE FROM career_sponsor_offers WHERE career_save_id = ${id}`);
  await away(REMINDER.afterDays + 1);
  assert.deepEqual(await mine(), [], "nothing to come back for");
  const cal = await career.calendar.calendar(actor, id, { scope: "AVAILABLE", fromWeek: 1, toWeek: 6 });
  const event = cal.events.find(e => e.human?.canEnter);
  assert.ok(event, "an event to enter");
  assert.equal((await career.calendar.enter(actor, id, { eventId: event!.id })).entered, true);
  await away(REMINDER.afterDays + 1);
  const [r] = await mine();
  assert.ok(r, "reminded");
  assert.match(r.body, new RegExp(`booked into ${event!.name.replace(/[()]/g, ".")}`));
  assert.equal(r.url, `/career/${id}/play`);
  assert.equal(r.playerId, 1);
  const again = await mine();
  assert.equal(again[0].dedupeKey, r.dedupeKey, "the same absence has the same key, so it is sent once");
});

test("not after a day, not after a month, never for a retired Career", async () => {
  await away(1);
  assert.deepEqual(await mine(), []);
  await away(REMINDER.giveUpAfterDays + 1);
  assert.deepEqual(await mine(), []);
  await away(REMINDER.afterDays + 1);
  await db.execute(sql`UPDATE career_saves SET status = 'RETIRED', retired_at = NOW() WHERE id = ${id}`);
  assert.deepEqual(await mine(), []);
});
