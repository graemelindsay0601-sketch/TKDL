import { CURRENT_EVENT_DATABASE_VERSION } from "../../career/calendar/config.ts";
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
import { awardCard, cardHoldersIn } from "../../career/sporting/cards.ts";

import { randomUUID } from "node:crypto";
import { HUMAN, insertEntitlements } from "../../career/calendar/engine.ts";
import { evaluateRule, type ParticipantFacts } from "../../career/calendar/eligibility.ts";
import { generateSeason } from "../../career/calendar/generation.ts";
import { catalogueFor } from "../../career/calendar/catalogue.ts";
import { createCareerCalendarService } from "../../career/calendar/service.ts";
import { CHAMPIONS_CUP_KEY, CHAMPIONS_CUP_WEEK, championsCupFeederKeys } from "../../career/content/season-v38.ts";
import { prizeForPosition, PRIZE_OVERRIDES, FEE_OVERRIDES } from "../../career/finance/config.ts";

/** Routes back (event database v38): the Grassroots Champions Cup and the Road to the Tour's routes-back view. */
const pg = new PGlite(), db = drizzle(pg);
const saves = createCareerService(db), career = createCareerSportingService(db), calendar = createCareerCalendarService(db);
const actor = { playerId: 1 };

before(async () => {
  await pg.exec(`CREATE TABLE players (id INTEGER PRIMARY KEY); INSERT INTO players VALUES (1);
    CREATE TABLE feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);
    INSERT INTO feature_flags VALUES ('tour_career_2', true, false, 'test')`);
  for (const m of [createCareerSaves, createCareerWorld, createCareerSponsorshipFoundation, createCareerNpcSponsorMarketSPF, createCareerCalendar, createCareerFinance,
    createCareerSponsorJourneysSPB, createCareerSponsorJourneysSPB3, createCareerFinanceSPC, createCareerSponsorHQSPD, createCareerSponsorContractActionsSPE2, createCareerSporting, createShadowObservations]) await m(db);
  await repairCareerSchema(db);
});
after(async () => { await pg.close(); });

async function newSave(slot: number, version?: number) {
  const id = (await saves.create(1, { slot, careerName: `Routes back ${slot}`, dateOfBirth: "1990-03-10" })).id;
  if (version) await db.execute(sql`UPDATE career_saves SET event_database_version = ${version} WHERE id = ${id}`);
  await career.initialize(actor, id);
  return id;
}
const cups = async (id: string) => (await db.execute(sql`SELECT start_week, event_database_version, status, snapshot FROM career_event_instances
  WHERE career_save_id = ${id} AND definition_key = ${CHAMPIONS_CUP_KEY}`)).rows as any[];
const facts = (over: Partial<ParticipantFacts> = {}): ParticipantFacts => ({ key: "HUMAN", kind: "HUMAN", country: "GBR", zone: "UK_IRELAND", locality: "ayrshire",
  professionalStatus: "AMATEUR", tourCard: false, rankings: {}, entitlementTargets: new Set(), invited: false,
  results: { SAME: new Map(), PREVIOUS: new Map() }, defendingChampion: false, ...over });

test("v38 Champions Cup: local, club and county champions without a card; finalists skip Q-School First Stage", () => {
  const cup = catalogueFor(38).find(d => d.key === CHAMPIONS_CUP_KEY)!;
  assert.ok(cup, "the Cup is in v38");
  assert.ok(!catalogueFor(37).some(d => d.key === CHAMPIONS_CUP_KEY), "earlier editions are unchanged");
  assert.equal(catalogueFor(38).length, catalogueFor(37).length + 1);
  const feeders = championsCupFeederKeys(catalogueFor(38));
  for (const key of ["free-entry-night", "monday-league-night", "county-championship", "friday-night-501"]) assert.ok(feeders.includes(key), key);
  assert.ok(!feeders.includes("challenger-event") && !feeders.includes("pro-circuit-championship"));
  const won = new Map([["monday-league-night", 1]]), runnerUp = new Map([["monday-league-night", 2]]);
  assert.equal(evaluateRule(cup.eligibility, facts()).eligible, false, "no title, no place");
  assert.equal(evaluateRule(cup.eligibility, facts({ results: { SAME: won, PREVIOUS: new Map() } })).eligible, true, "a local champion is in");
  assert.equal(evaluateRule(cup.eligibility, facts({ results: { SAME: runnerUp, PREVIOUS: new Map() } })).eligible, false, "runner-up is not a champion");
  assert.equal(evaluateRule(cup.eligibility, facts({ results: { SAME: new Map(), PREVIOUS: won } })).eligible, false, "last season's titles don't count");
  assert.equal(evaluateRule(cup.eligibility, facts({ tourCard: true, results: { SAME: won, PREVIOUS: new Map() } })).eligible, false, "card holders are out");
  assert.deepEqual(cup.qualificationOutputs.map(o => [o.targetKey, o.maxPosition, o.targetSeason]),
    [["q-school-final:UK_IRELAND", 2, "NEXT"], ["q-school-final:EUROPE", 2, "NEXT"], ["challenger-tour", 8, "NEXT"]]);
  assert.equal(FEE_OVERRIDES[CHAMPIONS_CUP_KEY].entryFeePence, 0, "free to enter");
  assert.equal(prizeForPosition(PRIZE_OVERRIDES[CHAMPIONS_CUP_KEY], 1), 200000);
  const drafts = generateSeason("c".repeat(64), 38, 1).filter(d => d.definitionKey === CHAMPIONS_CUP_KEY);
  assert.deepEqual(drafts.map(d => d.startWeek), [CHAMPIONS_CUP_WEEK]);
});

