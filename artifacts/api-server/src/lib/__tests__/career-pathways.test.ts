/** The v15 midweek pub circuit: Monday League and Wednesday Flier nights, for new Careers and added to existing ones. */
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
import { ensureSeason, HUMAN, type RootRow } from "../../career/calendar/engine.ts";
import { generateSeason } from "../../career/calendar/generation.ts";
import { CHALLENGER_QUALIFIER_KEY, CHALLENGER_QUALIFIER_WEEKS, PRO_CIRCUIT_RULE } from "../../career/content/season-v17.ts";
import { awardCard, cardHoldersIn } from "../../career/sporting/cards.ts";
import { decideOffer, acceptLapsedOffers } from "../../career/sporting/offers.ts";
import { awardBreakoutPlaces } from "../../career/sporting/breakout.ts";

/** Pathways (event database v17): every route stays open — Q-School in season 1, Challenger qualifiers, card offers, Worlds breakout places. */
const pg = new PGlite(), db = drizzle(pg);
const saves = createCareerService(db), career = createCareerSportingService(db);
const actor = { playerId: 1 };

before(async () => {
  await pg.exec(`CREATE TABLE players (id INTEGER PRIMARY KEY); INSERT INTO players VALUES (1), (2);
    CREATE TABLE feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);
    INSERT INTO feature_flags VALUES ('tour_career_2', true, false, 'test')`);
  for (const m of [createCareerSaves, createCareerWorld, createCareerSponsorshipFoundation, createCareerNpcSponsorMarketSPF, createCareerCalendar, createCareerFinance,
    createCareerSponsorJourneysSPB, createCareerSponsorJourneysSPB3, createCareerFinanceSPC, createCareerSponsorHQSPD, createCareerSponsorContractActionsSPE2, createCareerSporting, createShadowObservations]) await m(db);
  await repairCareerSchema(db);
});
after(async () => { await pg.close(); });

async function newSave(n: number, version?: number) {
  // Three slots per player: saves 1–3 belong to player 1, 4–6 to player 2.
  const player = n <= 3 ? 1 : 2, slot = ((n - 1) % 3) + 1;
  const id = (await saves.create(player, { slot, careerName: `Pathways ${n}`, dateOfBirth: "1996-06-15" })).id;
  if (version) await db.execute(sql`UPDATE career_saves SET event_database_version = ${version} WHERE id = ${id}`);
  await career.initialize({ playerId: player }, id);
  return id;
}
const actorOf = (n: number) => ({ playerId: n <= 3 ? 1 : 2 });
const root = async (id: string) => (await db.execute(sql`SELECT * FROM career_saves WHERE id = ${id}`)).rows[0] as RootRow;
const instances = async (id: string, season: number, key: string) => (await db.execute(sql`SELECT start_week, status, snapshot FROM career_event_instances
  WHERE career_save_id = ${id} AND season = ${season} AND definition_key = ${key} ORDER BY start_day`)).rows as any[];
const freeNpcs = async (id: string, n: number) => (await db.execute(sql`SELECT p.id FROM career_world_players p WHERE p.career_save_id = ${id} AND p.status = 'ACTIVE'
  AND NOT EXISTS (SELECT 1 FROM career_tour_cards c WHERE c.career_save_id = p.career_save_id AND c.participant_key = p.id::text AND c.status = 'ACTIVE') ORDER BY p.world_key LIMIT ${n}`)).rows.map(r => String(r.id));

test("v17: Q-School is open in season 1; Challenger qualifiers run from season 2 and pass the last 16", async () => {
  const seed = "a".repeat(64);
  assert.ok(generateSeason(seed, 17, 1).some(d => d.snapshot.qSchool?.stage === "FIRST"), "season-1 Q-School");
  assert.ok(!generateSeason(seed, 16, 1).some(d => d.circuit === "Q_SCHOOL"), "older editions keep their establishment season");
  assert.ok(!generateSeason(seed, 17, 1).some(d => d.definitionKey === CHALLENGER_QUALIFIER_KEY), "season-1 Challenger Tour is open to all");
  const q = generateSeason(seed, 17, 2).filter(d => d.definitionKey === CHALLENGER_QUALIFIER_KEY);
  assert.deepEqual(q.map(d => d.startWeek), [...CHALLENGER_QUALIFIER_WEEKS]);
  assert.deepEqual(q[0].snapshot.eligibility, { type: "NON_TOUR_CARD" });
  assert.deepEqual(q[0].snapshot.qualificationOutputs.map(o => [o.targetKey, o.maxPosition]), [["challenger-tour", 16]]);
  const pro = generateSeason(seed, 17, 2).find(d => d.definitionKey === "pro-circuit-championship")!;
  assert.deepEqual(pro.snapshot.eligibility, PRO_CIRCUIT_RULE);

  const id = await newSave(1);
  assert.ok((await instances(id, 1, "q-school-first-uk_ireland-d1")).some(r => r.status === "REGISTRATION_OPEN"), "a new player can enter Q-School in week 1");
});

test("older saves get the Challenger qualifiers and Pro Circuit associate rule from their next season (once)", async () => {
  const id = await newSave(2, 16);
  assert.equal((await instances(id, 1, CHALLENGER_QUALIFIER_KEY)).length, 0);
  const r = await root(id);
  await ensureSeason(db as never, r, 2);
  await ensureSeason(db as never, r, 2);
  const q = await instances(id, 2, CHALLENGER_QUALIFIER_KEY);
  assert.deepEqual(q.map(x => Number(x.start_week)), [...CHALLENGER_QUALIFIER_WEEKS], "added once");
  const pro = await instances(id, 2, "pro-circuit-championship");
  assert.ok(pro.length > 0 && pro.every(p => JSON.stringify(p.snapshot.eligibility) === JSON.stringify(PRO_CIRCUIT_RULE)));
});

