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
import { createCareerService } from "../../career/service.ts";
import { createCareerSportingService } from "../../career/sporting/service.ts";
import { createCareerLiveMatchService } from "../../career/live/service.ts";
import { HARNESS_SEED } from "../../career/world/harness.ts";

/** Quick-sim: the human's waiting match is simulated at their level and recorded honestly as a simulation. */
const pg = new PGlite(), db = drizzle(pg);
const saves = createCareerService(db), career = createCareerSportingService(db), live = createCareerLiveMatchService(db, career.calendar);
const actor = { playerId: 1 };
const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rows as Record<string, any>[];
let id = "", op = 0;

before(async () => {
  await pg.exec(`CREATE TABLE players (id INTEGER PRIMARY KEY); INSERT INTO players VALUES (1);
    CREATE TABLE feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);
    INSERT INTO feature_flags VALUES ('tour_career_2', true, false, 'test')`);
  for (const m of [createCareerSaves, createCareerWorld, createCareerSponsorshipFoundation, createCareerNpcSponsorMarketSPF, createCareerCalendar, createCareerFinance,
    createCareerSponsorJourneysSPB, createCareerSponsorJourneysSPB3, createCareerFinanceSPC, createCareerSponsorHQSPD, createCareerSponsorContractActionsSPE2, createCareerSporting, createShadowObservations]) await m(db);
  const save = await saves.create(1, { slot: 1, careerName: "Quick sim", dateOfBirth: "1996-06-15" });
  id = save.id;
  await db.execute(sql`UPDATE career_saves SET world_seed = ${HARNESS_SEED}, event_database_version = 2, player_database_version = 1 WHERE id = ${id}`);
  await career.initialize(actor, id);
});
after(async () => { await pg.close(); });

async function nextHumanMatch() {
  for (let i = 0; i < 30; i++) {
    const s = await saves.read(1, id);
    const r = await career.calendar.advance(actor, id, { operationKey: `quick-sim-op-${++op}`, expectedSeason: s.currentSeason, expectedWeek: s.currentWeek, target: { kind: "NEXT_MEANINGFUL" } }) as { stop: { reason: string; detail?: { matchIds: string[] } } };
    if (r.stop.reason === "HUMAN_MATCH_PENDING") return r.stop.detail!.matchIds[0];
  }
  throw new Error("no human match reached");
}
async function enterFriday() {
  const events = ((await career.calendar.calendar(actor, id, { scope: "AVAILABLE" })).events as any[])
    .filter(e => e.definitionKey === "friday-night-501" && e.capability.executable && e.human.canEnter);
  assert.ok(events.length, "an enterable Friday Night 501");
  assert.equal((await career.calendar.enter(actor, id, { eventId: events[0].id })).entered, true);
  return events[0].id as string;
}

test("quick-sim records the match as a simulation at the player's level and the tournament moves on", async () => {
  const eventId = await enterFriday();
  const matchId = await nextHumanMatch();
  await live.open(actor, id, matchId); // a session opened at the bull, no darts thrown: quick-sim is still allowed
  const r = await career.calendar.quickSimMatch(actor, id, eventId, { matchId, confirmation: "QUICK_SIM" }) as any;
  const row = (await rows(sql`SELECT status, result_source, winner_key, summary, first_throw_detail FROM career_tournament_matches WHERE career_save_id = ${id} AND id = ${matchId}`))[0];
  assert.deepEqual([row.status, row.result_source], ["COMPLETED", "QUICK_SIM"], "never recorded as live darts");
  assert.equal(row.first_throw_detail.method, "SIMULATED_BULL_UP");
  assert.equal(row.summary.quickSim.skillAverage, 45, "no live history: the estimated level");
  assert.equal(r.quickSim.won, row.winner_key === "HUMAN");
  assert.equal((await live.read(actor, id, matchId)).status, "SUPERSEDED", "the open session steps aside");
  await assert.rejects(career.calendar.quickSimMatch(actor, id, eventId, { matchId, confirmation: "QUICK_SIM" }), /no longer awaiting/);
  const form = await career.calendar.form(actor, id);
  assert.equal(form.recentResults.length, 0, "a simmed result never moves your form or confidence");
  assert.equal(form.estimated, true, "quick-sims never count as live evidence for the average");
});

test("quick-sim is refused once live darts have been thrown", async () => {
  await enterFriday();
  const matchId = await nextHumanMatch();
  const eventId = String((await rows(sql`SELECT event_id FROM career_tournament_matches WHERE career_save_id = ${id} AND id = ${matchId}`))[0].event_id);
  let s = await live.open(actor, id, matchId) as any;
  for (let i = 0; i < 30 && s.status === "BULL_UP"; i++) s = await live.bull(actor, id, matchId, { throw: "MISS", expectedRevision: s.revision });
  assert.equal(s.status, "IN_PLAY");
  // Labelled fixture: the live log already holds thrown darts (the guard reads the session, not who threw them).
  await db.execute(sql`UPDATE career_match_sessions SET darts = '[{"segment":1,"multiplier":1,"value":1,"label":"S1"}]'::jsonb WHERE career_save_id = ${id} AND match_id = ${matchId}`);
  await assert.rejects(career.calendar.quickSimMatch(actor, id, eventId, { matchId, confirmation: "QUICK_SIM" }), /started this match live/);
  assert.equal((await rows(sql`SELECT status FROM career_tournament_matches WHERE career_save_id = ${id} AND id = ${matchId}`))[0].status, "AWAITING_HUMAN");
});
