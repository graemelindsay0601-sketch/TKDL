/** Money matches at your club: haggle over the stake, the stake moves through the ledger, once per member a week, never for money you have not got. */
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
import { MONEY, appetiteFor, oddsFor, replyTo, weeklyChallenge, willingFor } from "../../career/money/model.ts";

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

test("rules: what members will risk, how much of it by who they think wins, and how they answer an offer", () => {
  const amateur = (average: number | null) => appetiteFor(SEED, 1, { key: "m1", professional: false, average });
  assert.ok(amateur(35) >= 8000 && amateur(35) <= 12500 && amateur(65) >= 40000 && amateur(65) <= 62500, `club amateurs risk £100–£500 (${amateur(35)}, ${amateur(65)})`);
  assert.ok(appetiteFor(SEED, 1, { key: "m1", professional: true, average: 80 }) >= 200000, "a top professional will play for thousands");
  assert.equal(amateur(50), amateur(50), "the same all season");
  assert.equal(amateur(50) % 500, 0, "in £5 steps");
  assert.equal(willingFor(40000, "UNDERDOG"), 40000, "if they fancy it they'll put it all up");
  assert.equal(willingFor(40000, "EVEN"), 24000);
  assert.equal(willingFor(40000, "FAVOURITE"), 12000, "an underdog risks a third");
  const line = (k: string) => k;
  assert.equal(replyTo(10000, 24000, "EVEN", 1, line).kind, "ACCEPT");
  assert.deepEqual([replyTo(30000, 24000, "EVEN", 1, line).kind, replyTo(30000, 24000, "EVEN", 1, line).pence], ["COUNTER", 24000], "too rich: their figure");
  assert.equal(replyTo(30000, 24000, "EVEN", MONEY.asks, line).kind, "WALK", "push once too often and they walk");
  assert.deepEqual([replyTo(1000, 40000, "UNDERDOG", 1, line).kind, replyTo(1000, 40000, "UNDERDOG", 1, line).pence], ["RAISE", 20000], "a favourite offered peanuts asks for more");
  assert.equal(replyTo(1000, 40000, "UNDERDOG", 2, line).kind, "ACCEPT", "but takes it if you insist");
  assert.equal(oddsFor(55, 50), "FAVOURITE"); assert.equal(oddsFor(50, 52), "EVEN"); assert.equal(oddsFor(45, 50), "UNDERDOG"); assert.equal(oddsFor(45, null), "UNKNOWN");
  const members = Array.from({ length: 6 }, (_, i) => ({ key: `m${i}`, professional: false, willing: 20000 }));
  const weeks = Array.from({ length: 52 }, (_, w) => weeklyChallenge(SEED, 1, w + 1, members, 30000));
  assert.ok(weeks.some(Boolean) && weeks.some(c => !c), "some weeks bring a challenge, some do not");
  assert.ok(weeks.every(c => !c || (c.stakePence <= 20000 && c.stakePence >= 10000)), "they open with some of what they'd risk");
  assert.ok(Array.from({ length: 52 }, (_, w) => weeklyChallenge(SEED, 1, w + 1, members, 400)).every(c => c === null), "nobody challenges you for money you have not got");
});

test("haggle, shake on it, play: the agreed stake moves through the ledger", async () => {
  const view = await money.read(actor, id);
  assert.ok(view.club && view.members.length >= 2, `club members to play: ${view.members.length}`);
  const member = view.members[0];
  // Too much for anyone at the club: they come back with their figure.
  const first = (await money.offer(actor, id, { opponentKey: member.key, stakePence: 20000 })).members.find(m => m.key === member.key)!;
  const talk = first.talk!;
  assert.equal(talk.log.length, 2);
  assert.equal(talk.log[0].who, "YOU"); assert.equal(talk.log[1].who, "THEM");
  let stake: number;
  if (talk.status === "AGREED") stake = talk.agreedPence!;
  else { assert.equal(talk.status, "OPEN"); assert.ok(talk.theirOfferPence! > 0 && talk.theirOfferPence! < 20000); stake = talk.theirOfferPence!; }
  await assert.rejects(money.play(actor, id, { opponentKey: member.key, stakePence: stake + 500 }), (e: { status: number }) => e.status === 409, "only the stake you both agreed");
  const before = await balance();
  const { match, created } = await money.play(actor, id, { opponentKey: member.key, stakePence: stake });
  assert.equal(created, true); assert.equal(match.stakePence, stake);
  assert.equal(Math.max(...match.legs!), (MONEY.bestOf + 1) / 2, "first to four legs");
  assert.equal(await balance(), before + (match.won ? stake : -stake));
  const entry = (await db.execute(sql`SELECT category, amount_pence FROM career_finance_entries WHERE career_save_id=${id} AND operation_key=${`money-match:${match.id}`}`)).rows[0];
  assert.deepEqual([entry.category, Number(entry.amount_pence)], match.won ? ["MONEY_MATCH_WIN", stake] : ["MONEY_MATCH_STAKE", -stake]);
  const again = await money.play(actor, id, { opponentKey: member.key, stakePence: stake });
  assert.equal(again.created, false, "pressing play again moves no more money");
  await assert.rejects(money.offer(actor, id, { opponentKey: member.key, stakePence: 500 }), (e: { status: number }) => e.status === 409, "settled for the week");
  const after = await money.read(actor, id);
  assert.equal(after.record.played, 1);
  assert.equal(after.members.find(m => m.key === member.key)!.talk!.status, "AGREED");
});

