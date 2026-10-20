/** Pro-Am nights: pay for a leg against a touring pro (a prize if you beat them); with a Tour Card, be the pro and get paid. */
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
import { createCareerProAmService, settleProAmWeek } from "../../career/proam/service.ts";
import { createMatch, throwDart } from "../../shared/darts-rules/x01.ts";
import { PROAM, appearanceFor, feeFor, prizeFor, weekNights } from "../../career/proam/model.ts";
import { settleStreamingWeek } from "../../career/streaming/state.ts";
import { weekPlan } from "../../career/nights.ts";

const pg = new PGlite(), db = drizzle(pg);
const saves = createCareerService(db), career = createCareerSportingService(db), proam = createCareerProAmService(db);
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
  id = (await saves.create(1, { slot: 1, careerName: "ProAm", dateOfBirth: "1998-03-02", homeLocality: "ayrshire" })).id;
  await career.initialize(actor, id);
});
after(async () => { await pg.close(); });




const T20 = { segment: 20, multiplier: 3, value: 60 }, T19 = { segment: 19, multiplier: 3, value: 57 }, D12 = { segment: 12, multiplier: 2, value: 24 }, MISS = { segment: 0, multiplier: 1, value: 0 };
/** One leg you win in nine darts, throwing first (the pro misses twice). */
const nineDarter = [T20, T20, T20, MISS, MISS, MISS, T20, T20, T20, MISS, MISS, MISS, T20, T19, D12];
const rootOf = async () => (await rows(sql`SELECT * FROM career_saves WHERE id=${id}`))[0] as any;
const thisWeek = async () => { const r = await rootOf(); return { season: Number(r.current_season), week: Number(r.current_week) }; };

test("Pro-Am rules: the fee and prize by how big the pro is, the pro's appearance money by ranking, this week's nights", () => {
  assert.equal(feeFor(5), PROAM.fee.top16); assert.equal(feeFor(40), PROAM.fee.top64); assert.equal(feeFor(null), PROAM.fee.other);
  assert.equal(prizeFor(5), PROAM.fee.top16 * PROAM.prizeMultiple);
  assert.equal(appearanceFor(10), PROAM.appearance.top16); assert.equal(appearanceFor(30), PROAM.appearance.top32); assert.equal(appearanceFor(200), PROAM.appearance.other);
  const towns = [{ key: "a" }, { key: "b" }, { key: "c" }], pros = [{ key: "p1" }, { key: "p2" }];
  const n = weekNights("a".repeat(64), 1, 5, towns, pros);
  assert.equal(n.length, PROAM.perWeek); assert.notEqual(n[0].town.key, n[1].town.key);
  assert.deepEqual(n, weekNights("a".repeat(64), 1, 5, towns, pros), "the same week, the same nights");
  assert.ok(n.every(x => x.dayOfWeek >= 1 && x.dayOfWeek <= 5));
});

test("as an amateur: take a slot (fee and travel paid), throw your leg on the scorer, and beat the pro for the prize", async () => {
  await db.execute(sql`UPDATE career_saves SET balance_pence = 100000 WHERE id=${id}`);
  let v = await proam.read(actor, id);
  assert.equal(v.side, "AMATEUR"); assert.ok(v.nights.length >= 1);
  const night = v.nights.find(n => n.free)!;
  assert.ok(night.pro && night.feePence > 0 && night.prizePence === night.feePence * PROAM.prizeMultiple);
  v = await proam.book(actor, id, { nightKey: night.key });
  assert.equal(v.booking!.status, "BOOKED"); assert.equal(v.booking!.pro!.name, night.pro!.name);
  await status(proam.book(actor, id, { nightKey: night.key }), 409);
  // Nights Out's week strip shows the booked night as a Pro-Am night on its day.
  const { season, week } = await thisWeek();
  const plan = await weekPlan(db, id, season, week);
  assert.equal(plan.length, 7);
  assert.deepEqual(plan[night.dayOfWeek - 1].items.filter(i => i.kind === "proam"), [{ kind: "proam", label: "Pro-Am night", id: v.booking!.id }]);
  const fee = await rows(sql`SELECT amount_pence FROM career_finance_entries WHERE career_save_id=${id} AND operation_key=${`proam-fee:${v.booking!.id}`}`);
  assert.equal(Number(fee[0].amount_pence), -night.feePence);
  const s = await proam.session(actor, id, v.booking!.id);
  assert.equal(s.firstThrower, 0); assert.ok(s.pro.bot.config.avg > 0);
  const done = await proam.darts(actor, id, v.booking!.id, { darts: nineDarter });
  assert.equal(done.status, "PLAYED"); assert.equal(done.won, true);
  const prize = await rows(sql`SELECT amount_pence, category FROM career_finance_entries WHERE career_save_id=${id} AND operation_key=${`proam-win:${v.booking!.id}`}`);
  assert.equal(Number(prize[0].amount_pence), night.prizePence); assert.equal(prize[0].category, "PROAM_WIN");
  v = await proam.read(actor, id);
  assert.equal(v.record.prosBeaten, 1); assert.equal(v.record.prizePence, night.prizePence);
});

