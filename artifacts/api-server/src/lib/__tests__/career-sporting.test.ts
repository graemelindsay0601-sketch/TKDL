import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
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
import { createCareerSportingService } from "../../career/sporting/service.ts";
import { post } from "../../career/finance/ledger.ts";
import { prizeForPosition, type PrizeProfile } from "../../career/finance/config.ts";
import { lockRoot } from "../../career/world/service.ts";
import { HARNESS_SEED } from "../../career/world/harness.ts";
import { loadInstances, HUMAN, type InstanceRow, type RootRow } from "../../career/calendar/engine.ts";
import { COUNTRIES, zoneOf } from "../../career/calendar/geography.ts";
import { Q_SCHOOL_PATHWAYS } from "../../career/calendar/eligibility.ts";
import { expiresIndex, timeIndex, rankingList, RANKING_RULES_VERSION, TOUR_CARD_RULES_V1, Q_SCHOOL_RULES_V1, qSchoolPoints } from "../../career/sporting/config.ts";
import { recordRankingContributions, publishRankings, standingsAt, compareStandings } from "../../career/sporting/rankings.ts";
import { awardCard, seasonReview, processRetirements, cardHoldersIn, type CardRow } from "../../career/sporting/cards.ts";
import { allocateQSchool, orderOfMerit, compareOom, type OomEntry } from "../../career/sporting/qschool.ts";
import { boundSeeding, createSportingFactsProvider, selectionTierFor, createSportingHooks } from "../../career/sporting/engine.ts";

const pg = new PGlite();
const db = drizzle(pg);
const saves = createCareerService(db);
const career = createCareerSportingService(db);
const human = { playerId: 1 }, observer = { playerId: 2 }, twin = { playerId: 3 };
const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rows;
const rejectsStatus = (p: Promise<unknown>, status: number) => assert.rejects(p, (e: unknown) => (e as { status?: number }).status === status);
class Rollback extends Error {}
/** Run engine-level work against real persisted state, then roll it all back. */
async function inRollback<T>(actor: { playerId: number }, saveId: string, work: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0], root: RootRow) => Promise<T>): Promise<T> {
  let out: T | undefined;
  await db.transaction(async tx => { out = await work(tx, await lockRoot(tx, actor, saveId) as RootRow); throw new Rollback(); }).catch(e => { if (!(e instanceof Rollback)) throw e; });
  return out as T;
}
async function newCareer(actor: { playerId: number }) {
  const save = await saves.create(actor.playerId, { slot: 1 });
  // Original A5 fixtures retain their published catalogue/NPC universe.
  await db.execute(sql`UPDATE career_saves SET world_seed = ${HARNESS_SEED},event_database_version=1,player_database_version=1 WHERE id = ${save.id}`);
  await career.initialize(actor, save.id);
  return save;
}
const eventsByDef = async (saveId: string, definitionKey: string, season = 1) =>
  (await loadInstancesTx(saveId, sql`season = ${season} AND definition_key = ${definitionKey}`)).sort((a, b) => a.start_day - b.start_day);
async function loadInstancesTx(saveId: string, where: ReturnType<typeof sql>): Promise<InstanceRow[]> { return db.transaction(tx => loadInstances(tx, saveId, where)); }

let opCounter = 0;
type Decide = (m: { definition_key: string; series_day: number | null; round: number; circuit: string }) => boolean;
/** Advance week by week to (season, week); every pending human match is decided by `decide` (harness fixture of live play). */
async function playTo(actor: { playerId: number }, saveId: string, season: number, week: number, tag: string, decide: Decide = () => false) {
  for (let i = 0; i < 400; i++) {
    const r = await saves.read(actor.playerId, saveId);
    if (r.currentSeason > season || (r.currentSeason === season && r.currentWeek >= week)) return;
    const out = await career.calendar.advance(actor, saveId, { operationKey: `${tag}-advance-${opCounter++}`, expectedSeason: r.currentSeason, expectedWeek: r.currentWeek, target: { kind: "WEEKS", weeks: 1 } }) as { stop: { reason: string } };
    if (out.stop.reason !== "HUMAN_MATCH_PENDING") continue;
    for (let guard = 0; guard < 50; guard++) {
      const pending = await rows(sql`SELECT m.id, m.best_of, m.round, i.definition_key, i.series_day, i.circuit FROM career_tournament_matches m
        JOIN career_event_instances i ON i.career_save_id = m.career_save_id AND i.id = m.event_id WHERE m.career_save_id = ${saveId} AND m.status = 'AWAITING_HUMAN' ORDER BY i.start_day, m.round`);
      if (!pending.length) break;
      for (const m of pending) {
        const target = (Number(m.best_of) + 1) / 2, win = decide({ definition_key: String(m.definition_key), series_day: m.series_day === null ? null : Number(m.series_day), round: Number(m.round), circuit: String(m.circuit) });
        await career.calendar.recordHumanMatchResult(actor, saveId, { matchId: String(m.id), humanLegs: win ? target : 0, opponentLegs: win ? 0 : target, humanThrewFirst: true });
      }
    }
  }
  throw new Error("playTo did not reach target");
}
async function enter(actor: { playerId: number }, saveId: string, eventId: string) {
  return career.calendar.enter(actor, saveId, { eventId }) as Promise<{ entered: boolean; denials: string[] }>;
}

let A = "", B = "";                 // A: human Q-School -> Tour Card pathway; B: same seed, human idle (observer)
let beforeCard: Record<string, any>;
let snapshotHashWeek4 = "";
const humanPolicy: Decide = m => m.definition_key.startsWith("q-school-first") ? true
  : m.definition_key.startsWith("q-school-final") ? m.series_day === 1
  : m.circuit === "PRO_CIRCUIT" ? m.round <= 2 : false;

