/** Studio gear that unlocks shows: the board camera (trick shots) and the second board (head-to-heads). */
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
  id = (await saves.create(1, { slot: 1, careerName: "Gear", dateOfBirth: "1998-03-02", homeLocality: "ayrshire" })).id;
  await career.initialize(actor, id);
});
after(async () => { await pg.close(); });

import { SHOWPIECE_FINISHES, trickShotTargets } from "../../career/streaming/model.ts";
import { setFor } from "../../career/streaming/content.ts";

test("trick-shot targets: six distinct showpiece finishes; each new show needs its gear", () => {
  const t = trickShotTargets(SEED, "k");
  assert.equal(t.length, 6); assert.equal(new Set(t).size, 6); assert.ok(t.every(x => (SHOWPIECE_FINISHES as readonly number[]).includes(x)));
  assert.equal(setFor("TRICKSHOTS")?.key, "BOARD_CAM"); assert.equal(setFor("HEAD_TO_HEAD")?.key, "SECOND_BOARD"); assert.equal(setFor("CHALLENGER"), null);
});

test("locked until bought; then trick shots run as a board-cam drill and head-to-heads bring a creator to the second board", async () => {
  await db.execute(sql`INSERT INTO career_stream_channels (career_save_id, handle, followers) VALUES (${id}, 'GearDarts', 2000)`);
  await db.execute(sql`UPDATE career_saves SET balance_pence=5000000 WHERE id=${id}`);
  let v = await streaming.read(actor, id);
  assert.match(v.formats.find(f => f.key === "TRICKSHOTS")!.why ?? "", /board camera/);
  assert.match(v.formats.find(f => f.key === "HEAD_TO_HEAD")!.why ?? "", /second board/);
  await status(streaming.goLive(actor, id, { dayOfWeek: v.freeNights[0], format: "TRICKSHOTS" }));
  v = await streaming.buySet(actor, id, { set: "BOARD_CAM" });
  assert.equal(v.formats.find(f => f.key === "TRICKSHOTS")!.why, null);
  const s = await streaming.goLive(actor, id, { dayOfWeek: v.freeNights[0], format: "TRICKSHOTS" });
  const row = (await rows(sql`SELECT drill FROM career_streams WHERE career_save_id=${id} AND id=${s.id}`))[0].drill as { kind: string; targets: number[]; visitsEach: number };
  assert.equal(row.kind, "CHECKOUTS"); assert.equal(row.targets.length, 6); assert.equal(row.visitsEach, 2);
  await db.execute(sql`UPDATE career_streams SET status='ENDED' WHERE career_save_id=${id} AND id=${s.id}`);
  v = await streaming.buySet(actor, id, { set: "SECOND_BOARD" });
  const h = await streaming.goLive(actor, id, { dayOfWeek: v.freeNights[0], format: "HEAD_TO_HEAD" });
  const ch = (await rows(sql`SELECT challenger FROM career_streams WHERE career_save_id=${id} AND id=${h.id}`))[0].challenger as { name: string; avg: number; bot: unknown };
  assert.ok(v.collabs.some(c => c.handle === ch.name), "a creator from the scene"); assert.ok(ch.bot && ch.avg > 0);
});