test("a slot you never play is missed when the week ends (the fee's gone)", async () => {
  const root = await rootOf(), w = await thisWeek();
  await db.execute(sql`UPDATE career_saves SET current_week=${w.week + 1} WHERE id=${id}`);
  let v = await proam.read(actor, id);
  const night = v.nights.find(n => n.free)!;
  v = await proam.book(actor, id, { nightKey: night.key });
  await settleProAmWeek(db, { ...root, current_week: w.week + 1 }, w.season, w.week + 1);
  v = await proam.read(actor, id);
  assert.equal(v.booking!.status, "MISSED");
  await status(proam.session(actor, id, v.booking!.id), 409);
});

test("with a Tour Card you're the pro: paid to take on a dozen amateurs (anyone who beats you collects from the organiser)", async () => {
  const w = await thisWeek();
  await db.execute(sql`UPDATE career_saves SET has_tour_card = true, current_week=${w.week + 1} WHERE id=${id}`);
  let v = await proam.read(actor, id);
  assert.equal(v.side, "PRO"); assert.ok(v.nights.every(n => n.pro === null && n.appearancePence > 0 && n.feePence === 0));
  const night = v.nights.find(n => n.free)!;
  v = await proam.book(actor, id, { nightKey: night.key });
  assert.equal(v.booking!.role, "PRO");
  await status(proam.session(actor, id, v.booking!.id), 409);
  v = await proam.simulate(actor, id, v.booking!.id);
  const b = v.booking!;
  assert.equal(b.status, "PLAYED"); assert.ok(b.result!.legs!.length > 0 && b.result!.legs!.length <= PROAM.amateurs);
  assert.equal(b.result!.beatenBy, b.result!.legs!.filter(l => !l.youWon).length);
  const pay = await rows(sql`SELECT amount_pence, category FROM career_finance_entries WHERE career_save_id=${id} AND operation_key=${`proam-appearance:${b.id}`}`);
  assert.equal(Number(pay[0].amount_pence), night.appearancePence); assert.equal(pay[0].category, "PROAM_APPEARANCE");
  assert.equal(v.record.nightsAsPro, 1);
  // Booked as the pro and the week ends: you turned up, so it plays out and you're paid.
  const root = await rootOf();
  await db.execute(sql`UPDATE career_saves SET current_week=${w.week + 2} WHERE id=${id}`);
  v = await proam.read(actor, id);
  v = await proam.book(actor, id, { nightKey: v.nights.find(n => n.free)!.key });
  await settleProAmWeek(db, root, w.season, w.week + 2);
  assert.equal((await proam.read(actor, id)).booking!.status, "PLAYED");
});

test("existing saves can read and book a free Pro-Am night next week without changing this week's view", async () => {
  const futureSave = (await saves.create(1, { slot: 2, careerName: "Future Pro-Am", dateOfBirth: "1998-03-02", homeLocality: "ayrshire" })).id;
  await career.initialize(actor, futureSave);
  await db.execute(sql`UPDATE career_saves SET balance_pence=100000 WHERE id=${futureSave}`);
  const root = (await rows(sql`SELECT current_week,current_season FROM career_saves WHERE id=${futureSave}`))[0];
  const currentWeek = Number(root.current_week), nextWeek = currentWeek + 1;
  const future = await proam.read(actor, futureSave, nextWeek);
  assert.equal(future.week, nextWeek);
  const night = future.nights.find(n => n.free);
  assert.ok(night, "the next-week offer should include a genuinely free night");
  const booked = await proam.book(actor, futureSave, { nightKey: night.key, week: nextWeek });
  assert.equal(booked.week, nextWeek);
  assert.equal(booked.booking?.status, "BOOKED");
  const stored = (await rows(sql`SELECT season,week,day FROM career_proam_nights WHERE career_save_id=${futureSave} AND id=${booked.booking!.id}`))[0];
  assert.equal(Number(stored.season), Number(root.current_season));
  assert.equal(Number(stored.week), nextWeek);
  assert.equal(Number(stored.day), (nextWeek - 1) * 7 + night.dayOfWeek);
  const current = await proam.read(actor, futureSave);
  assert.equal(current.week, currentWeek);
  assert.equal(current.booking, null, "a future booking must not replace this week's booking view");
  await status(proam.read(actor, futureSave, nextWeek + 1), 400);
  await status(proam.book(actor, futureSave, { nightKey: night.key, week: nextWeek + 1 }), 409);
});