before(async () => {
  await pg.exec(`CREATE TABLE players (id INTEGER PRIMARY KEY); INSERT INTO players VALUES (1), (2), (3), (4);
    CREATE TABLE feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);
    INSERT INTO feature_flags VALUES ('tour_career_2', true, false, 'test')`);
  await createCareerSaves(db); await createCareerWorld(db); await createCareerSponsorshipFoundation(db); await createCareerCalendar(db); await createCareerFinance(db); await createCareerSponsorJourneysSPB(db); await createCareerSponsorJourneysSPB3(db); await createCareerFinanceSPC(db);
  await createCareerSporting(db); await createCareerSporting(db); // idempotent re-run
  A = (await newCareer(human)).id;
  // Test-only funding through the A4 ledger authority (Q-School/Pro Circuit fees and travel are real A4 costs).
  await inRollbackCommit(human, A, (tx, root) => post(tx, root, { operationKey: "adjustment:test-funding", category: "ADJUSTMENT", amountPence: 500000, headline: "START", reason: "test fixture" }));
  const pro = (await eventsByDef(A, "pro-circuit-championship"))[0];
  beforeCard = (await career.qualification(human, A, { eventId: pro.id })).events[0];
  const qFirst = (await eventsByDef(A, "q-school-first-uk_ireland-d1"))[0];
  assert.equal((await enter(human, A, qFirst.id)).entered, true, "human enters UK & Ireland Q-School First Stage");
  await playTo(human, A, 1, 3, "a", humanPolicy);
  const qFinal = (await eventsByDef(A, "q-school-final-uk_ireland-d1"))[0];
  assert.equal((await enter(human, A, qFinal.id)).entered, true, "human holds the Final Stage entitlement from First Stage results");
  await playTo(human, A, 1, 4, "a", humanPolicy);
  snapshotHashWeek4 = await snapshotHash(A, 3); // weeks 1-3 are published at this point
  for (const ev of (await eventsByDef(A, "pro-circuit-championship")).filter(e => e.start_week <= 6)) await enter(human, A, ev.id);
  await playTo(human, A, 1, 7, "a", humanPolicy);
  B = (await newCareer(observer)).id;
  await playTo(observer, B, 1, 7, "b");
});
after(async () => { await pg.close(); });
async function inRollbackCommit<T>(actor: { playerId: number }, saveId: string, work: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0], root: RootRow) => Promise<T>) {
  return db.transaction(async tx => work(tx, await lockRoot(tx, actor, saveId) as RootRow));
}
async function snapshotHash(saveId: string, uptoWeek: number) {
  const r = await rows(sql`SELECT s.list_key, s.publication_index, r.participant_key, r.position, r.value_pence, r.movement, r.career_high_position FROM career_ranking_snapshot_rows r
    JOIN career_ranking_snapshots s ON s.career_save_id = r.career_save_id AND s.id = r.snapshot_id WHERE r.career_save_id = ${saveId} AND s.season = 1 AND s.week <= ${uptoWeek}
    ORDER BY 1, 2, 4`);
  return createHash("sha256").update(JSON.stringify(r)).digest("hex");
}

// ------------------------------------------------------------------ rankings
test("1. ranking contributions are created from A3 results and A4 ranking-eligible prize facts", async () => {
  const contributions = await rows(sql`SELECT c.*, t.bands, t.prize_profile_key, t.ranking_eligible, r.finishing_position AS result_position, i.classification, i.ranking_category AS cat
    FROM career_ranking_contributions c JOIN career_event_prize_tables t ON t.career_save_id = c.career_save_id AND t.event_id = c.event_id
    JOIN career_event_results r ON r.career_save_id = c.career_save_id AND r.event_id = c.event_id AND r.participant_key = c.participant_key
    JOIN career_event_instances i ON i.career_save_id = c.career_save_id AND i.id = c.event_id WHERE c.career_save_id = ${A}`);
  assert.ok(contributions.length > 300, "pro circuit, county, local and Challenger results produced contributions");
  for (const c of contributions) {
    assert.equal(c.ranking_eligible, true); assert.equal(c.classification, "RANKING");
    assert.equal(Number(c.amount_pence), prizeForPosition({ key: String(c.prize_profile_key), bands: c.bands } as PrizeProfile, Number(c.result_position)));
    assert.ok(rankingList(String(c.list_key))!.categories.includes(String(c.cat)));
    assert.equal(c.ranking_rules_version, RANKING_RULES_VERSION);
  }
  const lists = new Set(contributions.map(c => String(c.list_key)));
  for (const l of ["pro-world", "pro-circuit", "amateur"]) assert.ok(lists.has(l), l);
});

test("2. contribution recording is idempotent (event completion hook replayed)", async () => {
  const before = Number((await rows(sql`SELECT COUNT(*)::int n FROM career_ranking_contributions WHERE career_save_id = ${A}`))[0].n);
  const changed = await inRollback(human, A, async (tx, root) => {
    const events = await loadInstances(tx, A, sql`season = 1 AND status = 'COMPLETED' AND classification = 'RANKING'`);
    const hooks = createSportingHooks();
    for (const e of events.slice(0, 25)) {
      const results = (await tx.execute(sql`SELECT participant_key, participant_kind, npc_id, finishing_position, is_champion, legs_for, legs_against FROM career_event_results WHERE career_save_id = ${A} AND event_id = ${e.id}`)).rows as never[];
      await hooks.onEventCompleted(tx, root, e, results);
      await recordRankingContributions(tx, root, RANKING_RULES_VERSION, e, results);
    }
    return Number((await tx.execute(sql`SELECT COUNT(*)::int n FROM career_ranking_contributions WHERE career_save_id = ${A}`)).rows[0].n);
  });
  assert.equal(changed, before);
  assert.equal(Number((await rows(sql`SELECT COUNT(*)::int n FROM (SELECT list_key, event_id, participant_key FROM career_ranking_contributions WHERE career_save_id = ${A} GROUP BY 1,2,3 HAVING COUNT(*) > 1) d`))[0].n), 0);
});

test("3. rolling window: contributions count for exactly the configured window, season lists reset", async () => {
  assert.equal(expiresIndex({ kind: "ROLLING", weeks: 104 }, 10), 114);
  assert.equal(expiresIndex({ kind: "SEASON" }, 10), 53);
  assert.equal(expiresIndex({ kind: "SEASON" }, 52), 53);
  const c = (await rows(sql`SELECT * FROM career_ranking_contributions WHERE career_save_id = ${A} AND list_key = 'pro-world' ORDER BY completion_index LIMIT 1`))[0];
  const C = Number(c.completion_index);
  assert.equal(Number(c.expires_index), C + 104);
  await inRollback(human, A, async (tx, root) => {
    const has = async (P: number) => (await standingsAt(tx, root, 1, "pro-world", P)).some(s => s.participant_key === c.participant_key && s.value >= Number(c.amount_pence));
    assert.equal(await has(C + 103), true, "still counting on the last week of the window");
    const lastWeek = await standingsAt(tx, root, 1, "pro-world", C + 104);
    const total = lastWeek.find(s => s.participant_key === c.participant_key);
    const remaining = Number((await tx.execute(sql`SELECT COALESCE(SUM(amount_pence),0)::bigint s FROM career_ranking_contributions WHERE career_save_id = ${A} AND list_key = 'pro-world'
      AND participant_key = ${c.participant_key} AND completion_index <= ${C + 104} AND expires_index > ${C + 104}`)).rows[0].s);
    assert.equal(total?.value ?? 0, remaining, "expired contribution no longer counts");
    // Expiry publication at P = C + 104 (season 3, week C): a new snapshot records the expiry; earlier history is untouched.
    const before = await snapshotHashTx(tx, A);
    await publishRankings(tx, root, 1, 3, C, false);
    const s = (await tx.execute(sql`SELECT expired_contributions FROM career_ranking_snapshots WHERE career_save_id = ${A} AND list_key = 'pro-world' AND publication_index = ${C + 104}`)).rows[0];
    assert.ok(Number(s.expired_contributions) > 0);
    assert.equal(await snapshotHashTx(tx, A), before);
    // Season-mode list (Challenger) is empty at the first publication of season 2.
    assert.equal((await standingsAt(tx, root, 1, "challenger", timeIndex(2, 1))).length, 0);
  });
});
async function snapshotHashTx(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], saveId: string) {
  const r = (await tx.execute(sql`SELECT snapshot_id, participant_key, position, value_pence FROM career_ranking_snapshot_rows WHERE career_save_id = ${saveId} AND season = 1 ORDER BY 1, 3`)).rows;
  return createHash("sha256").update(JSON.stringify(r)).digest("hex");
}

