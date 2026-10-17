/** Run your own tournament: booked on a free night, paid for up front, played like any other event, and the organiser's share paid once it's played. */
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
import { createCareerHostingService } from "../../career/hosting/service.ts";
import { HOSTING, expectedTurnout, hostedPrize, organiserTake } from "../../career/hosting/model.ts";

const pg = new PGlite(), db = drizzle(pg);
const saves = createCareerService(db), career = createCareerSportingService(db), hosting = createCareerHostingService(db);
const actor = { playerId: 1 };
let id = "";
const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rows;
const status = (p: Promise<unknown>, n = 409) => assert.rejects(p, (e: { status?: number }) => e.status === n);
const balance = async () => Number((await rows(sql`SELECT balance_pence FROM career_saves WHERE id=${id}`))[0].balance_pence);

before(async () => {
  await pg.exec(`CREATE TABLE players (id INTEGER PRIMARY KEY); INSERT INTO players VALUES (1);
    CREATE TABLE feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);
    INSERT INTO feature_flags VALUES ('tour_career_2', true, false, 'test')`);
  for (const m of [createCareerSaves, createCareerWorld, createCareerSponsorshipFoundation, createCareerNpcSponsorMarketSPF, createCareerCalendar, createCareerFinance,
    createCareerSponsorJourneysSPB, createCareerSponsorJourneysSPB3, createCareerFinanceSPC, createCareerSponsorHQSPD, createCareerSponsorContractActionsSPE2, createCareerSporting, createShadowObservations]) await m(db);
  await repairCareerSchema(db);
  id = (await saves.create(1, { slot: 1, careerName: "Promoter", dateOfBirth: "1990-03-02", homeLocality: "ayrshire" })).id;
  await career.initialize(actor, id);
  await db.execute(sql`UPDATE career_saves SET balance_pence = 40000 WHERE id = ${id}`);
});
after(async () => { await pg.close(); });

test("rules: the pot is the fees less your share plus your top-up; prize money draws a crowd and a steep fee keeps them away", () => {
  const t = { feePence: 1000, topUpPence: 10000, organiserShare: HOSTING.organiserShare };
  assert.deepEqual(hostedPrize(t, 16).bands.map(b => b.amountPence), [11400, 5700, 2850], "16 x £10 x 80% + £100 = £228");
  assert.equal(organiserTake(t, 16), 3200, "you keep a fifth of the fees");
  const turnout = (feePence: number, topUpPence: number, fans = 0) => expectedTurnout({ feePence, topUpPence, fieldSize: 16 }, fans);
  assert.ok(turnout(500, 20000) > turnout(500, 0), "prize money draws them in");
  assert.ok(turnout(5000, 0) < turnout(500, 0), "a steep fee keeps them away");
  assert.ok(turnout(500, 0, 5000) > turnout(500, 0), "a following brings them along");
  for (const x of [turnout(0, 200000, 1e6), turnout(5000, 0)]) assert.ok(x >= 0.25 && x <= 1);
});

const booking = (over: Record<string, unknown> = {}) => ({ week: 6, dayOfWeek: 6, fieldSize: 16, feePence: 1000, topUpPence: 5000, ...over });

