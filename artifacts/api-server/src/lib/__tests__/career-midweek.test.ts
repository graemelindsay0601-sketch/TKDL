/** The v15 midweek pub circuit: Monday League and Wednesday Flier nights, for new Careers and added to existing ones. */
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
import { ensureSeason, type RootRow } from "../../career/calendar/engine.ts";
import { MIDWEEK_KEYS } from "../../career/content/season-v15.ts";
import { LOCALITIES } from "../../career/calendar/geography.ts";

const pg = new PGlite(), db = drizzle(pg);
const saves = createCareerService(db), career = createCareerSportingService(db);
const actor = { playerId: 1 };


before(async () => {
  await pg.exec(`CREATE TABLE players (id INTEGER PRIMARY KEY); INSERT INTO players VALUES (1);
    CREATE TABLE feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);
    INSERT INTO feature_flags VALUES ('tour_career_2', true, false, 'test')`);
  for (const m of [createCareerSaves, createCareerWorld, createCareerSponsorshipFoundation, createCareerNpcSponsorMarketSPF, createCareerCalendar, createCareerFinance,
    createCareerSponsorJourneysSPB, createCareerSponsorJourneysSPB3, createCareerFinanceSPC, createCareerSponsorHQSPD, createCareerSponsorContractActionsSPE2, createCareerSporting, createShadowObservations]) await m(db);
  await repairCareerSchema(db);
});
after(async () => { await pg.close(); });

const midweek = async (saveId: string, season = 1) => (await db.execute(sql`SELECT definition_key, start_week, ((start_day - 1) % 7) + 1 AS dow, locality_key, event_database_version, status
  FROM career_event_instances WHERE career_save_id = ${saveId} AND season = ${season} AND definition_key IN ('monday-league-night', 'wednesday-flier') ORDER BY start_day`)).rows as any[];
async function newSave(slot: number, version?: number) {
  const id = (await saves.create(1, { slot, careerName: `Midweek ${slot}`, dateOfBirth: "1996-06-15" })).id;
  if (version) await db.execute(sql`UPDATE career_saves SET event_database_version = ${version} WHERE id = ${id}`);
  await career.initialize(actor, id);
  return id;
}

test("a new Career has a Monday League and a Wednesday Flier at home every other week, local and cheap", async () => {
  const id = await newSave(1);
  const home = (await midweek(id)).filter(r => r.locality_key === "ayrshire");
  for (const key of MIDWEEK_KEYS) {
    const weeks = home.filter(r => r.definition_key === key).map(r => Number(r.start_week));
    assert.ok(weeks.length >= 25 && weeks.length <= 26, `${key}: every other week (${weeks.length})`);
    assert.ok(weeks.every((w, i) => i === 0 || w - weeks[i - 1] === 2));
    assert.deepEqual([...new Set(home.filter(r => r.definition_key === key).map(r => Number(r.dow)))], [key === "monday-league-night" ? 1 : 3]);
  }
  assert.ok((await midweek(id)).every(r => ["GBR", "IRL"].includes(LOCALITIES.find(l => l.key === r.locality_key)!.country)), "UK and Ireland home areas only");
  const events = ((await career.calendar.calendar(actor, id, { scope: "AVAILABLE" })).events as any[]).filter(e => (MIDWEEK_KEYS as readonly string[]).includes(e.definitionKey) && e.venue.localityKey === "ayrshire");
  const monday = events.find(e => e.definitionKey === "monday-league-night"), flier = events.find(e => e.definitionKey === "wednesday-flier");
  assert.ok(monday?.human?.canEnter && flier?.human?.canEnter, "the human can enter both");
  assert.deepEqual([monday.finance.travelBand, monday.finance.entryFeePence, monday.finance.topPrizePence], ["LOCAL", 200, 2000]);
  assert.deepEqual([flier.finance.travelBand, flier.finance.entryFeePence, flier.finance.topPrizePence], ["LOCAL", 300, 3000]);
});

test("an existing Career on an older edition gets the circuit from next week on, once, and in full from next season", async () => {
  const id = await newSave(2, 14);
  // A live save: its season was made before v15 existed, and it is ten weeks in.
  await db.execute(sql`DELETE FROM career_event_instances WHERE career_save_id = ${id} AND definition_key IN ('monday-league-night', 'wednesday-flier')`);
  await db.execute(sql`DELETE FROM career_calendar_addons WHERE career_save_id = ${id}`);
  await db.execute(sql`UPDATE career_saves SET current_week = 10 WHERE id = ${id}`);
  const before = Number((await db.execute(sql`SELECT COUNT(*)::int AS n FROM career_event_instances WHERE career_save_id = ${id}`)).rows[0].n);
  await career.calendar.calendar(actor, id, {});
  const added = await midweek(id);
  assert.ok(added.length > 0 && added.every(r => Number(r.start_week) >= 11), "only weeks still ahead");
  assert.ok(added.every(r => Number(r.event_database_version) === 15));
  assert.ok(added.some(r => r.status === "REGISTRATION_OPEN"), "nights within the entry window open straight away");
  await career.calendar.calendar(actor, id, {});
  assert.equal((await midweek(id)).length, added.length, "added once");
  const after = Number((await db.execute(sql`SELECT COUNT(*)::int AS n FROM career_event_instances WHERE career_save_id = ${id}`)).rows[0].n);
  assert.equal(after - before, added.length, "nothing else in the season changes");
  const root = (await db.execute(sql`SELECT * FROM career_saves WHERE id = ${id}`)).rows[0] as RootRow;
  await db.transaction(tx => ensureSeason(tx, root, 2));
  const next = await midweek(id, 2);
  assert.ok(next.some(r => Number(r.start_week) <= 2) && next.length > added.length, "the next season has the circuit all year");
  assert.equal(Number((await db.execute(sql`SELECT event_database_version FROM career_saves WHERE id = ${id}`)).rows[0].event_database_version), 14, "the save keeps its edition");
});
