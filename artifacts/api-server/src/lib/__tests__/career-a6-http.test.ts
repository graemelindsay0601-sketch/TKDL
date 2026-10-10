import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { createCareerSaves } from "../../db/migrations/create_career_saves.ts";
import { createCareerWorld } from "../../db/migrations/create_career_world.ts";
import {createCareerSponsorshipFoundation} from "../../db/migrations/create_career_sponsorship_foundation.ts";
import {createCareerFinanceSPC} from "../../db/migrations/create_career_finance_spc.ts";
import {createCareerSponsorHQSPD} from "../../db/migrations/create_career_sponsor_hq_spd.ts";
import {cancelInactiveSponsorActivities} from "../../career/finance/sponsor-activities.ts";
import { createCareerCalendar } from "../../db/migrations/create_career_calendar.ts";
import { createCareerFinance } from "../../db/migrations/create_career_finance.ts";
import { createCareerSponsorJourneysSPB } from "../../db/migrations/create_career_sponsor_journeys_spb.ts";
import { createCareerSponsorJourneysSPB3 } from "../../db/migrations/create_career_sponsor_journeys_spb3.ts";
import { createCareerSporting } from "../../db/migrations/create_career_sporting.ts";
import { createCareerSponsorContractActionsSPE2 } from "../../db/migrations/create_career_sponsor_contract_actions_spe2.ts";
import { createCareerService } from "../../career/service.ts";
import { createCareerRouter } from "../../career/router.ts";
import { createCareerCalendarRouter } from "../../career/calendar/router.ts";
import { createCareerFinanceRouter } from "../../career/finance/router.ts";
import { createCareerFinanceService } from "../../career/finance/service.ts";
import { createCareerSportingService } from "../../career/sporting/service.ts";
import { createCareerSportingRouter } from "../../career/sporting/router.ts";
import { HARNESS_SEED } from "../../career/world/harness.ts";
import type { SponsorFactsProvider } from "../../career/finance/engine.ts";

/**
 * A6 contract test: the exact HTTP endpoints and mutations the Career UI uses,
 * served by the real composed A1–A5 routers (same order as routes/career.ts).
 */
const pg = new PGlite();
const db = drizzle(pg);
const saves = createCareerService(db);
const career = createCareerSportingService(db);
let base = "";
let server: ReturnType<ReturnType<typeof express>["listen"]>;