test("booking: at least two weeks ahead, whole pounds, a 16 or 32 field, money up front, a night you're free, one at a time", async () => {
  await status(hosting.create(actor, id, booking({ week: 2 })));
  await status(hosting.create(actor, id, booking({ week: 51 })));
  await status(hosting.create(actor, id, booking({ fieldSize: 20 })), 400);
  await status(hosting.create(actor, id, booking({ feePence: 1050 })), 400);
  await status(hosting.create(actor, id, booking({ topUpPence: 200000 })), 409);
  const event = (await rows(sql`SELECT id FROM career_event_instances WHERE career_save_id=${id} LIMIT 1`))[0].id;
  await db.execute(sql`INSERT INTO career_participant_bookings (career_save_id,season,participant_key,day,event_id) VALUES (${id},1,'HUMAN',${(7 - 1) * 7 + 6},${event})`);
  await status(hosting.create(actor, id, booking({ week: 7 })), 409);
  const before = await balance();
  const made = await hosting.create(actor, id, booking());
  assert.equal(await balance(), before - (HOSTING.roomHirePence[16] + 5000), "room and top-up paid now");
  const ev = (await rows(sql`SELECT * FROM career_event_instances WHERE career_save_id=${id} AND id=${made.eventId}`))[0];
  assert.deepEqual([ev.definition_key, ev.classification, ev.status, ev.locality_key, Number(ev.start_week), Number(ev.field_size)],
    ["hosted-open", "SPECIAL", "REGISTRATION_OPEN", "ayrshire", 6, 16], "a real local special in the calendar, open for entries");
  await status(hosting.create(actor, id, booking({ week: 8 })), 409);
  const v = await hosting.read(actor, id);
  assert.equal(v.events.length, 1); assert.equal(v.events[0].status, "REGISTRATION_OPEN");
});

test("played like any other event: you enter at your own fee, it's played, and the organiser's share is paid", async () => {
  const v = await hosting.read(actor, id);
  const eventId = v.events[0].eventId;
  const listed = ((await career.calendar.calendar(actor, id, { scope: "AVAILABLE" })).events as any[]).find(e => e.id === eventId);
  assert.ok(listed, "you can enter your own tournament");
  assert.equal(listed.finance.entryFeePence, 1000, "at the fee you set");
  assert.equal(listed.classification, "SPECIAL");
  assert.equal((await career.calendar.enter(actor, id, { eventId })).entered, true);
  for (let i = 0; i < 40; i++) {
    const ev = (await rows(sql`SELECT status FROM career_event_instances WHERE career_save_id=${id} AND id=${eventId}`))[0];
    if (ev.status === "COMPLETED") break;
    const s = await saves.read(1, id);
    const r = await career.calendar.advance(actor, id, { operationKey: `hosting-test-${i}`, expectedSeason: s.currentSeason, expectedWeek: s.currentWeek, target: { kind: "WEEKS", weeks: 1 } }) as any;
    if (r.stop.reason === "HUMAN_MATCH_PENDING") for (const matchId of r.stop.detail.matchIds) {
      const m = (await rows(sql`SELECT best_of FROM career_tournament_matches WHERE career_save_id=${id} AND id=${matchId}`))[0];
      await career.calendar.recordHumanMatchResult(actor, id, { matchId, humanLegs: (Number(m.best_of) + 1) / 2, opponentLegs: 0, humanThrewFirst: true });
    }
  }
  const ev = (await rows(sql`SELECT status, entrant_count FROM career_event_instances WHERE career_save_id=${id} AND id=${eventId}`))[0];
  assert.equal(ev.status, "COMPLETED");
  const entrants = Number(ev.entrant_count);
  assert.ok(entrants >= HOSTING.minimumEntrants && entrants <= 16);
  const take = (await rows(sql`SELECT amount_pence FROM career_finance_entries WHERE career_save_id=${id} AND operation_key=${`hosting-income:${eventId}`}`))[0];
  const terms = { feePence: 1000, topUpPence: 5000, organiserShare: HOSTING.organiserShare };
  assert.equal(Number(take.amount_pence), organiserTake(terms, entrants));
  const prize = (await rows(sql`SELECT amount_pence FROM career_finance_entries WHERE career_save_id=${id} AND event_id=${eventId} AND category='PRIZE'`))[0];
  assert.equal(Number(prize.amount_pence), hostedPrize(terms, entrants).bands[0].amountPence, "you won your own tournament and its pot");
  assert.equal((await rows(sql`SELECT 1 FROM career_ranking_ledger WHERE career_save_id=${id} AND event_id=${eventId}`).catch(() => [])).length, 0, "no ranking points");
  const after = await hosting.read(actor, id);
  assert.equal(after.events[0].status, "COMPLETED"); assert.equal(after.events[0].takePence, organiserTake(terms, entrants)); assert.equal(after.events[0].yourPosition, 1);
});