test("offers must be whole pounds you have free, and push too often and they walk away", async () => {
  // The test before stakes everything on one game: start with money whichever way it went.
  await db.execute(sql`UPDATE career_saves SET balance_pence = 20000 WHERE id = ${id}`);
  const member = (await money.read(actor, id)).members.find(m => !m.thisWeek && !m.talk)!;
  await assert.rejects(money.offer(actor, id, { opponentKey: member.key, stakePence: 250 }), (e: { status: number }) => e.status === 400);
  await assert.rejects(money.offer(actor, id, { opponentKey: member.key, stakePence: 1050 }), (e: { status: number }) => e.status === 400);
  await assert.rejects(money.offer(actor, id, { opponentKey: member.key, stakePence: 10_000_000 }), (e: { status: number }) => e.status === 409);
  await assert.rejects(money.offer(actor, id, { opponentKey: "00000000-0000-4000-8000-000000000000", stakePence: 500 }), (e: { status: number }) => e.status === 404);
  const free = await balance();
  let talk = null;
  for (let i = 0; i < MONEY.asks && talk?.status !== "AGREED"; i++)
    talk = (await money.offer(actor, id, { opponentKey: member.key, stakePence: Math.floor(free / 100) * 100 })).members.find(m => m.key === member.key)!.talk;
  if (talk!.status !== "AGREED") {
    assert.equal(talk!.status, "WALKED", "three asks above their figure and they walk away");
    assert.equal(talk!.asksLeft, 0);
    await assert.rejects(money.offer(actor, id, { opponentKey: member.key, stakePence: 500 }), (e: { status: number }) => e.status === 409);
  }
});

test("a challenge comes with their price: play it, or turn it down and it stays turned down", async () => {
  // The test before stakes everything on one game: start with money whichever way it went.
  await db.execute(sql`UPDATE career_saves SET balance_pence = 20000 WHERE id = ${id}`);
  let declined = false, played = false;
  for (let week = 20; week <= 45 && !(declined && played); week++) {
    await db.execute(sql`UPDATE career_saves SET current_week = ${week} WHERE id = ${id}`);
    const v = await money.read(actor, id);
    if (!v.challenge) continue;
    assert.ok(v.challenge.stakePence <= v.availablePence && v.challenge.stakePence >= MONEY.minimumPence);
    if (!declined) {
      const after = await money.decline(actor, id);
      assert.equal(after.challenge, null); assert.equal((await money.read(actor, id)).challenge, null);
      declined = true;
    } else {
      const { match } = await money.play(actor, id, { opponentKey: v.challenge.opponentKey, stakePence: v.challenge.stakePence });
      assert.equal(match.origin, "THEY_CHALLENGED"); assert.equal(match.stakePence, v.challenge.stakePence);
      played = true;
    }
  }
  assert.ok(declined && played, "found challenges to turn down and to play");
});

test("a brand-new player is left to settle in: no challenge in the opening weeks before their first event", async () => {
  await db.execute(sql`UPDATE career_saves SET balance_pence = 20000, current_season = 1 WHERE id = ${id}`);
  assert.equal((await db.execute(sql`SELECT COUNT(*)::int AS n FROM career_event_results WHERE career_save_id = ${id} AND participant_key = 'HUMAN'`)).rows[0].n, 0);
  for (let week = 1; week <= MONEY.settleInWeeks; week++) {
    await db.execute(sql`UPDATE career_saves SET current_week = ${week} WHERE id = ${id}`);
    assert.equal((await money.read(actor, id)).challenge, null, `week ${week}`);
  }
});
