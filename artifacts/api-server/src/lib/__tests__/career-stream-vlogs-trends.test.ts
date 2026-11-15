/** Tour vlogs from the road, and algorithm shifts that favour a show for six weeks. */
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
import { createCareerStreamingService } from "../../career/streaming/service.ts";
import { settleStreamingWeek } from "../../career/streaming/state.ts";

const pg = new PGlite(), db = drizzle(pg);
const saves = createCareerService(db), career = createCareerSportingService(db), streaming = createCareerStreamingService(db);
const actor = { playerId: 1 };
let id = "";
const SEED = "a".repeat(64);
const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rows;
const status = (p: Promise<unknown>, n = 409) => assert.rejects(p, (e: { status?: number }) => e.status === n);

before(async () => {
  await pg.exec(`CREATE TABLE players (id INTEGER PRIMARY KEY); INSERT INTO players VALUES (1);
    CREATE TABLE feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);
    INSERT INTO feature_flags VALUES ('tour_career_2', true, false, 'test')`);
  for (const m of [createCareerSaves, createCareerWorld, createCareerSponsorshipFoundation, createCareerNpcSponsorMarketSPF, createCareerCalendar, createCareerFinance,
    createCareerSponsorJourneysSPB, createCareerSponsorJourneysSPB3, createCareerFinanceSPC, createCareerSponsorHQSPD, createCareerSponsorContractActionsSPE2, createCareerSporting, createShadowObservations]) await m(db);
  await repairCareerSchema(db);
  id = (await saves.create(1, { slot: 1, careerName: "Vlogs", dateOfBirth: "1998-03-02", homeLocality: "ayrshire" })).id;
  await career.initialize(actor, id);
});
after(async () => { await pg.close(); });

import { TREND, trendBonus, trendFor } from "../../career/streaming/model.ts";
import { vlogOutcome } from "../../career/streaming/content.ts";

test("trends: six-week blocks, never the same show twice running; vlogs grow with audience, event size and an editor", () => {
  for (let season = 1; season <= 5; season++) for (let w = 7; w <= 52; w += 6) {
    const a = trendFor(SEED, season, w - 6), b = trendFor(SEED, season, w);
    assert.notEqual(a.format, b.format); assert.ok(TREND.formats.includes(b.format));
  }
  assert.equal(trendFor(SEED, 1, 1).endsWeek, 6); assert.equal(trendFor(SEED, 1, 6).format, trendFor(SEED, 1, 1).format);
  assert.equal(trendBonus("KING", { format: "KING" }), TREND.bonus); assert.equal(trendBonus("KING", { format: "SCORING" }), 1);
  assert.ok(vlogOutcome(SEED, "k", 50_000, "WORLD", false).views > vlogOutcome(SEED, "k", 50_000, null, false).views);
  assert.ok(vlogOutcome(SEED, "k", 5_000, null, true).views > vlogOutcome(SEED, "k", 5_000, null, false).views);
});

test("a road trip becomes a vlog once; the trending show gets the bigger crowd", async () => {
  await db.execute(sql`INSERT INTO career_stream_channels (career_save_id, handle, followers) VALUES (${id}, 'VlogDarts', 3000)`);
  const s = await saves.read(1, id);
  let v = await streaming.read(actor, id);
  assert.equal(v.content.vlogs.available.length, 0);
  await db.execute(sql`INSERT INTO career_road_trips (career_save_id, id, season, week, day, locality_key, cost_pence) VALUES (${id}, gen_random_uuid(), ${s.currentSeason}, ${v.currentWeek}, 3, 'glasgow-clyde', 1000)`);
  v = await streaming.read(actor, id);
  assert.equal(v.content.vlogs.available.length, 1); assert.match(v.content.vlogs.available[0].title, /Glasgow/);
  const before = v.followers;
  v = await streaming.postVlog(actor, id, { source: v.content.vlogs.available[0].source });
  assert.equal(v.content.vlogs.available.length, 0); assert.equal(v.content.vlogs.posted.length, 1);
  assert.equal(v.followers, before + v.content.vlogs.posted[0].followers);
  await status(streaming.postVlog(actor, id, { source: "trip:00000000-0000-4000-8000-000000000000" }));
  assert.ok(v.trend.bonusPercent === 25 && v.trend.endsWeek >= v.currentWeek);
});