test("4. ranking order follows value then the documented tie-break hierarchy", async () => {
  const snaps = await rows(sql`SELECT id FROM career_ranking_snapshots WHERE career_save_id = ${A}`);
  for (const s of snaps.slice(0, 40)) {
    const r = await rows(sql`SELECT position, value_pence FROM career_ranking_snapshot_rows WHERE career_save_id = ${A} AND snapshot_id = ${s.id} ORDER BY position`);
    r.forEach((row, i) => { assert.equal(Number(row.position), i + 1); if (i) assert.ok(Number(r[i - 1].value_pence) >= Number(row.value_pence)); });
  }
});

test("5. deterministic ties: hierarchy is explicit, neutral and seed-stable", () => {
  const base = { participant_kind: "NPC", npc_id: null, value: 1000, best: 500, latest: 10, n: 2, tie: "m" };
  const s = (o: Partial<typeof base> & { participant_key: string }) => ({ ...base, ...o });
  const order = (xs: ReturnType<typeof s>[]) => [...xs].sort(compareStandings).map(x => x.participant_key);
  assert.deepEqual(order([s({ participant_key: "a", value: 900 }), s({ participant_key: "b" })]), ["b", "a"]);
  assert.deepEqual(order([s({ participant_key: "a", best: 400 }), s({ participant_key: "b" })]), ["b", "a"]);
  assert.deepEqual(order([s({ participant_key: "a", latest: 9 }), s({ participant_key: "b" })]), ["b", "a"]);
  assert.deepEqual(order([s({ participant_key: "a", n: 3 }), s({ participant_key: "b" })]), ["b", "a"]);
  assert.deepEqual(order([s({ participant_key: "HUMAN", tie: "z" }), s({ participant_key: "b", tie: "c" })]), ["b", "HUMAN"], "human gets no tie preference");
});

test("6. snapshots are complete, unique per publication and never rewritten", async () => {
  const snaps = await rows(sql`SELECT s.*, (SELECT COUNT(*)::int FROM career_ranking_snapshot_rows r WHERE r.career_save_id = s.career_save_id AND r.snapshot_id = s.id) AS n
    FROM career_ranking_snapshots s WHERE s.career_save_id = ${A} ORDER BY list_key, sequence`);
  assert.ok(snaps.length >= 6);
  for (const s of snaps) { assert.equal(s.n, s.participant_count); assert.equal(s.ranking_rules_version, 1); }
  assert.equal(await snapshotHash(A, 3), snapshotHashWeek4, "later publications did not touch earlier snapshots");
  await assert.rejects(db.execute(sql`UPDATE career_ranking_snapshot_rows SET position = position WHERE career_save_id = ${A}`));
  await assert.rejects(db.execute(sql`UPDATE career_ranking_contributions SET amount_pence = amount_pence + 1 WHERE career_save_id = ${A}`));
});

test("7. movement compares authoritative consecutive snapshots", async () => {
  const pairs = await rows(sql`SELECT r.participant_key, r.position, r.previous_position, r.movement, r.is_new, s.sequence, s.list_key,
      (SELECT p.position FROM career_ranking_snapshot_rows p JOIN career_ranking_snapshots ps ON ps.career_save_id = p.career_save_id AND ps.id = p.snapshot_id
        WHERE p.career_save_id = r.career_save_id AND ps.list_key = s.list_key AND ps.sequence = s.sequence - 1 AND p.participant_key = r.participant_key) AS prior
    FROM career_ranking_snapshot_rows r JOIN career_ranking_snapshots s ON s.career_save_id = r.career_save_id AND s.id = r.snapshot_id
    WHERE r.career_save_id = ${A} AND s.list_key = 'pro-world'`);
  assert.ok(pairs.some(p => Number(p.movement) > 0) && pairs.some(p => Number(p.movement) < 0) && pairs.some(p => p.is_new));
  for (const p of pairs) {
    if (p.is_new) { assert.equal(p.previous_position, null); continue; }
    assert.equal(Number(p.previous_position), Number(p.prior)); assert.equal(Number(p.movement), Number(p.prior) - Number(p.position));
  }
});

test("8. career-high ranking is persistent history (minimum position ever published)", async () => {
  const check = await rows(sql`SELECT p.participant_key, p.career_high_position, (SELECT MIN(position) FROM career_ranking_snapshot_rows r WHERE r.career_save_id = p.career_save_id
    AND r.list_key = p.list_key AND r.participant_key = p.participant_key) AS best FROM career_ranking_participants p WHERE p.career_save_id = ${A} AND p.list_key = 'pro-world'`);
  assert.ok(check.length > 50);
  for (const c of check) assert.equal(Number(c.career_high_position), Number(c.best));
  const hist = await career.rankingHistory(human, A, "pro-world", { participant: HUMAN });
  assert.ok(hist.careerHigh && hist.snapshots.length > 0, "human has World Ranking history after Pro Circuit results");
});

