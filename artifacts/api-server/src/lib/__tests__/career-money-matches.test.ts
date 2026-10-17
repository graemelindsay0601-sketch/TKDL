/** Money matches at your club: the stake moves through the ledger, once per member a week, never for money you have not got. */
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
import { createCareerMoneyService } from "../../career/money/service.ts";
import { MONEY, oddsFor, stakesFor, weeklyChallenge } from "../../career/money/model.ts";

const pg = new PGlite(), db = drizzle(pg);
const saves = createCareerService(db), career = createCareerSportingService(db), money = createCareerMoneyService(db);
const actor = { playerId: 1 };
let id = "";
const SEED = "a".repeat(64);
const balance = async () => Number((await db.execute(sql`SELECT balance_pence FROM career_saves WHERE id=${id}`)).rows[0].balance_pence);

before(async () => {
  await pg.exec(`CREATE TABLE players (id INTEGER PRIMARY KEY); INSERT INTO players VALUES (1);
    CREATE TABLE feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);
    INSERT INTO feature_flags VALUES ('tour_career_2', true, false, 'test')`);
  for (const m of [createCareerSaves, createCareerWorld, createCareerSponsorshipFoundation, createCareerNpcSponsorMarketSPF, createCareerCalendar, createCareerFinance,
    createCareerSponsorJourneysSPB, createCareerSponsorJourneysSPB3, createCareerFinanceSPC, createCareerSponsorHQSPD, createCareerSponsorContractActionsSPE2, createCareerSporting, createShadowObservations]) await m(db);
  await repairCareerSchema(db);
  id = (await saves.create(1, { slot: 1, careerName: "Money man", dateOfBirth: "1990-03-02", homeLocality: "ayrshire" })).id;
  await career.initialize(actor, id);
  await db.execute(sql`UPDATE career_saves SET balance_pence = 20000 WHERE id = ${id}`);
});
after(async () => { await pg.close(); });

test("rules: stakes a member will play for, odds from averages, and a weekly challenge that never asks for money you have not got", () => {
  assert.deepEqual(stakesFor(false, 100000), [500, 1000, 2000, 5000]);
  assert.deepEqual(stakesFor(true, 100000), MONEY.stakes);
  assert.deepEqual(stakesFor(false, 1500), [500, 1000]);
  assert.equal(oddsFor(55, 50), "FAVOURITE"); assert.equal(oddsFor(50, 52), "EVEN"); assert.equal(oddsFor(45, 50), "UNDERDOG");
  const members = Array.from({ length: 6 }, (_, i) => ({ key: `m${i}`, professional: false }));
  const weeks = Array.from({ length: 52 }, (_, w) => weeklyChallenge(SEED, 1, w + 1, members, 3000));
  assert.ok(weeks.some(Boolean) && weeks.some(c => !c), "some weeks bring a challenge, some do not");
  assert.ok(weeks.every(c => !c || c.stakePence <= 3000));
  assert.deepEqual(weeklyChallenge(SEED, 1, 9, members, 3000), weeklyChallenge(SEED, 1, 9, members, 3000), "the same week always brings the same challenge");
  assert.ok(Array.from({ length: 52 }, (_, w) => weeklyChallenge(SEED, 1, w + 1, members, 100)).every(c => c === null), "nobody challenges you for money you have not got");
});

test("a money match is played against a club member and the stake moves through the ledger", async () => {
  const view = await money.read(actor, id);
  assert.ok(view.club && view.members.length >= 2, `club members to play: ${view.members.length}`);
  assert.equal(view.availablePence, 20000);
  const member = view.members[0], stake = member.stakes[member.stakes.length - 1];
  const before = await balance();
  const { match, created } = await money.play(actor, id, { opponentKey: member.key, stakePence: stake });
  assert.equal(created, true); assert.equal(match.status, "PLAYED");
  assert.equal(Math.max(...match.legs!), (MONEY.bestOf + 1) / 2, "first to four legs");
  assert.equal(await balance(), before + (match.won ? stake : -stake));
  const entry = (await db.execute(sql`SELECT category, headline, amount_pence FROM career_finance_entries WHERE career_save_id=${id} AND operation_key=${`money-match:${match.id}`}`)).rows[0];
  assert.deepEqual([entry.category, entry.headline, Number(entry.amount_pence)], match.won ? ["MONEY_MATCH_WIN", "EARNINGS", stake] : ["MONEY_MATCH_STAKE", "EXPENSE", -stake]);
  // Pressing play again returns the match already played and moves no more money.
  const again = await money.play(actor, id, { opponentKey: member.key, stakePence: stake });
  assert.equal(again.created, false); assert.equal(again.match.id, match.id);
  assert.equal(await balance(), before + (match.won ? stake : -stake));
  await assert.rejects(money.play(actor, id, { opponentKey: member.key, stakePence: 500 }), (e: { status: number }) => e.status === 409);
  const after = await money.read(actor, id);
  assert.equal(after.playedThisWeek, 1);
  assert.deepEqual(after.record, { played: 1, won: match.won ? 1 : 0, netPence: match.won ? stake : -stake });
  assert.equal(after.members.find(m => m.key === member.key)!.thisWeek!.id, match.id);
});

test("stakes are limited to what they will play for and what you have free, and three a week", async () => {
  const view = await money.read(actor, id);
  const amateur = view.members.find(m => !m.professional && !m.thisWeek)!;
  await assert.rejects(money.play(actor, id, { opponentKey: amateur.key, stakePence: 25000 }), (e: { status: number }) => e.status === 409);
  await assert.rejects(money.play(actor, id, { opponentKey: "00000000-0000-4000-8000-000000000000", stakePence: 500 }), (e: { status: number }) => e.status === 404);
  await db.execute(sql`UPDATE career_saves SET balance_pence = 700 WHERE id = ${id}`);
  await assert.rejects(money.play(actor, id, { opponentKey: amateur.key, stakePence: 1000 }), (e: { status: number }) => e.status === 409);
  await db.execute(sql`UPDATE career_saves SET balance_pence = 20000 WHERE id = ${id}`);
  const free = (await money.read(actor, id)).members.filter(m => !m.thisWeek);
  for (const m of free.slice(0, MONEY.perWeek - 1)) await money.play(actor, id, { opponentKey: m.key, stakePence: 500 });
  const full = await money.read(actor, id);
  assert.equal(full.playedThisWeek, MONEY.perWeek);
  assert.equal(full.challenge, null, "no challenge once you have played your three");
  const left = full.members.find(m => !m.thisWeek);
  if (left) await assert.rejects(money.play(actor, id, { opponentKey: left.key, stakePence: 500 }), (e: { status: number }) => e.status === 409);
});

test("a challenge can be turned down, and it stays turned down", async () => {
  // Find a week with a challenge by moving the Career's clock (no matches played in these weeks yet).
  for (let week = 20; week <= 40; week++) {
    await db.execute(sql`UPDATE career_saves SET current_week = ${week} WHERE id = ${id}`);
    const v = await money.read(actor, id);
    if (!v.challenge) continue;
    assert.ok(v.challenge.stakePence <= v.availablePence);
    const declined = await money.decline(actor, id);
    assert.equal(declined.challenge, null);
    assert.equal((await money.read(actor, id)).challenge, null);
    assert.equal(declined.record.played, (await money.read(actor, id)).record.played, "declining plays nothing");
    return;
  }
  assert.fail("no challenge in twenty weeks");
});