before(async () => {
  await pg.exec(`CREATE TABLE players (id INTEGER PRIMARY KEY); INSERT INTO players VALUES (1), (2);
    CREATE TABLE feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);
    INSERT INTO feature_flags VALUES ('tour_career_2', true, false, 'test')`);
  await createCareerSaves(db); await createCareerWorld(db); await createCareerSponsorshipFoundation(db); await createCareerCalendar(db); await createCareerFinance(db); await createCareerSponsorJourneysSPB(db); await createCareerSponsorJourneysSPB3(db); await createCareerFinanceSPC(db); await createCareerSponsorHQSPD(db); await createCareerSponsorContractActionsSPE2(db); await createCareerSporting(db);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const player = Number(req.header("x-test-player") ?? 0);
    (req as unknown as { session: unknown }).session = player ? { playerId: player } : {};
    (req as unknown as { log: unknown }).log = { error: (...args: unknown[]) => console.error(...args) };
    next();
  });
  const available = (isAdmin: boolean) => saves.isAvailable(isAdmin);
  const router = express.Router();
  router.use(createCareerSportingRouter(career, available));
  router.use(createCareerFinanceRouter(career.finance, available));
  router.use(createCareerCalendarRouter(career.calendar, available));
  router.use(createCareerRouter(saves));
  app.use("/api/career", router);
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/career`;
});
after(async () => { server.close(); await pg.close(); });

async function call(method: string, path: string, body?: unknown, player = 1) {
  const res = await fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json", ...(player ? { "x-test-player": String(player) } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let parsed: any = null; try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: res.status, body: parsed, cache: res.headers.get("cache-control") };
}
async function newCareer(slot: number, name = "HTTP Career", player = 1) {
  const created = await call("POST", "/saves", { slot, careerName: name },player);
  assert.equal(created.status, 201);
  await db.execute(sql`UPDATE career_saves SET world_seed = ${HARNESS_SEED} WHERE id = ${created.body.id}`);
  const init = await call("POST", `/saves/${created.body.id}/initialize`, {},player);
  assert.equal(init.status, 200);
  return created.body.id as string;
}

test("save entry: three slots, create + one composed initialize (idempotent), auth and no-store", async () => {
  assert.equal((await call("GET", "/saves", undefined, 0)).status, 401);
  const empty = await call("GET", "/saves");
  assert.deepEqual(empty.body.slots.map((s: { slotNumber: number; career: unknown }) => [s.slotNumber, s.career]), [[1, null], [2, null], [3, null]]);
  const id = await newCareer(1);
  assert.equal((await call("POST", `/saves/${id}/initialize`, {})).status, 200, "initialize is idempotent");
  const state = await db.execute(sql`SELECT (SELECT COUNT(*) FROM career_world_players WHERE career_save_id = ${id})::int AS npcs,
    (SELECT COUNT(*) FROM career_event_instances WHERE career_save_id = ${id})::int AS events,
    (SELECT COUNT(*) FROM career_finance_state WHERE career_save_id = ${id})::int AS finance,
    (SELECT COUNT(*) FROM career_tour_cards WHERE career_save_id = ${id} AND source = 'FOUNDING')::int AS founding`);
  const s = state.rows[0];
  assert.ok(Number(s.npcs) > 200 && Number(s.events) > 100 && Number(s.finance) === 1 && Number(s.founding) > 0, "A2+A3+A4+A5 all initialized by the single route");
  const list = await call("GET", "/saves");
  assert.equal(list.body.slots[0].career.id, id);
  assert.deepEqual([list.body.slots[0].career.professionalRanking, list.body.slots[0].career.hasTourCard, list.body.slots[0].career.balancePence], [null, false, 25000]);
  for (const path of [`/saves/${id}/sporting`, `/saves/${id}/finance`, `/saves/${id}/calendar`, `/saves/${id}/rankings`]) assert.equal((await call("GET", path)).cache, "no-store", path);
  assert.equal((await call("GET", `/saves/${id}/sporting`, undefined, 2)).status, 404, "another player cannot read this Career");
});

test("every read the UI makes returns real Career state (new Career: unranked, no card, no sponsor)", async () => {
  const id = (await call("GET", "/saves")).body.slots[0].career.id;
  const sporting = (await call("GET", `/saves/${id}/sporting`)).body;
  assert.deepEqual([sporting.professionalStatus, sporting.tourCard.holdsCard, sporting.worldRanking.standing], ["AMATEUR", false, null]);
  const finance = (await call("GET", `/saves/${id}/finance`)).body;
  assert.deepEqual([finance.balancePence, finance.careerEarningsPence, finance.sponsorEarningsPence, finance.careerExpensesPence, finance.sponsor], [25000, 0, 0, 0, null]);
  const cal = (await call("GET", `/saves/${id}/calendar?scope=WORLD&fromWeek=1&toWeek=8`)).body;
  assert.ok(cal.overview.groupings.length === 6 && cal.events.length > 10 && cal.events.every((e: { human: unknown; finance: unknown }) => e.human && e.finance));
  const lists = (await call("GET", `/saves/${id}/rankings`)).body;
  assert.deepEqual(lists.map((l: { key: string }) => l.key), ["pro-world", "pro-circuit", "european-series", "challenger", "vault", "amateur", "open-world", "women", "youth"]);
  assert.equal((await call("GET", `/saves/${id}/rankings/pro-world?view=AROUND&participant=HUMAN`)).body.published, null);
  assert.equal((await call("GET", `/saves/${id}/rankings/not-a-list`)).status, 404);
  const q = (await call("GET", `/saves/${id}/q-school`)).body;
  assert.deepEqual(q.pathways.map((p: { pathway: string }) => p.pathway), ["UK_IRELAND", "EUROPE"]);
  assert.equal((await call("GET", `/saves/${id}/tour-card`)).body.holdsCard, false);
  assert.ok(Array.isArray((await call("GET", `/saves/${id}/milestones`)).body.milestones));
  assert.ok((await call("GET", `/saves/${id}/qualification?fromWeek=1&weeks=4`)).body.events.length > 0);
  assert.ok(Array.isArray((await call("GET", `/saves/${id}/history?participant=HUMAN`)).body));
  assert.ok((await call("GET", `/saves/${id}/sponsors`)).body.offers);
  assert.ok((await call("GET", `/saves/${id}/finance/ledger?limit=25`)).body.entries.length >= 1);
});

test("enter and withdraw mutations: fee charged then refunded through A4, denials explicit", async () => {
  const id = (await call("GET", "/saves")).body.slots[0].career.id;
  const open = (await call("GET", `/saves/${id}/calendar?scope=AVAILABLE`)).body.events.filter((e: { finance: { estimatedPlayerCostPence: number } }) => e.finance.estimatedPlayerCostPence > 0);
  const event = open[0];
  const entered = await call("POST", `/saves/${id}/events/${event.id}/entry`);
  assert.deepEqual([entered.status, entered.body.entered], [200, true]);
  const afterEntry = (await call("GET", `/saves/${id}/finance`)).body;
  assert.ok(afterEntry.balancePence < 25000);
  const again = await call("POST", `/saves/${id}/events/${event.id}/entry`);
  assert.equal(again.body.entered, true); assert.equal(again.body.created, false, "double-click does not double-enter");
  const withdrawn = await call("DELETE", `/saves/${id}/events/${event.id}/entry`);
  assert.deepEqual([withdrawn.status, withdrawn.body.withdrawn], [200, true]);
  const ledger = (await call("GET", `/saves/${id}/finance/ledger?limit=25`)).body.entries.map((e: { category: string }) => e.category);
  assert.ok(ledger.includes("ENTRY_FEE") && ledger.includes("REFUND"));
  const proEvent = (await call("GET", `/saves/${id}/calendar?scope=WORLD&circuit=PRO_CIRCUIT&fromWeek=1&toWeek=20`)).body.events[0];
  const denied = await call("POST", `/saves/${id}/events/${proEvent.id}/entry`);
  assert.equal(denied.body.entered, false);
  assert.ok(denied.body.denials.includes("REQUIRES_TOUR_CARD"), "server-side denial the UI shows as 'Tour Card required'");
});

test("sponsor decline works; acceptance rechecks current authority rather than trusting labelled offer fixtures", async () => {
  const id = (await call("GET", "/saves")).body.slots[0].career.id;
  // Create genuine offers through A4's own milestone boundary with labelled fixture facts.
  const facts: SponsorFactsProvider = { id: "TEST_FIXTURE", facts: async () => ({ careerStarted: true, titles: 1, bestFinishByCircuit: { GRASSROOTS: 1, COUNTY: 1 }, qualifications: [], professionalStatus: "AMATEUR", tourCard: false, worldRanking: null }) };
  await createCareerFinanceService(db, { facts }).evaluateOffers({ playerId: 1 }, id, { triggerKey: "a6-http-test" });
  const offers = (await call("GET", `/saves/${id}/sponsors`)).body.offers;
  assert.ok(offers.length >= 2);
  const declined = await call("POST", `/saves/${id}/sponsors/offers/${offers[1].id}/decline`);
  assert.equal(declined.status, 200);
  const accepted = await call("POST", `/saves/${id}/sponsors/offers/${offers[0].id}/accept`);
  assert.equal(accepted.status, 409,"the real A5 facts have no title, unlike the offer-only fixture");
  const sponsors = (await call("GET", `/saves/${id}/sponsors`)).body;
  assert.equal(sponsors.active,null);
  assert.equal((await call("GET", `/saves/${id}/finance`)).body.sponsorEarningsPence,0);
  assert.equal((await call("GET", "/saves")).body.slots[0].career.sponsor,null);
});

test("advance is retry-safe over HTTP and moves the real calendar", async () => {
  const id = (await call("GET", "/saves")).body.slots[0].career.id;
  const body = { operationKey: "ui-http-advance-1", expectedSeason: 1, expectedWeek: 1, target: { kind: "WEEKS", weeks: 1 } };
  const first = await call("POST", `/saves/${id}/calendar/advance`, body);
  assert.equal(first.status, 200);
  const retry = await call("POST", `/saves/${id}/calendar/advance`, body);
  assert.deepEqual(retry.body.to, first.body.to);
  assert.equal((await call("GET", `/saves/${id}`)).body.currentWeek, first.body.to.week);
  const stale = await call("POST", `/saves/${id}/calendar/advance`, { ...body, operationKey: "ui-http-advance-stale" });
  assert.equal(stale.status, 409, "a stale screen cannot advance from the wrong week");
});

test("there is no HTTP route that records a human match result (A6 boundary)", async () => {
  const id = (await call("GET", "/saves")).body.slots[0].career.id;
  for (const [method, path] of [["POST", `/saves/${id}/matches/x/result`], ["POST", `/saves/${id}/events/x/matches/x/result`], ["PATCH", `/saves/${id}/matches/x`]] as const)
    assert.ok([400, 404].includes((await call(method, path, { humanLegs: 3, opponentLegs: 0 })).status), `${method} ${path}`);
  const routers = ["career/router.ts", "career/calendar/router.ts", "career/finance/router.ts", "career/sporting/router.ts"].map(f => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8")).join("\n");
  assert.ok(!/recordHumanMatchResult/.test(routers));
});

test("retire is read-only, restart and delete follow A1 exactly", async () => {
  const id = await newCareer(2, "To retire");
  assert.equal((await call("POST", `/saves/${id}/retire`, {})).status,400);
  const retired = await call("POST", `/saves/${id}/retire`, {confirmation:"RETIRE CAREER"});
  assert.equal(retired.body.status, "RETIRED");
  assert.equal((await call("GET", `/saves/${id}/sporting`)).status, 200, "retired Career stays readable");
  assert.equal((await call("GET", `/saves/${id}/finance`)).status, 200);
  const anyEvent = (await call("GET", `/saves/${id}/calendar`)).body.events[0];
  assert.equal((await call("POST", `/saves/${id}/events/${anyEvent.id}/entry`)).body.entered ?? false, false);
  assert.equal((await call("POST", `/saves/${id}/calendar/advance`, { operationKey: "ui-retired-advance", expectedSeason: 1, expectedWeek: 1, target: { kind: "WEEKS", weeks: 1 } })).status, 409);
  assert.equal((await call("POST", `/saves/${id}/initialize`, {})).status, 409);
  const archive = (await call("GET", "/saves")).body.archived;
  assert.ok(archive.some((s: { id: string }) => s.id === id));
  const restarted = await call("POST", `/saves/${(await call("GET", "/saves")).body.slots[0].career.id}/restart`, {});
  assert.equal(restarted.status, 200);
  assert.equal((await call("GET", "/saves")).body.slots[0].career.id, restarted.body.id);
  assert.equal((await call("DELETE", `/saves/${id}`, {})).status, 204);
  assert.equal((await call("GET", `/saves/${id}`)).status, 404);
});

test("SP-D HTTP lifecycle is persistent, idempotent and enforces one portfolio booking per week", async () => {
  const slots=(await call("GET","/saves")).body.slots as {slotNumber:number;career:{id:string;status:string}|null}[];
  const saveId=slots.find(slot=>slot.career?.status==="ACTIVE")?.career?.id
    ?? await newCareer(slots.find(slot=>slot.career===null)?.slotNumber??1,"SP-D HTTP lifecycle");
  const save=(await db.execute(sql`SELECT current_season,current_week FROM career_saves WHERE id=${saveId}`)).rows[0]!;
  const season=Number(save.current_season),week=Number(save.current_week),nextWeek=Math.min(52,week+1);
  const offer="00000000-0000-4000-8000-00000000d001",contract="00000000-0000-4000-8000-00000000d002";
  await db.execute(sql`INSERT INTO career_sponsor_offers
    (career_save_id,id,operation_key,sponsor_key,sponsor_database_version,tier,kind,terms,source,offered_season,offered_week,expires_season,expires_week,status,resolved_at)
    VALUES(${saveId},${offer},'spd-http-offer','spd-test',3,'LOCAL','NEW','{}'::jsonb,'{}'::jsonb,${season},${week},${season},52,'ACCEPTED',NOW())`);
  await db.execute(sql`INSERT INTO career_sponsor_contracts
    (career_save_id,id,offer_id,sponsor_key,sponsor_database_version,tier,terms,start_season,start_week,end_season,end_week,status)
    VALUES(${saveId},${contract},${offer},'spd-test',3,'LOCAL','{}'::jsonb,${season},${week},${season},52,'ACTIVE')`);
  const required="00000000-0000-4000-8000-00000000d003",optional="00000000-0000-4000-8000-00000000d004";
  const otherSlots=(await call("GET","/saves",undefined,2)).body.slots as {slotNumber:number;career:{id:string}|null}[];
  const otherSaveId=await newCareer(otherSlots.find(slot=>slot.career===null)?.slotNumber??1,"SP-D cross-save",2);
  await db.execute(sql`INSERT INTO career_sponsor_commitments
    (career_save_id,id,contract_id,sponsor_key,clause_id,occurrence,commitment_type,required,cadence,season,available_from_week,window_weeks,due_week,status,scheduling_requirements,operation_key)
    VALUES(${saveId},${required},${contract},'spd-test','community',1,'COMMUNITY_SESSION',true,'PER_SEASON',${season},${week},4,${Math.min(52,week+3)},'AVAILABLE',
      '{"activitySpecVersion":1,"extraCompensationPence":0}'::jsonb,'spd-http-required')`);
  await db.execute(sql`INSERT INTO career_sponsor_opportunities
    (career_save_id,id,contract_id,sponsor_key,clause_id,occurrence,opportunity_type,season,available_from_week,available_to_week,status,terms,operation_key)
    VALUES(${saveId},${optional},${contract},'spd-test','invite',1,'COMMUNITY',${season},${week},${Math.min(52,week+3)},'AVAILABLE',
      '{"activitySpecVersion":1,"compensationPence":0}'::jsonb,'spd-http-optional')`);
  assert.equal((await call("PUT",`/saves/${saveId}/sponsors/activities/${required}`,{action:"SCHEDULE",week},0)).status,401);
  assert.equal((await call("PUT",`/saves/${otherSaveId}/sponsors/activities/${required}`,{action:"SCHEDULE",week},2)).status,404,
    "an activity ID from another save is not accepted");
  assert.equal((await call("PUT",`/saves/${saveId}/sponsors/activities/${required}`,{action:"COMPLETE"})).status,409);
  assert.equal((await call("PUT",`/saves/${saveId}/sponsors/activities/${required}`,{action:"SCHEDULE",week})).status,200);
  assert.equal((await call("PUT",`/saves/${saveId}/sponsors/activities/${required}`,{action:"SCHEDULE",week})).status,200,"same schedule retry is idempotent");
  assert.equal((await call("PUT",`/saves/${saveId}/sponsors/activities/${required}`,{action:"COMPLETE"})).status,200);
  assert.equal((await call("PUT",`/saves/${saveId}/sponsors/activities/${required}`,{action:"COMPLETE"})).status,200,"completion retry is idempotent");
  assert.equal((await call("PUT",`/saves/${saveId}/sponsors/activities/${optional}`,{action:"DECLINE"})).status,200);
  const planned="00000000-0000-4000-8000-00000000d011";
  await db.execute(sql`INSERT INTO career_sponsor_commitments
    (career_save_id,id,contract_id,sponsor_key,clause_id,occurrence,commitment_type,required,cadence,season,available_from_week,window_weeks,due_week,status,scheduling_requirements,operation_key)
    VALUES(${saveId},${planned},${contract},'spd-test','future-media',1,'MEDIA_APPEARANCE',true,'PER_SEASON',${season},${nextWeek},3,${Math.min(52,nextWeek+2)},'PLANNED',
      '{"activitySpecVersion":1,"extraCompensationPence":0}'::jsonb,'spd-http-planned')`);
  assert.equal((await call("PUT",`/saves/${saveId}/sponsors/activities/${planned}`,{action:"SCHEDULE",week:nextWeek})).status,409,
    "a required activity must become AVAILABLE before it can be confirmed");
  const optionalComplete="00000000-0000-4000-8000-00000000d007";
  await db.execute(sql`INSERT INTO career_sponsor_opportunities
    (career_save_id,id,contract_id,sponsor_key,clause_id,occurrence,opportunity_type,season,available_from_week,available_to_week,status,terms,operation_key)
    VALUES(${saveId},${optionalComplete},${contract},'spd-test','invite-two',1,'COMMUNITY',${season},${week},${Math.min(52,week+3)},'AVAILABLE',
      '{"activitySpecVersion":1,"compensationPence":0}'::jsonb,'spd-http-optional-complete')`);
  assert.equal((await call("PUT",`/saves/${saveId}/sponsors/activities/${optionalComplete}`,{action:"ACCEPT"})).status,200);
  assert.equal((await call("PUT",`/saves/${saveId}/sponsors/activities/${optionalComplete}`,{action:"SCHEDULE",week:nextWeek})).status,200);
  await db.execute(sql`UPDATE career_saves SET current_week=${nextWeek} WHERE id=${saveId}`);
  assert.equal((await call("PUT",`/saves/${saveId}/sponsors/activities/${optionalComplete}`,{action:"COMPLETE"})).status,200);
  assert.equal((await call("PUT",`/saves/${saveId}/sponsors/activities/${optionalComplete}`,{action:"COMPLETE"})).status,200);
  const required2="00000000-0000-4000-8000-00000000d005",required3="00000000-0000-4000-8000-00000000d006";
  for(const [id,clause,key] of [[required2,"media-two","spd-http-two"],[required3,"media-three","spd-http-three"]] as const)
    await db.execute(sql`INSERT INTO career_sponsor_commitments
      (career_save_id,id,contract_id,sponsor_key,clause_id,occurrence,commitment_type,required,cadence,season,available_from_week,window_weeks,due_week,status,scheduling_requirements,operation_key)
      VALUES(${saveId},${id},${contract},'spd-test',${clause},1,'MEDIA_APPEARANCE',true,'PER_SEASON',${season},${nextWeek},3,${Math.min(52,nextWeek+2)},'AVAILABLE',
        '{"activitySpecVersion":1,"extraCompensationPence":0}'::jsonb,${key})`);
  const raceWeek=Math.min(52,week+2);
  const race=await Promise.all([required2,required3].map(id=>call("PUT",`/saves/${saveId}/sponsors/activities/${id}`,{action:"SCHEDULE",week:raceWeek})));
  assert.deepEqual(race.map(result=>result.status).sort(),[200,409],"concurrent requests cannot book two sponsor activities in one week");
  const state=(await db.execute(sql`SELECT
    (SELECT status FROM career_sponsor_commitments WHERE career_save_id=${saveId} AND id=${required}) AS required_status,
    (SELECT status FROM career_sponsor_opportunities WHERE career_save_id=${saveId} AND id=${optional}) AS optional_status,
    (SELECT COUNT(*)::int FROM career_sponsor_week_bookings WHERE career_save_id=${saveId} AND season=${season} AND week=${raceWeek}) AS bookings`)).rows[0]!;
  assert.deepEqual([state.required_status,state.optional_status,Number(state.bookings)],["COMPLETED","DECLINED",1]);
  const confirmedId=race[0]!.status===200?required2:required3;
  await db.execute(sql`UPDATE career_sponsor_contracts SET status='TERMINATED',end_reason='EXPLICITLY_REPLACED',ended_at=NOW()
    WHERE career_save_id=${saveId} AND id=${contract}`);
  await db.transaction(tx=>cancelInactiveSponsorActivities(tx,{saveId,season,week:nextWeek,contractIds:[contract]}));
  const replaced=(await db.execute(sql`SELECT c.status,
    (SELECT COUNT(*)::int FROM career_sponsor_week_bookings b WHERE b.career_save_id=c.career_save_id AND b.activity_id=c.id) AS bookings
    FROM career_sponsor_commitments c WHERE c.career_save_id=${saveId} AND c.id=${confirmedId}`)).rows[0]!;
  assert.deepEqual([replaced.status,Number(replaced.bookings)],["CANCELLED",0],"replacement releases a confirmed future slot");
  assert.equal((await call("PUT",`/saves/${saveId}/sponsors/activities/${confirmedId}`,{action:"COMPLETE"})).status,409,
    "a replaced agreement cannot complete a pending duty");

  const offer2="00000000-0000-4000-8000-00000000d008",contract2="00000000-0000-4000-8000-00000000d009";
  await db.execute(sql`INSERT INTO career_sponsor_offers
    (career_save_id,id,operation_key,sponsor_key,sponsor_database_version,tier,kind,terms,source,offered_season,offered_week,expires_season,expires_week,status,resolved_at)
    VALUES(${saveId},${offer2},'spd-expiry-offer','spd-test-two',3,'LOCAL','NEW','{}'::jsonb,'{}'::jsonb,${season},${nextWeek},${season},52,'ACCEPTED',NOW())`);
  await db.execute(sql`INSERT INTO career_sponsor_contracts
    (career_save_id,id,offer_id,sponsor_key,sponsor_database_version,tier,terms,start_season,start_week,end_season,end_week,status)
    VALUES(${saveId},${contract2},${offer2},'spd-test-two',3,'LOCAL','{}'::jsonb,${season},${nextWeek},${season},52,'ACTIVE')`);
  const rebookId="00000000-0000-4000-8000-00000000d00a";
  await db.execute(sql`INSERT INTO career_sponsor_commitments
    (career_save_id,id,contract_id,sponsor_key,clause_id,occurrence,commitment_type,required,cadence,season,available_from_week,window_weeks,due_week,status,scheduling_requirements,operation_key)
    VALUES(${saveId},${rebookId},${contract2},'spd-test-two','community',1,'COMMUNITY_SESSION',true,'PER_SEASON',${season},${raceWeek},2,${Math.min(52,raceWeek+1)},'AVAILABLE',
      '{"activitySpecVersion":1,"extraCompensationPence":0}'::jsonb,'spd-http-rebook')`);
  assert.equal((await call("PUT",`/saves/${saveId}/sponsors/activities/${rebookId}`,{action:"SCHEDULE",week:raceWeek})).status,200,
    "another active sponsor can reuse the released portfolio week");
  await db.execute(sql`UPDATE career_sponsor_contracts SET status='EXPIRED',end_reason='CONTRACT_EXPIRED',ended_at=NOW()
    WHERE career_save_id=${saveId} AND id=${contract2}`);
  await db.transaction(tx=>cancelInactiveSponsorActivities(tx,{saveId,season,week:raceWeek,}));
  const expired=(await db.execute(sql`SELECT c.status,
    (SELECT COUNT(*)::int FROM career_sponsor_week_bookings b WHERE b.career_save_id=c.career_save_id AND b.activity_id=c.id) AS bookings
    FROM career_sponsor_commitments c WHERE c.career_save_id=${saveId} AND c.id=${rebookId}`)).rows[0]!;
  assert.deepEqual([expired.status,Number(expired.bookings)],["CANCELLED",0],"expiry cancels pending activities and releases their week");
});

test("SP-E2B Sponsor HQ HTTP reads enforce ownership and create no notices",async()=>{
  const saveId=await newCareer(3,"E2B read-only");
  assert.equal((await call("GET",`/saves/${saveId}/sponsors`,undefined,0)).status,401);
  assert.equal((await call("GET",`/saves/${saveId}/sponsors`,undefined,2)).status,404);
  const response=await call("GET",`/saves/${saveId}/sponsors`);
  assert.equal(response.status,200);
  assert.equal(response.cache,"no-store");
  const result=(await db.execute(sql`SELECT COUNT(*)::int AS n FROM career_sponsor_compliance_notices WHERE career_save_id=${saveId}`)).rows[0]!;
  assert.equal(Number(result.n),0);
});