test("9. human and NPCs use identical ranking rules (A4 award vs prize table, same lists)", async () => {
  const mine = await rows(sql`SELECT c.*, a.ranking_eligible_pence FROM career_ranking_contributions c JOIN career_prize_awards a ON a.career_save_id = c.career_save_id
    AND a.event_id = c.event_id AND a.participant_key = c.participant_key WHERE c.career_save_id = ${A} AND c.participant_key = ${HUMAN} AND c.list_key = 'pro-world'`);
  assert.ok(mine.length >= 1, "human earned World Ranking money on the Pro Circuit");
  for (const c of mine) {
    assert.equal(c.source, "A4_PRIZE_AWARD"); assert.equal(Number(c.amount_pence), Number(c.ranking_eligible_pence));
    const npcSame = await rows(sql`SELECT amount_pence FROM career_ranking_contributions WHERE career_save_id = ${A} AND event_id = ${c.event_id} AND list_key = 'pro-world'
      AND finishing_position = ${c.finishing_position} AND participant_key <> ${HUMAN}`);
    for (const n of npcSame) assert.equal(Number(n.amount_pence), Number(c.amount_pence), "same finish, same ranking money");
  }
  const lists = await rows(sql`SELECT DISTINCT list_key FROM career_ranking_contributions WHERE career_save_id = ${A} AND event_id = ${mine[0].event_id}`);
  assert.deepEqual(lists.map(l => l.list_key).sort(), ["pro-circuit", "pro-world"]);
  const explain = await career.rankingExplain(human, A, "pro-world", HUMAN);
  assert.equal(explain.explained, true); assert.equal(explain.valuePence, explain.contributionTotalPence);
});

test("10. Specials, exhibitions and qualifiers never create ranking money", async () => {
  const bad = await rows(sql`SELECT COUNT(*)::int n FROM career_ranking_contributions c JOIN career_event_instances i ON i.career_save_id = c.career_save_id AND i.id = c.event_id
    WHERE c.career_save_id = ${A} AND i.classification <> 'RANKING'`);
  assert.equal(bad[0].n, 0);
  const special = (await loadInstancesTx(A, sql`season = 1 AND status = 'COMPLETED' AND classification = 'SPECIAL'`))[0];
  assert.ok(special, "a Special was played");
  const n = await inRollback(human, A, async (tx, root) => {
    const results = (await tx.execute(sql`SELECT participant_key, participant_kind, npc_id, finishing_position, is_champion, legs_for, legs_against FROM career_event_results WHERE career_save_id = ${A} AND event_id = ${special.id}`)).rows as never[];
    return recordRankingContributions(tx, root, 1, { ...special, classification: "SPECIAL" }, results);
  });
  assert.equal(n, 0);
  const qSchool = await rows(sql`SELECT COUNT(*)::int n FROM career_ranking_contributions c JOIN career_event_instances i ON i.career_save_id = c.career_save_id AND i.id = c.event_id
    WHERE c.career_save_id = ${A} AND i.circuit = 'Q_SCHOOL'`);
  assert.equal(qSchool[0].n, 0);
});

test("11. sponsor money, bank balance and expenses are not ranking money", async () => {
  const before = await career.rankingExplain(human, A, "pro-world", HUMAN);
  const after = await inRollback(human, A, async (tx, root) => {
    await post(tx, root, { operationKey: "sponsor-test", category: "SPONSOR_SIGNING_BONUS", amountPence: 9_000_000, reason: "test sponsor" });
    await post(tx, root, { operationKey: "adjustment:test-drain", category: "ADJUSTMENT", amountPence: -100000, headline: "EXPENSE", reason: "test expense" });
    await publishRankings(tx, root, 1, 1, 30, true);
    return (await tx.execute(sql`SELECT current_value_pence FROM career_ranking_participants WHERE career_save_id = ${A} AND list_key = 'pro-world' AND participant_key = ${HUMAN}`)).rows[0];
  });
  assert.equal(Number(after.current_value_pence), before.valuePence);
  const sources = ["config", "rankings", "cards", "qschool", "engine", "state", "service", "router"].map(n => readFileSync(new URL(`../../career/sporting/${n}.ts`, import.meta.url), "utf8")).join("\n");
  assert.ok(!/career_finance_entries|balance_pence[^_]|SPONSOR_/.test(sources.replace(/professional_ranking_money_pence/g, "")), "A5 never reads the ledger, balance or sponsor income");
});

// ------------------------------------------------------------------ Tour Cards
test("12-13. Tour Cards: founding, Q-School awards and their terms", async () => {
  const cards = await rows(sql`SELECT * FROM career_tour_cards WHERE career_save_id = ${A}`);
  const founding = cards.filter(c => c.source === "FOUNDING");
  assert.equal(founding.length, 95, "every generated PROFESSIONAL/ELITE NPC (63 + 32) was already on tour");
  assert.deepEqual([...new Set(founding.map(c => `${c.start_season}-${c.end_season}`))].sort(), ["1-1", "1-2"], "staggered founding terms");
  assert.ok(founding.every(c => c.participant_key !== HUMAN), "the human never receives a founding card");
  const qs = cards.filter(c => String(c.source).startsWith("Q_SCHOOL"));
  assert.ok(qs.length >= 10);
  for (const c of qs) { assert.equal(Number(c.start_season), 1); assert.equal(Number(c.end_season), 1 + TOUR_CARD_RULES_V1.termSeasons - 1); assert.equal(c.tour_card_rules_version, 1); }
  const mine = await career.tourCard(human, A);
  assert.equal(mine.holdsCard, true);
  assert.equal(mine.current!.source, "Q_SCHOOL_DIRECT");
  assert.deepEqual(mine.current!.term, { startSeason: 1, endSeason: 2 });
  assert.equal((await rows(sql`SELECT has_tour_card FROM career_saves WHERE id = ${A}`))[0].has_tour_card, true, "A1 cache follows A5");
  assert.ok((await rows(sql`SELECT 1 FROM career_sporting_milestones WHERE career_save_id = ${A} AND participant_key = ${HUMAN} AND kind = 'TOUR_CARD_WON'`)).length);
});

