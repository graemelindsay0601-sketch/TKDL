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
import { createCareerCalendar } from "../../db/migrations/create_career_calendar.ts";
import { createCareerFinance } from "../../db/migrations/create_career_finance.ts";
import { createCareerSponsorJourneysSPB } from "../../db/migrations/create_career_sponsor_journeys_spb.ts";
import { createCareerSponsorJourneysSPB3 } from "../../db/migrations/create_career_sponsor_journeys_spb3.ts";
import { createCareerSporting } from "../../db/migrations/create_career_sporting.ts";
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
  await createCareerSaves(db); await createCareerWorld(db); await createCareerSponsorshipFoundation(db); await createCareerCalendar(db); await createCareerFinance(db); await createCareerSponsorJourneysSPB(db); await createCareerSponsorJourneysSPB3(db); await createCareerFinanceSPC(db); await createCareerSporting(db);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const player = Number(req.header("x-test-player") ?? 0);
    (req as unknown as { session: unknown }).session = player ? { playerId: player } : {};
    (req as unknown as { log: unknown }).log = { error: () => {} };
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
async function newCareer(slot: number, name = "HTTP Career") {
  const created = await call("POST", "/saves", { slot, careerName: name });
  assert.equal(created.status, 201);
  await db.execute(sql`UPDATE career_saves SET world_seed = ${HARNESS_SEED} WHERE id = ${created.body.id}`);
  const init = await call("POST", `/saves/${created.body.id}/initialize`, {});
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
