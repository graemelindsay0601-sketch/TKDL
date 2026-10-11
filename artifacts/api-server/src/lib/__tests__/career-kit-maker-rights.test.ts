/**
 * Kit Room maker rights against the real presentation service: the authoritative ID is the
 * active contract's sponsor key (exposed to the UI as placement.brandId); a saved maker shirt
 * is retained after the agreement ends, but other shirts from that maker lock again.
 */
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { createCareerSaves } from "../../db/migrations/create_career_saves.ts";
import { createCareerWorld } from "../../db/migrations/create_career_world.ts";
import { createCareerSponsorshipFoundation } from "../../db/migrations/create_career_sponsorship_foundation.ts";
import { createCareerFinanceSPC } from "../../db/migrations/create_career_finance_spc.ts";
import { createCareerSponsorHQSPD } from "../../db/migrations/create_career_sponsor_hq_spd.ts";
import { createCareerCalendar } from "../../db/migrations/create_career_calendar.ts";
import { createCareerFinance } from "../../db/migrations/create_career_finance.ts";
import { createCareerSPHCommercial } from "../../db/migrations/create_career_sph_commercial.ts";
import { createCareerSponsorJourneysSPB } from "../../db/migrations/create_career_sponsor_journeys_spb.ts";
import { createCareerSponsorJourneysSPB3 } from "../../db/migrations/create_career_sponsor_journeys_spb3.ts";
import { createCareerNpcSponsorMarketSPF } from "../../db/migrations/create_career_npc_sponsor_market_spf.ts";
import { createCareerSponsorContractActionsSPE2 } from "../../db/migrations/create_career_sponsor_contract_actions_spe2.ts";
import { createCareerSporting } from "../../db/migrations/create_career_sporting.ts";
import { createCareerService } from "../../career/service.ts";
import { createCareerSportingService } from "../../career/sporting/service.ts";
import { createCareerContentService } from "../../career/content/service.ts";
import { sponsorCatalogue, CURRENT_SPONSOR_DATABASE_VERSION, type SportingFacts } from "../../career/finance/sponsors.catalogue.ts";
import { stableUuid } from "../../career/world/random.ts";

const pg = new PGlite(), db = drizzle(pg), saves = createCareerService(db), actor = { playerId: 1 }, seed = "b".repeat(64);
const facts: SportingFacts = { careerStarted: true, titles: 20, professionalStatus: "PROFESSIONAL", tourCard: true, worldRanking: 8, qualifications: [], bestFinishByCircuit: {} };
const sporting = createCareerSportingService(db, { facts: { id: "TEST", facts: async () => structuredClone(facts) } });
const content = createCareerContentService(db, sporting);
const refused = (p: Promise<unknown>) => assert.rejects(p, (e: unknown) => (e as { status?: number }).status === 409);
let saveId = "";

async function contract(brandId: string) {
  const version = CURRENT_SPONSOR_DATABASE_VERSION;
  const terms = sponsorCatalogue(version).find(d => d.key === brandId)!.terms;
  const offerId = stableUuid(seed, 1, "kit-offer", brandId), contractId = stableUuid(seed, 1, "kit-contract", brandId);
  await db.execute(sql`INSERT INTO career_sponsor_offers (career_save_id,id,operation_key,sponsor_key,sponsor_database_version,tier,kind,terms,source,
    offered_season,offered_week,expires_season,expires_week,status,resolved_at)
    VALUES (${saveId},${offerId},${`kit:${brandId}`},${brandId},${version},${terms.tier},'NEW',${JSON.stringify(terms)}::jsonb,'{}'::jsonb,1,1,1,52,'ACCEPTED',NOW())
    ON CONFLICT DO NOTHING`);
  await db.execute(sql`INSERT INTO career_sponsor_contracts (career_save_id,id,offer_id,sponsor_key,sponsor_database_version,tier,terms,start_season,start_week,end_season,end_week,status)
    VALUES (${saveId},${contractId},${offerId},${brandId},${version},${terms.tier},${JSON.stringify(terms)}::jsonb,1,1,1,52,'ACTIVE')`);
  return contractId;
}
/** The same terminal update the sponsor lifecycle applies when a term completes. */
const conclude = (contractId: string) => db.execute(sql`UPDATE career_sponsor_contracts SET status='COMPLETED',end_reason='TERM_COMPLETED',ended_at=NOW()
  WHERE career_save_id=${saveId} AND id=${contractId}`);
let blackforge = "";

before(async () => {
  await pg.exec(`CREATE TABLE players(id integer PRIMARY KEY);INSERT INTO players VALUES(1);
    CREATE TABLE feature_flags(feature_name text UNIQUE,enabled boolean,admin_test_mode boolean,description text);
    INSERT INTO feature_flags VALUES('tour_career_2',true,false,'test')`);
  await createCareerSaves(db); await createCareerWorld(db); await createCareerSponsorshipFoundation(db); await createCareerCalendar(db); await createCareerFinance(db);
  await createCareerSPHCommercial(db); await createCareerSponsorJourneysSPB(db); await createCareerSponsorJourneysSPB3(db); await createCareerFinanceSPC(db);
  await createCareerSponsorHQSPD(db); await createCareerNpcSponsorMarketSPF(db); await createCareerSponsorContractActionsSPE2(db); await createCareerSporting(db);
  saveId = (await saves.create(1, { slot: 1, dateOfBirth: "1990-01-01", homeLocality: "ayrshire" })).id;
  await db.execute(sql`UPDATE career_saves SET world_seed=${seed} WHERE id=${saveId}`);
  await sporting.initialize(actor, saveId);
});
after(async () => await pg.close());

test("placements carry the contract's stable brand ID for every active agreement", async () => {
  blackforge = await contract("blackforge-darts");
  const p = await content.presentation(actor, saveId);
  assert.deepEqual(p.placements.map(x => x.brandId), ["blackforge-darts"]);
  assert.equal(p.canEdit, true, "fixture save is in the season opening week");
});

test("maker shirts unlock only with that maker's active agreement; the saved shirt is retained after it ends", async () => {
  await refused(content.editPresentation(actor, saveId, { kitDesignId: "kit-250-141" })); // Vela Sport range, no agreement
  await content.editPresentation(actor, saveId, { kitDesignId: "kit-250-151" });          // Blackforge range, active agreement
  assert.equal(((await content.presentation(actor, saveId)).identity as { kitDesignId?: string }).kitDesignId, "kit-250-151");

  await conclude(blackforge); // agreement concluded
  const after = await content.presentation(actor, saveId);
  assert.deepEqual(after.placements, [], "an ended agreement prints no logo");
  assert.equal((after.identity as { kitDesignId?: string }).kitDesignId, "kit-250-151", "the saved maker shirt is not stripped from the save");
  await content.editPresentation(actor, saveId, { kitDesignId: "kit-250-151", primaryColour: "#223344" }); // re-saving the retained shirt is allowed
  await refused(content.editPresentation(actor, saveId, { kitDesignId: "kit-250-152" }));               // another shirt from that maker is locked again
  await content.editPresentation(actor, saveId, { kitDesignId: "kit-250-150" });                        // non-maker shirts stay open
});