test("14-15. season review: retention inside the cut, loss outside it, regain later — all persisted", async () => {
  await inRollback(human, A, async (tx, root) => {
    const world = new Map((await tx.execute(sql`SELECT participant_key, current_position FROM career_ranking_participants WHERE career_save_id = ${A} AND list_key = 'pro-world' AND current_position IS NOT NULL`)).rows.map(r => [String(r.participant_key), Number(r.current_position)]));
    const ending = (await tx.execute(sql`SELECT * FROM career_tour_cards WHERE career_save_id = ${A} AND status = 'ACTIVE' AND end_season = 1`)).rows as CardRow[];
    const summary = (await seasonReview(tx, root, 1, 1))!;
    assert.equal(summary.retained + summary.lost, ending.length);
    for (const c of ending) {
      const after = (await tx.execute(sql`SELECT status, end_reason FROM career_tour_cards WHERE career_save_id = ${A} AND id = ${c.id}`)).rows[0];
      const rank = world.get(c.participant_key);
      if (rank !== undefined && rank <= 64) {
        assert.equal(after.status, "EXPIRED");
        const renewed = (await tx.execute(sql`SELECT * FROM career_tour_cards WHERE career_save_id = ${A} AND previous_card_id = ${c.id}`)).rows[0];
        assert.deepEqual([renewed.source, renewed.start_season, renewed.end_season, renewed.status], ["RANKING_RETENTION", 2, 3, "ACTIVE"]);
      } else assert.deepEqual([after.status, after.end_reason], ["LOST", "OUTSIDE_RETENTION_CUT"]);
    }
    const loser = ending.find(c => !(world.get(c.participant_key)! <= 64))!;
    const exemption = (await tx.execute(sql`SELECT * FROM career_qualification_entitlements WHERE career_save_id = ${A} AND recipient_key = ${loser.participant_key} AND target_season = 2`)).rows[0];
    assert.ok(exemption && String(exemption.target_key).startsWith("q-school-final:") && exemption.source_kind === "PROVIDER", "card loser goes straight to next Final Stage");
    assert.equal(await seasonReview(tx, root, 1, 1), null, "review retry is a no-op");
    // Regain: the same sporting route (Q-School) next season, flagged as a comeback.
    const regained = await awardCard(tx, root, 1, { operationKey: `q-school:2:UK_IRELAND:${loser.participant_key}`, participantKey: loser.participant_key, participantKind: "NPC", npcId: loser.npc_id,
      source: "Q_SCHOOL_ORDER_OF_MERIT", detail: { test: true }, season: 2, week: 3, startSeason: 2, endSeason: 3 });
    assert.ok(regained?.created);
    const ms = (await tx.execute(sql`SELECT kind FROM career_sporting_milestones WHERE career_save_id = ${A} AND participant_key = ${loser.participant_key} ORDER BY created_at`)).rows.map(r => r.kind);
    assert.ok(ms.includes("TOUR_CARD_LOST") && ms.includes("TOUR_CARD_REGAINED"));
  });
});

test("16. duplicate / overlapping cards are impossible", async () => {
  const holder = (await rows(sql`SELECT * FROM career_tour_cards WHERE career_save_id = ${A} AND status = 'ACTIVE' LIMIT 1`))[0] as CardRow;
  await inRollback(human, A, async (tx, root) => {
    assert.equal(await awardCard(tx, root, 1, { operationKey: "dup-test", participantKey: holder.participant_key, participantKind: holder.participant_kind, npcId: holder.npc_id,
      source: "CHALLENGER_RANKING", detail: {}, season: 1, week: 7, startSeason: 2, endSeason: 3 }), null);
  });
  await assert.rejects(db.execute(sql`INSERT INTO career_tour_cards (career_save_id, id, operation_key, participant_key, participant_kind, npc_id, source, source_detail, awarded_season, awarded_week,
    start_season, end_season, status, tour_card_rules_version) VALUES (${A}, gen_random_uuid(), 'raw-dup', ${holder.participant_key}, ${holder.participant_kind}, ${holder.npc_id}, 'FOUNDING', '{}'::jsonb, 1, 1, 1, 2, 'ACTIVE', 1)`));
  await assert.rejects(db.execute(sql`UPDATE career_tour_cards SET end_season = end_season + 5 WHERE career_save_id = ${A} AND id = ${holder.id}`), "terms immutable");
  const overlaps = await rows(sql`SELECT participant_key FROM career_tour_cards WHERE career_save_id = ${A} AND status = 'ACTIVE' GROUP BY 1 HAVING COUNT(*) > 1`);
  assert.equal(overlaps.length, 0);
});

// ------------------------------------------------------------------ Q-School
test("17-18. Q-School UK & Ireland and Europe pathways run separately with pathway-correct fields", async () => {
  for (const pathway of ["UK_IRELAND", "EUROPE"] as const) {
    const results = await rows(sql`SELECT q.participant_key, q.stage, p.nationality FROM career_qschool_results q LEFT JOIN career_world_players p ON p.career_save_id = q.career_save_id AND p.id = q.npc_id
      WHERE q.career_save_id = ${A} AND q.season = 1 AND q.pathway = ${pathway}`);
    assert.ok(results.filter(r => r.stage === "FIRST").length > 50 && results.filter(r => r.stage === "FINAL").length > 20, pathway);
    for (const r of results) if (r.participant_key !== HUMAN) assert.ok((Q_SCHOOL_PATHWAYS[pathway].zones as string[]).includes(zoneOf(String(r.nationality))), "pathway zone integrity");
    const alloc = (await rows(sql`SELECT * FROM career_qschool_allocations WHERE career_save_id = ${A} AND season = 1 AND pathway = ${pathway}`))[0];
    assert.ok(alloc, `${pathway} allocated`);
  }
  const both = await rows(sql`SELECT participant_key FROM career_qschool_results WHERE career_save_id = ${A} AND season = 1 GROUP BY 1 HAVING COUNT(DISTINCT pathway) > 1`);
  assert.equal(both.length, 0, "nobody plays both pathways in a season");
  const q = await career.qSchool(human, A, { season: 1 });
  const uk = q.pathways.find(p => p.pathway === "UK_IRELAND")!;
  assert.deepEqual(uk.participant.wonDay, [1]);
  assert.ok(uk.participant.finalStageEntry && uk.participant.firstStage.length === 3);
});

test("19-20. direct day winners and Order of Merit cards match the persisted results", async () => {
  for (const pathway of ["UK_IRELAND", "EUROPE"] as const) {
    const alloc = (await rows(sql`SELECT * FROM career_qschool_allocations WHERE career_save_id = ${A} AND season = 1 AND pathway = ${pathway}`))[0];
    const awards = await rows(sql`SELECT * FROM career_qschool_card_awards WHERE career_save_id = ${A} AND season = 1 AND pathway = ${pathway}`);
    const days = await rows(sql`SELECT series_day, champion_participant_key FROM career_event_instances WHERE career_save_id = ${A} AND season = 1 AND snapshot->'qSchool'->>'pathway' = ${pathway}
      AND snapshot->'qSchool'->>'stage' = 'FINAL' ORDER BY series_day`);
    const distinct = [...new Set(days.map(d => String(d.champion_participant_key)))];
    const direct = awards.filter(a => a.route === "DIRECT");
    assert.deepEqual(direct.map(a => String(a.participant_key)).sort(), distinct.sort());
    assert.equal(Number(alloc.unused_direct_cards), days.length - distinct.length, "repeat winners roll their card into the OoM");
    const oom = awards.filter(a => a.route === "ORDER_OF_MERIT");
    assert.equal(oom.length, Q_SCHOOL_RULES_V1.pathways[pathway].orderOfMeritCards + Number(alloc.unused_direct_cards));
    const recomputed = await inRollback(human, A, (tx, root) => orderOfMerit(tx, root, 1, 1, pathway));
    const expected = recomputed.entries.filter(e => !distinct.includes(e.participantKey) && e.points >= 1).slice(0, oom.length).map(e => e.participantKey);
    assert.deepEqual(oom.sort((a, b) => Number(a.order_of_merit_position) - Number(b.order_of_merit_position)).map(a => String(a.participant_key)), expected);
    for (const e of recomputed.entries) {
      const pts = await rows(sql`SELECT COALESCE(SUM(points),0)::int s FROM career_qschool_results WHERE career_save_id = ${A} AND season = 1 AND pathway = ${pathway} AND stage = 'FINAL' AND participant_key = ${e.participantKey}`);
      assert.equal(e.points, pts[0].s);
    }
  }
  assert.equal(qSchoolPoints(1), 6); assert.equal(qSchoolPoints(9), 2); assert.equal(qSchoolPoints(33), 0);
});