test("a Tour Card won by the human is an offer: declining keeps them amateur and passes the card down", async () => {
  const id = await newSave(3);
  const r = await root(id);
  const [a, b] = await freeNpcs(id, 2);
  await awardCard(db as never, r, 3, { operationKey: "test:offer:1", participantKey: HUMAN, participantKind: "HUMAN", npcId: null, source: "CHALLENGER_RANKING",
    detail: { list: "challenger", position: 1 }, season: 1, week: 52, startSeason: 2, endSeason: 3,
    reserve: [{ participantKey: a, participantKind: "NPC", npcId: a, position: 3 }, { participantKey: b, participantKind: "NPC", npcId: b, position: 4 }] });
  const offered = (await db.execute(sql`SELECT human_offer FROM career_tour_cards WHERE career_save_id = ${id} AND participant_key = ${HUMAN}`)).rows[0] as any;
  assert.equal(offered.human_offer.status, "PENDING");
  assert.deepEqual(offered.human_offer.decideBy, { season: 2, week: 4 });
  const view = await career.tourCard(actor, id);
  assert.ok(view.offer, "the offer is visible");
  const declined = await career.decideTourCard(actor, id, { decision: "DECLINE" });
  assert.equal(declined.passedTo, a);
  assert.equal(declined.tourCard.offer, null);
  const card = (await db.execute(sql`SELECT status, end_reason FROM career_tour_cards WHERE career_save_id = ${id} AND participant_key = ${HUMAN}`)).rows[0] as any;
  assert.deepEqual([card.status, card.end_reason], ["SURRENDERED", "DECLINED"]);
  assert.ok((await cardHoldersIn(db as never, id, 2)).has(a), "the next in line gets the card");
  assert.ok(!(await cardHoldersIn(db as never, id, 2)).has(HUMAN));
  assert.equal((await db.execute(sql`SELECT COUNT(*)::int n FROM career_sporting_milestones WHERE career_save_id = ${id} AND kind = 'TOUR_CARD_DECLINED'`)).rows[0].n, 1);
  await assert.rejects(() => career.decideTourCard(actor, id, { decision: "DECLINE" }), /no Tour Card offer/);
});

test("an accepted offer (or one left past its decide-by week) is for keeps", async () => {
  const id = await newSave(4);
  const r = await root(id);
  const [a] = await freeNpcs(id, 1);
  await awardCard(db as never, r, 3, { operationKey: "test:offer:2", participantKey: HUMAN, participantKind: "HUMAN", npcId: null, source: "Q_SCHOOL_DIRECT",
    detail: { pathway: "UK_IRELAND" }, season: 1, week: 3, startSeason: 1, endSeason: 2, reserve: [{ participantKey: a, participantKind: "NPC", npcId: a, position: 2 }] });
  await acceptLapsedOffers(db as never, id, 1, 4);
  assert.ok((await career.tourCard(actorOf(4), id)).offer, "still open in its decide-by week");
  await acceptLapsedOffers(db as never, id, 1, 5);
  assert.equal((await career.tourCard(actorOf(4), id)).offer, null);
  await assert.rejects(() => career.decideTourCard(actorOf(4), id, { decision: "DECLINE" }), /no Tour Card offer/);
  assert.ok((await cardHoldersIn(db as never, id, 1)).has(HUMAN));
});

test("Worlds breakout places: a big year below the Tour earns a Palace entry, once a season", async () => {
  const id = await newSave(5);
  const r = await root(id);
  const [n1, n2, n3] = await freeNpcs(id, 3);
  const rank = async (list: string, key: string, kind: string, npc: string | null, pos: number) => db.execute(sql`INSERT INTO career_ranking_participants
    (career_save_id, list_key, participant_key, participant_kind, npc_id, current_position, career_high_position, career_high_index, first_ranked_index, updated_index)
    VALUES (${id}, ${list}, ${key}, ${kind}, ${npc}, ${pos}, ${pos}, 1, 1, 1) ON CONFLICT DO NOTHING`);
  await rank("development", HUMAN, "HUMAN", null, 1);
  await rank("development", n1, "NPC", n1, 2);
  await rank("development", n2, "NPC", n2, 3);
  await rank("vault", n3, "NPC", n3, 1);
  assert.deepEqual(await awardBreakoutPlaces(db as never, r, 1, 43), [], "not before week 44");
  const places = await awardBreakoutPlaces(db as never, r, 1, 44);
  assert.deepEqual(places.map(p => [p.participantKey, p.route]).sort(), [[HUMAN, "DEVELOPMENT_RANKING"], [n1, "DEVELOPMENT_RANKING"], [n3, "VAULT_RANKING"]].sort());
  const mine = (await db.execute(sql`SELECT target_key, target_season FROM career_qualification_entitlements WHERE career_save_id = ${id} AND recipient_key = ${HUMAN}
    AND target_key = 'world-championship'`)).rows;
  assert.equal(mine.length, 1);
  assert.equal((await db.execute(sql`SELECT COUNT(*)::int n FROM career_sporting_milestones WHERE career_save_id = ${id} AND kind = 'WORLDS_BREAKOUT_PLACE'`)).rows[0].n, 3);
  assert.deepEqual(await awardBreakoutPlaces(db as never, r, 1, 45), [], "once a season");
});