test("a new Career has the Cup on its calendar; an older Career gets it from the next week, once", async () => {
  const fresh = await newSave(1);
  assert.deepEqual((await cups(fresh)).map(r => [r.start_week, r.event_database_version]), [[CHAMPIONS_CUP_WEEK, CURRENT_EVENT_DATABASE_VERSION]]);

  const old = await newSave(2, 37);
  assert.equal((await cups(old)).length, 0, "a v37 season has no Cup");
  await calendar.calendar(actor, old, { fromWeek: 1, toWeek: 2 });
  assert.deepEqual((await cups(old)).map(r => r.start_week), [CHAMPIONS_CUP_WEEK], "added by the catalogue upgrade");
  const [root] = (await db.execute(sql`SELECT event_database_version FROM career_saves WHERE id = ${old}`)).rows;
  assert.equal(Number(root.event_database_version), CURRENT_EVENT_DATABASE_VERSION, "on the current catalogue");
  await calendar.calendar(actor, old, { fromWeek: 1, toWeek: 2 });
  assert.equal((await cups(old)).length, 1, "idempotent");
});

test("Road to the Tour: routes back after a lost card, Cup titles and the Final Stage exemption", async () => {
  const id = await newSave(3);
  let view = await career.pathways(actor, id);
  assert.equal(view.routesBack.lostCard, null);
  assert.equal(view.routesBack.championsCup.offered, true);
  assert.equal(view.routesBack.championsCup.eligible, false);
  assert.equal(view.routesBack.championsCup.next?.week, CHAMPIONS_CUP_WEEK);

  // A local title this season: the Cup is open.
  const night = (await db.execute(sql`SELECT id, name FROM career_event_instances WHERE career_save_id = ${id} AND season = 1 AND definition_key = 'monday-league-night' LIMIT 1`)).rows[0];
  await db.execute(sql`INSERT INTO career_event_entries (career_save_id, event_id, participant_key, participant_kind, npc_id, source, status, entered_season, entered_week)
    VALUES (${id}, ${night.id}, ${HUMAN}, 'HUMAN', NULL, 'HUMAN_ENTRY', 'CONFIRMED', 1, 1)`);
  await db.execute(sql`INSERT INTO career_event_results (career_save_id, event_id, participant_key, participant_kind, npc_id, season, definition_key, finishing_position, stage_reached,
      is_champion, matches_played, wins, losses, legs_for, legs_against, metadata)
    VALUES (${id}, ${night.id}, ${HUMAN}, 'HUMAN', NULL, 1, 'monday-league-night', 1, 'CHAMPION', true, 4, 4, 0, 12, 3, '{}'::jsonb)`);
  view = await career.pathways(actor, id);
  assert.equal(view.routesBack.championsCup.eligible, true);
  assert.deepEqual(view.routesBack.championsCup.titles, [String(night.name)]);

  // A Tour Card that has been lost: the routes back appear, with the card loser's Final Stage place.
  await db.execute(sql`INSERT INTO career_tour_cards (career_save_id, id, operation_key, participant_key, participant_kind, source, source_detail, awarded_season, awarded_week,
      start_season, end_season, status, end_reason, ended_season, ended_week, tour_card_rules_version)
    VALUES (${id}, gen_random_uuid(), 'test:lost', ${HUMAN}, 'HUMAN', 'Q_SCHOOL_DIRECT', '{}'::jsonb, 0, 4, 0, 0, 'LOST', 'OUTSIDE_RETENTION', 1, 1, 3)`);
  await db.transaction(tx => insertEntitlements(tx, id, 1, [{ id: randomUUID(), idempotency_key: "test:card-loser", recipient_key: HUMAN, recipient_kind: "HUMAN", npc_id: null,
    entitlement_type: "STAGE_ENTRY", source_event_id: null, source_position: null, source_detail: { reason: "CARD_LOSER" }, target_key: "q-school-final:UK_IRELAND",
    target_season: 1, consumption: "SEASON_PASS" }], "PROVIDER"));
  view = await career.pathways(actor, id);
  assert.deepEqual(view.routesBack.lostCard, { season: 1, reason: "OUTSIDE_RETENTION" });
  assert.equal(view.routesBack.finalStageExempt, true);
});