test("21. Q-School Order of Merit tie-breaks are deterministic and documented", () => {
  const base: OomEntry = { participantKey: "x", participantKind: "NPC", npcId: null, points: 5, bestDayFinish: 3, scoringDays: 2, latestDayPoints: 2, legDifference: 4, legsWon: 20, daysPlayed: 4, tieKey: "m", position: 0 };
  const e = (o: Partial<OomEntry>) => ({ ...base, ...o });
  const first = (a: OomEntry, b: OomEntry) => [a, b].sort(compareOom)[0].participantKey;
  assert.equal(first(e({ participantKey: "a", points: 4 }), e({ participantKey: "b" })), "b");
  assert.equal(first(e({ participantKey: "a", bestDayFinish: 5 }), e({ participantKey: "b" })), "b");
  assert.equal(first(e({ participantKey: "a", scoringDays: 1 }), e({ participantKey: "b" })), "b");
  assert.equal(first(e({ participantKey: "a", latestDayPoints: 1 }), e({ participantKey: "b" })), "b");
  assert.equal(first(e({ participantKey: "a", legDifference: 3 }), e({ participantKey: "b" })), "b");
  assert.equal(first(e({ participantKey: "a", legsWon: 19 }), e({ participantKey: "b" })), "b");
  assert.equal(first(e({ participantKey: "HUMAN", tieKey: "z" }), e({ participantKey: "b", tieKey: "a" })), "b", "no human tie preference");
  assert.deepEqual([...Q_SCHOOL_RULES_V1.tieBreaks], ["POINTS_DESC", "BEST_DAY_FINISH_ASC", "SCORING_DAYS_DESC", "LATEST_DAY_POINTS_DESC", "LEG_DIFFERENCE_DESC", "LEGS_WON_DESC", "NEUTRAL_KEY_ASC"]);
});

test("22. Q-School allocation retry never issues duplicate cards", async () => {
  const before = await rows(sql`SELECT COUNT(*)::int n FROM career_tour_cards WHERE career_save_id = ${A}`);
  await inRollback(human, A, async (tx, root) => {
    for (const p of ["UK_IRELAND", "EUROPE"] as const) assert.equal((await allocateQSchool(tx, root, 1, 1, 1, 7, p))!.created, false);
    assert.equal(Number((await tx.execute(sql`SELECT COUNT(*)::int n FROM career_tour_cards WHERE career_save_id = ${A}`)).rows[0].n), before[0].n);
  });
  const dup = await rows(sql`SELECT participant_key FROM career_qschool_card_awards WHERE career_save_id = ${A} GROUP BY season, participant_key HAVING COUNT(*) > 1`);
  assert.equal(dup.length, 0);
});

// ------------------------------------------------------------------ integration
test("23. seeding: A5 supplies the ranked order, A3 locks the draw and later movement never changes it", async () => {
  const seeding = boundSeeding(new Map<string, Record<string, number>>([["a", { "pro-circuit": 3 }], ["b", { "pro-circuit": 1 }], ["c", {}]]));
  assert.deepEqual(seeding.order("pro-circuit", ["a", "b", "c"]), ["b", "a"]);
  const event = (await eventsByDef(A, "pro-circuit-championship")).filter(e => e.start_week === 6)[0];
  const seeds = await rows(sql`SELECT participant_key, draw_seed FROM career_event_entries WHERE career_save_id = ${A} AND event_id = ${event.id} AND draw_seed IS NOT NULL ORDER BY draw_seed`);
  assert.equal(seeds.length, 32);
  const snap = (await rows(sql`SELECT id FROM career_ranking_snapshots WHERE career_save_id = ${A} AND list_key = 'pro-circuit' AND publication_index < ${timeIndex(1, 6)} ORDER BY sequence DESC LIMIT 1`))[0];
  const ranked = new Map((await rows(sql`SELECT participant_key, position FROM career_ranking_snapshot_rows WHERE career_save_id = ${A} AND snapshot_id = ${snap.id}`)).map(r => [String(r.participant_key), Number(r.position)]));
  const entrants = (await rows(sql`SELECT participant_key FROM career_event_entries WHERE career_save_id = ${A} AND event_id = ${event.id} AND status <> 'WITHDRAWN'`)).map(r => String(r.participant_key));
  const expected = entrants.filter(k => ranked.has(k)).sort((a, b) => ranked.get(a)! - ranked.get(b)!).slice(0, 32);
  assert.deepEqual(seeds.map(s => String(s.participant_key)), expected, "seeds follow the published ranking at draw time");
  const draw = await rows(sql`SELECT id, a_key, b_key FROM career_tournament_matches WHERE career_save_id = ${A} AND event_id = ${event.id} AND round = 1 ORDER BY slot`);
  await playTo(human, A, 1, 8, "a23", humanPolicy);
  assert.deepEqual(await rows(sql`SELECT id, a_key, b_key FROM career_tournament_matches WHERE career_save_id = ${A} AND event_id = ${event.id} AND round = 1 ORDER BY slot`), draw);
  assert.deepEqual(await rows(sql`SELECT participant_key, draw_seed FROM career_event_entries WHERE career_save_id = ${A} AND event_id = ${event.id} AND draw_seed IS NOT NULL ORDER BY draw_seed`), seeds);
});

