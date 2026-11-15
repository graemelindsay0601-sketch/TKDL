/** Past Star: Icon and Legend tiers, and creator plaques. */
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
  id = (await saves.create(1, { slot: 1, careerName: "Plaques", dateOfBirth: "1998-03-02", homeLocality: "ayrshire" })).id;
  await career.initialize(actor, id);
});
after(async () => { await pg.close(); });

import { PLAQUES, STREAM, TIER_ORDER, tierAtLeast, tierFor, COMMUNITY } from "../../career/streaming/model.ts";
import { PARTNERS } from "../../career/streaming/partners.ts";
import { CUPS, cupSize } from "../../career/streaming/cups.ts";

test("Icon at 100K and Legend at 500K; they count as Star and above everywhere", () => {
  assert.deepEqual(TIER_ORDER, ["NEWCOMER", "AFFILIATE", "PARTNER", "STAR", "ICON", "LEGEND"]);
  assert.equal(tierFor(99_999).key, "STAR"); assert.equal(tierFor(100_000).key, "ICON"); assert.equal(tierFor(500_000).key, "LEGEND");
  assert.ok(tierAtLeast("LEGEND", "STAR") && tierAtLeast("ICON", "PARTNER") && !tierAtLeast("STAR", "ICON"));
  assert.equal(cupSize("LEGEND"), 16);
  for (const k of TIER_ORDER) for (const table of [COMMUNITY.size, COMMUNITY.modSlots, COMMUNITY.vipSlots, PARTNERS.slots, PARTNERS.retainerBase, CUPS.winnerPrize])
    assert.equal(typeof table[k], "number", `${k} is priced`);
  assert.ok(PARTNERS.slots.LEGEND > PARTNERS.slots.ICON && PARTNERS.slots.ICON > PARTNERS.slots.STAR);
  assert.ok(STREAM.tiers.every((t, i) => i === 0 || t.followers > STREAM.tiers[i - 1].followers));
});

test("plaques arrive once, the week you pass each milestone, and win fans", async () => {
  const root = { id, world_seed: String((await rows(sql`SELECT world_seed FROM career_saves WHERE id=${id}`))[0].world_seed) };
  const season = (await saves.read(1, id)).currentSeason;
  await db.execute(sql`INSERT INTO career_stream_channels (career_save_id, handle, followers) VALUES (${id}, 'PlaqueDarts', 90000)`);
  await settleStreamingWeek(db, root, season, 1);
  let v = await streaming.read(actor, id);
  assert.ok(v.plaques.every(p => p.earned === null));
  await db.execute(sql`UPDATE career_stream_channels SET followers=520000 WHERE career_save_id=${id}`);
  await settleStreamingWeek(db, root, season, 2); await settleStreamingWeek(db, root, season, 2); await settleStreamingWeek(db, root, season, 3);
  v = await streaming.read(actor, id);
  assert.deepEqual(v.plaques.map(p => p.earned), [{ season, week: 2 }, { season, week: 2 }, null]);
  assert.equal(v.tier.key, "LEGEND");
  const stored = (await rows(sql`SELECT jsonb_array_length(plaques) AS n FROM career_stream_channels WHERE career_save_id=${id}`))[0];
  assert.equal(Number(stored.n), 2, "never twice");
  const fans = await rows(sql`SELECT SUM((p->>'fans')::int)::int AS f FROM career_stream_channels c, jsonb_array_elements(c.plaques) p WHERE c.career_save_id=${id}`);
  assert.equal(Number(fans[0].f), PLAQUES[0].fans + PLAQUES[1].fans);
});
