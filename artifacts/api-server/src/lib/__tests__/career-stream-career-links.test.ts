/** DartCast meets the darts career: sponsor premium, walk-on crowd, pro podcast guests. */
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
  id = (await saves.create(1, { slot: 1, careerName: "Links", dateOfBirth: "1998-03-02", homeLocality: "ayrshire" })).id;
  await career.initialize(actor, id);
});
after(async () => { await pg.close(); });

import { CREATOR_SPONSOR_PREMIUM, creatorSponsorPremium, proGuestList, proPull, walkOnCrowd }
  from "../../career/streaming/career-links.ts";
import { tierAtLeast } from "../../career/streaming/model.ts";

test("link rules: the crowd and the sponsor premium start at Partner; a top pro pulls more than a journeyman", () => {
  assert.equal(walkOnCrowd({ handle: "X", followers: 900, tier: "AFFILIATE", emotes: [] }, "Sam Jones"), null);
  const c = walkOnCrowd({ handle: "SamDarts", followers: 30_000, tier: "STAR", emotes: ["samdGG"] }, "Sam Jones")!;
  assert.equal(c.inHall, 300); assert.equal(c.emote, "samdGG"); assert.match(c.chant, /Jones|SamDarts|DartCast/);
  assert.ok(CREATOR_SPONSOR_PREMIUM.LEGEND! > CREATOR_SPONSOR_PREMIUM.PARTNER!);
  assert.ok(proPull(1) > proPull(16) && proPull(16) > proPull(64) && proPull(null) < proPull(64));
  const pros = [{ id: "a", name: "Met Pro", meetings: 3, won: 1, rank: 40 }, { id: "b", name: "Top Pro", meetings: 0, won: 0, rank: 2 }];
  const partner = proGuestList(pros, "PARTNER", tierAtLeast), star = proGuestList(pros, "STAR", tierAtLeast), aff = proGuestList(pros, "AFFILIATE", tierAtLeast);
  assert.deepEqual(partner.map(p => [p.handle, p.ok]), [["Met Pro", true], ["Top Pro", false]]);
  assert.equal(partner[0].rival, true, "they've beaten you more often"); assert.equal(partner[0].record, "1-2");
  assert.ok(star.every(p => p.ok)); assert.ok(aff.every(p => !p.ok));
});

test("a channel earns a darts-sponsor premium; pros come on the podcast and win darts fans", async () => {
  assert.equal(await creatorSponsorPremium(db, id), null, "no channel, no premium");
  await db.execute(sql`INSERT INTO career_stream_channels (career_save_id, handle, followers) VALUES (${id}, 'LinkDarts', 30000)`);
  assert.equal((await creatorSponsorPremium(db, id))?.premium, 0.1);
  let v = await streaming.read(actor, id);
  assert.equal(v.business.dartsSponsors.premiumPercent, 10);
  assert.deepEqual(v.business.dartsSponsors.next, { tier: "ICON", premiumPercent: 15 });
  await status(streaming.recordPodcast(actor, id, { guest: "pro:00000000-0000-4000-8000-000000000000", topic: "STORY" }), 404);
  const pro = v.content.podcast.pros.find(p => p.ok);
  if (pro) {
    v = await streaming.recordPodcast(actor, id, { guest: pro.key, topic: "STORY" });
    assert.equal(v.content.podcast.thisWeek?.guest, pro.handle);
    const fans = Number((await rows(sql`SELECT fans FROM career_stream_podcasts WHERE career_save_id=${id}`))[0].fans);
    assert.ok(fans > 0, "a pro guest wins darts fans");
  } else assert.ok(v.content.podcast.pros.every(p => !p.ok));
});