test("24. A3 eligibility consumes A5 Tour Card and ranking facts", async () => {
  assert.equal(beforeCard.eligible, false);
  assert.ok(beforeCard.reasons.includes("REQUIRES_TOUR_CARD"));
  const pro = (await eventsByDef(A, "pro-circuit-championship")).filter(e => e.status !== "COMPLETED")[0];
  const now = (await career.qualification(human, A, { eventId: pro.id })).events[0] as Record<string, any>;
  assert.equal(now.eligible, true); assert.equal(now.routes.met, true);
  const nonHolders = await rows(sql`SELECT e.participant_key FROM career_event_entries e JOIN career_event_instances i ON i.career_save_id = e.career_save_id AND i.id = e.event_id
    WHERE e.career_save_id = ${A} AND i.circuit = 'PRO_CIRCUIT' AND e.status = 'CONFIRMED'
      AND NOT EXISTS (SELECT 1 FROM career_tour_cards c WHERE c.career_save_id = e.career_save_id AND c.participant_key = e.participant_key AND c.start_season <= 1 AND c.end_season >= 1)`);
  assert.equal(nonHolders.length, 0, "every Pro Circuit entrant holds an A5 card");
  const ranking = (await career.qualification(human, A, { fromWeek: 29, weeks: 1 })).events.find(e => e.definitionKey === "long-format-matchplay") as Record<string, any>;
  const route = (ranking.routes.parts as Record<string, any>[]).find(p => p.type === "RANKING" && p.list === "pro-world")!;
  assert.equal(route.maxPosition, 16);
  assert.ok(route.position === null || route.placesOutside === Math.max(0, route.position - 16));
  // Participation weighting follows sporting status, never ability changes.
  const npc = { tier: "PROFESSIONAL" } as never, amateur = { tier: "AMATEUR" } as never;
  assert.deepEqual([selectionTierFor(npc, true), selectionTierFor(npc, false), selectionTierFor(amateur, true), selectionTierFor(amateur, false)], ["PROFESSIONAL", "AMATEUR", "PROFESSIONAL", "AMATEUR"]);
});

test("25. A4 sponsorship consumes A5 facts (unknown stays unknown)", async () => {
  const facts = createSportingFactsProvider(() => career.providers());
  const a = await inRollback(human, A, (tx, root) => facts.facts(tx, root));
  assert.equal(a.tourCard, true); assert.equal(a.professionalStatus, "PROFESSIONAL");
  const world = (await career.summary(human, A)).worldRanking.standing;
  assert.equal(a.worldRanking, world?.position ?? Number.MAX_SAFE_INTEGER);
  const fresh = await newCareer({ playerId: 4 });
  const f = await inRollback({ playerId: 4 }, fresh.id, (tx, root) => facts.facts(tx, root));
  assert.deepEqual([f.tourCard, f.professionalStatus, f.worldRanking], [false, "AMATEUR", null], "no World Ranking published yet: unknown, never granted");
  const b = await inRollback(observer, B, (tx, root) => facts.facts(tx, root));
  assert.equal(b.worldRanking, Number.MAX_SAFE_INTEGER, "published but unranked: a known non-qualifying fact");
  await saves.delete(4, fresh.id);
});

test("26. retirement: retired NPCs surrender cards and leave the active ranking; history stays", async () => {
  const holder = (await rows(sql`SELECT p.participant_key, p.current_position FROM career_ranking_participants p JOIN career_tour_cards c ON c.career_save_id = p.career_save_id
    AND c.participant_key = p.participant_key AND c.status = 'ACTIVE' WHERE p.career_save_id = ${A} AND p.list_key = 'pro-world' AND p.current_position IS NOT NULL ORDER BY p.current_position LIMIT 1`))[0];
  await inRollback(human, A, async (tx, root) => {
    await tx.execute(sql`UPDATE career_world_players SET status = 'RETIRED', stage = 'RETIRED', retired_season = 1 WHERE career_save_id = ${A} AND id = ${holder.participant_key}::uuid`);
    assert.equal(await processRetirements(tx, root, 2, 1), 1);
    const card = (await tx.execute(sql`SELECT status, end_reason FROM career_tour_cards WHERE career_save_id = ${A} AND participant_key = ${holder.participant_key} ORDER BY created_at DESC LIMIT 1`)).rows[0];
    assert.deepEqual([card.status, card.end_reason], ["SURRENDERED", "RETIRED"]);
    await publishRankings(tx, root, 1, 1, 40, true);
    const now = (await tx.execute(sql`SELECT current_position FROM career_ranking_participants WHERE career_save_id = ${A} AND list_key = 'pro-world' AND participant_key = ${holder.participant_key}`)).rows[0];
    assert.equal(now.current_position, null);
    assert.ok(Number((await tx.execute(sql`SELECT COUNT(*)::int n FROM career_ranking_snapshot_rows WHERE career_save_id = ${A} AND participant_key = ${holder.participant_key}`)).rows[0].n) > 0, "history kept");
    assert.ok(Number((await tx.execute(sql`SELECT COUNT(*)::int n FROM career_ranking_contributions WHERE career_save_id = ${A} AND participant_key = ${holder.participant_key}`)).rows[0].n) > 0);
    assert.equal((await cardHoldersIn(tx, A, 1)).has(String(holder.participant_key)), false);
  });
});

test("27. save isolation: identical seeds, separate sporting worlds, no cross-player access", async () => {
  await rejectsStatus(career.summary(observer, A), 404);
  await rejectsStatus(career.rankingTable(human, B, "pro-world"), 404);
  const human_in_b = await rows(sql`SELECT COUNT(*)::int n FROM career_ranking_contributions WHERE career_save_id = ${B} AND participant_key = ${HUMAN}`);
  assert.equal(human_in_b[0].n, 0, "B's idle human has no ranking money; A's results never leak");
  assert.equal((await career.tourCard(observer, B)).holdsCard, false);
  for (const t of ["career_ranking_contributions", "career_ranking_snapshots", "career_tour_cards", "career_qschool_results", "career_sporting_milestones"])
    assert.ok(Number((await rows(sql`SELECT COUNT(*)::int n FROM ${sql.raw(t)} WHERE career_save_id = ${B}`))[0].n) > 0, t);
  // Same seed + same inputs => identical, deterministic sporting state.
  const C = (await newCareer(twin)).id;
  await playTo(twin, C, 1, 7, "c");
  const table = async (actor: { playerId: number }, id: string) => (await career.rankingTable(actor, id, "pro-world", { limit: 64 })).rows.map(r => [r.position, r.participantKey, r.valuePence]);
  assert.deepEqual(await table(twin, C), await table(observer, B));
  const cards = async (id: string) => (await rows(sql`SELECT participant_key, source, start_season, end_season FROM career_tour_cards WHERE career_save_id = ${id} ORDER BY participant_key, source`));
  assert.deepEqual(await cards(C), await cards(B));
});

test("28-29. restart wipes A5 state; a retired Career is read-only", async () => {
  const C = (await rows(sql`SELECT id FROM career_saves WHERE player_id = 3`))[0].id as string;
  const restarted = await saves.restart(3, C);
  for (const t of ["career_sporting_state", "career_ranking_contributions", "career_ranking_snapshots", "career_ranking_snapshot_rows", "career_ranking_participants", "career_tour_cards",
    "career_qschool_results", "career_qschool_allocations", "career_qschool_card_awards", "career_sporting_milestones"])
    assert.equal(Number((await rows(sql`SELECT COUNT(*)::int n FROM ${sql.raw(t)} WHERE career_save_id = ${C}`))[0].n), 0, t);
  await db.execute(sql`UPDATE career_saves SET world_seed = ${HARNESS_SEED},event_database_version=1,player_database_version=1 WHERE id = ${restarted.id}`);
  await career.initialize(twin, restarted.id);
  assert.equal((await rows(sql`SELECT COUNT(*)::int n FROM career_ranking_snapshots WHERE career_save_id = ${restarted.id}`))[0].n, 0, "fresh sporting world");
  assert.ok(Number((await rows(sql`SELECT COUNT(*)::int n FROM career_tour_cards WHERE career_save_id = ${restarted.id} AND source = 'FOUNDING'`))[0].n) > 0);
  await saves.retire(3, restarted.id);
  assert.ok((await career.summary(twin, restarted.id)).tourCard);
  assert.ok(await career.rankingLists(twin, restarted.id));
  await rejectsStatus(career.calendar.advance(twin, restarted.id, { operationKey: "retired-advance", expectedSeason: 1, expectedWeek: 1, target: { kind: "WEEKS", weeks: 1 } }), 409);
});

test("30. concurrency / retry: duplicate advances and replayed hooks never duplicate sporting state", async () => {
  const r = await saves.read(2, B);
  const req = { operationKey: "concurrent-advance", expectedSeason: r.currentSeason, expectedWeek: r.currentWeek, target: { kind: "WEEKS", weeks: 1 } as const };
  const results = await Promise.allSettled([career.calendar.advance(observer, B, req), career.calendar.advance(observer, B, req), career.calendar.advance(observer, B, { ...req, operationKey: "concurrent-other" })]);
  assert.ok(results.some(x => x.status === "fulfilled"));
  const P = timeIndex(r.currentSeason, r.currentWeek);
  const snaps = await rows(sql`SELECT list_key, COUNT(*)::int n FROM career_ranking_snapshots WHERE career_save_id = ${B} AND publication_index = ${P} GROUP BY 1`);
  assert.ok(snaps.every(s => s.n === 1));
  const before = await rows(sql`SELECT (SELECT COUNT(*) FROM career_ranking_snapshots WHERE career_save_id = ${B})::int s, (SELECT COUNT(*) FROM career_sporting_milestones WHERE career_save_id = ${B})::int m,
    (SELECT COUNT(*) FROM career_tour_cards WHERE career_save_id = ${B})::int c`);
  await inRollbackCommit(observer, B, async (tx, root) => {
    const hooks = createSportingHooks();
    await hooks.afterWeek(tx, root, r.currentSeason, r.currentWeek);
    await hooks.afterWeek(tx, root, 1, 3);
  });
  const after = await rows(sql`SELECT (SELECT COUNT(*) FROM career_ranking_snapshots WHERE career_save_id = ${B})::int s, (SELECT COUNT(*) FROM career_sporting_milestones WHERE career_save_id = ${B})::int m,
    (SELECT COUNT(*) FROM career_tour_cards WHERE career_save_id = ${B})::int c`);
  assert.deepEqual(after, before);
  const dupMilestones = await rows(sql`SELECT operation_key FROM career_sporting_milestones GROUP BY career_save_id, operation_key HAVING COUNT(*) > 1`);
  assert.equal(dupMilestones.length, 0);
});

test("31. international integrity: real nationalities, pathway zones, multinational card holders", async () => {
  const holders = await rows(sql`SELECT p.nationality, COUNT(*)::int n FROM career_tour_cards c JOIN career_world_players p ON p.career_save_id = c.career_save_id AND p.id = c.npc_id
    WHERE c.career_save_id = ${A} AND c.status = 'ACTIVE' GROUP BY 1`);
  for (const h of holders) assert.ok(COUNTRIES[String(h.nationality)], String(h.nationality));
  assert.ok(holders.length >= 5, "Tour Card holders come from several nations");
  const zones = new Set(holders.map(h => zoneOf(String(h.nationality))));
  assert.ok(zones.has("UK_IRELAND") && zones.has("EUROPE") && zones.has("REST_OF_WORLD"));
  // Nationality never changes ability: A5 code never reads ability/potential columns.
  const sources = ["rankings", "cards", "qschool", "engine", "service"].map(n => readFileSync(new URL(`../../career/sporting/${n}.ts`, import.meta.url), "utf8")).join("\n");
  assert.ok(!/\b(scoring|finishing|potential|ability)\b\s*[=,)]/.test(sources.replace(/selectionTier[^\n]*/g, "")), "no ability inputs");
  assert.ok(!/Math\.random/.test(sources));
  assert.ok(!/\b(xp|experience points|unlock score)\b/i.test(sources), "no XP");
});

test("32. Classic Tour untouched and uncoupled", async () => {
  const tourSeed = readFileSync(new URL("../tourSeed.ts", import.meta.url));
  assert.equal(createHash("sha256").update(tourSeed).digest("hex"), "bd9c35ae2b2c8c1b560be03987972a9d9432e0019d167c8c62e171e7bbc4b994", "61 events / 5 difficulties / 305 trophies seed unchanged");
  const sources = ["config", "rankings", "cards", "qschool", "engine", "state", "service", "router"].map(n => readFileSync(new URL(`../../career/sporting/${n}.ts`, import.meta.url), "utf8")).join("\n");
  assert.ok(!/from ["'][^"']*tour|tour_(events|trophies|progress)|player_currency|coins/i.test(sources.replace(/tour-card|tour_card|TourCard|Tour Card|TOUR_CARD|tourCard/g, "")));
  assert.ok(!/tour_(events|trophies|progress)|player_currency/.test(readFileSync(new URL("../../db/migrations/create_career_sporting.ts", import.meta.url), "utf8")));
});

test("33. difficulty never touches sporting rules", async () => {
  const sources = ["config", "rankings", "cards", "qschool", "engine"].map(n => readFileSync(new URL(`../../career/sporting/${n}.ts`, import.meta.url), "utf8")).join("\n");
  assert.ok(!/root\.difficulty|CAREER_DIFFICULTY|difficulty\s*[:=(]/.test(sources));
  assert.equal(RANKING_RULES_VERSION, 1);
});
