import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { createCareerSaves } from "../../db/migrations/create_career_saves.ts";
import { createCareerWorld } from "../../db/migrations/create_career_world.ts";
import {createCareerSponsorshipFoundation} from "../../db/migrations/create_career_sponsorship_foundation.ts";
import { createCareerCalendar } from "../../db/migrations/create_career_calendar.ts";
import { createCareerService } from "../../career/service.ts";
import { createCareerCalendarService } from "../../career/calendar/service.ts";
import { createCareerWorldService, lockRoot, worldState, simulateMatchesInTransaction } from "../../career/world/service.ts";
import { makeDraw, insertEntitlements, type RootRow, type InstanceRow } from "../../career/calendar/engine.ts";
import { DEFAULT_PROVIDERS } from "../../career/calendar/providers.ts";
import { seasonReport } from "../../career/calendar/harness.ts";
import { HARNESS_SEED } from "../../career/world/harness.ts";

/**
 * Full-season NPC world (no human) plus human vertical slices. The 52-week season
 * runs once in before(); PGlite makes it the slowest Career test (~1 minute).
 */
const pg = new PGlite();
const db = drizzle(pg);
const saves = createCareerService(db);
const calendar = createCareerCalendarService(db);
const worlds = createCareerWorldService(db);
const actor = { playerId: 1 };
let world: { id: string };
let seasonResult: { to: { season: number; week: number }; weeksPlayed: number; stop: { reason: string } };
const rows = async (query: ReturnType<typeof sql>) => (await db.execute(query)).rows;
const rejectsStatus = (promise: Promise<unknown>, status: number) => assert.rejects(promise, (e: unknown) => (e as { status?: number }).status === status);
const rejectsWith = (promise: Promise<unknown>, pattern: RegExp) => assert.rejects(promise, (error: unknown) => {
  for (let e = error as { message?: string; cause?: unknown } | undefined, d = 0; e && d < 5; e = e.cause as typeof e, d++) if (pattern.test(String(e.message))) return true;
  return false;
});

async function careerFor(player: number, slot: number) {
  const save = await saves.create(player, { slot });
  // A3's original sporting universe; current v5 is certified separately.
  await db.execute(sql`UPDATE career_saves SET world_seed = ${HARNESS_SEED},event_database_version=2,player_database_version=1 WHERE id = ${save.id}`);
  await calendar.initialize({ playerId: player }, save.id);
  return save;
}

before(async () => {
  await pg.exec(`CREATE TABLE players (id INTEGER PRIMARY KEY); INSERT INTO players VALUES (1), (2), (3);
    CREATE TABLE feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);
    INSERT INTO feature_flags VALUES ('tour_career_2', true, false, 'test')`);
  await createCareerSaves(db); await createCareerWorld(db); await createCareerSponsorshipFoundation(db); await createCareerCalendar(db);
  world = await careerFor(1, 1);
  seasonResult = await calendar.advance(actor, world.id, { operationKey: "full-npc-season", expectedSeason: 1, expectedWeek: 1, target: { kind: "WEEKS", weeks: 52 } }) as typeof seasonResult;
});
after(async () => { await pg.close(); });

test("a full NPC season plays 52 weeks, one A2 period per week, one off-season, and rolls over", async () => {
  assert.deepEqual([seasonResult.stop.reason, seasonResult.weeksPlayed, seasonResult.to.season, seasonResult.to.week], ["TARGET_REACHED", 52, 2, 1]);
  const periods = await rows(sql`SELECT kind, sequence FROM career_world_periods WHERE career_save_id = ${world.id} ORDER BY season, kind, sequence`);
  assert.deepEqual(periods.filter(p => p.kind === "PERIOD").map(p => p.sequence), Array.from({ length: 52 }, (_, i) => i + 1));
  assert.equal(periods.filter(p => p.kind === "OFF_SEASON").length, 1);
  const [s1] = await rows(sql`SELECT status, played_week, developed_week, off_season_processed FROM career_seasons WHERE career_save_id = ${world.id} AND season = 1`);
  assert.deepEqual(s1, { status: "COMPLETED", played_week: 52, developed_week: 52, off_season_processed: true });
  const [s2] = await rows(sql`SELECT status, instance_count FROM career_seasons WHERE career_save_id = ${world.id} AND season = 2`);
  assert.equal(s2.status, "ACTIVE");
  assert.ok(Number(s2.instance_count) >= 300);
  const root = await saves.read(1, world.id);
  assert.deepEqual([root.currentSeason, root.currentWeek], [2, 1]);
  // A2 off-season retry is idempotent and A3 never re-runs it.
  const before = await rows(sql`SELECT COUNT(*)::int AS n FROM career_world_players WHERE career_save_id = ${world.id}`);
  await worlds.processOffSeason(actor, world.id, { season: 1, opportunity: 0.5 });
  assert.deepEqual(await rows(sql`SELECT COUNT(*)::int AS n FROM career_world_players WHERE career_save_id = ${world.id}`), before);
  assert.equal((await rows(sql`SELECT COUNT(*)::int AS n FROM career_world_periods WHERE career_save_id = ${world.id} AND kind = 'OFF_SEASON'`))[0].n, 1);
  const stale = await calendar.advance(actor, world.id, { operationKey: "full-npc-season", expectedSeason: 1, expectedWeek: 1, target: { kind: "WEEKS", weeks: 52 } }) as typeof seasonResult;
  assert.equal(stale.to.season, 2, "retry returns the stored result; no second season is played");
  assert.equal((await rows(sql`SELECT COUNT(*)::int AS n FROM career_world_periods WHERE career_save_id = ${world.id} AND season = 2`))[0].n, 0);
});

test("every event finishes honestly: completed with a valid champion or explicitly cancelled", async () => {
  const report = await seasonReport(db, world.id, 1);
  assert.equal((await rows(sql`SELECT COUNT(*)::int AS n FROM career_event_instances WHERE career_save_id = ${world.id} AND season = 1 AND status NOT IN ('COMPLETED','CANCELLED')`))[0].n, 0);
  assert.ok(report.champions.completed >= 250, `completed tournaments: ${report.champions.completed}`);
  assert.equal(report.champions.valid, report.champions.completed);
  assert.equal(report.a2LinkedMatches.matches, report.a2LinkedMatches.linked, "every simulated match is an A2 record");
  assert.equal(report.npcDoubleBookings, 0);
  assert.equal(report.invalidEntries, 0);
  assert.equal(report.retiredEntrants, 0);
  assert.equal(report.duplicateEntitlements, 0);
  const cancelled = await rows(sql`SELECT status_reason, executable, COUNT(*)::int AS n FROM career_event_instances WHERE career_save_id = ${world.id} AND season = 1 AND status = 'CANCELLED' GROUP BY 1, 2`);
  for (const row of cancelled) assert.ok((row.status_reason === "INTENTIONALLY_BENCHED" && row.executable === false) || (row.status_reason === "INSUFFICIENT_ENTRANTS" && row.executable === true), JSON.stringify(row));
  const fakes = await rows(sql`SELECT COUNT(*)::int AS n FROM career_tournament_matches m JOIN career_event_instances i ON i.career_save_id = m.career_save_id AND i.id = m.event_id
    WHERE m.career_save_id = ${world.id} AND NOT i.executable`);
  assert.equal(fakes[0].n, 0, "unsupported formats never produce 501 matches");
  // A6.5: set play is executable (human scorer + A2 set simulation), so the Palace is played, never faked.
  const wc = (await rows(sql`SELECT status, status_reason, champion_participant_key FROM career_event_instances WHERE career_save_id = ${world.id} AND season = 1 AND definition_key = 'world-darts-championship'`))[0];
  assert.equal(wc.status, "COMPLETED"); assert.ok(wc.champion_participant_key, "World Championship produced a champion");
});

test("knockout brackets are internally consistent from first round to champion", async () => {
  const matches = await rows(sql`SELECT m.event_id, m.round, m.slot, m.a_key, m.b_key, m.winner_key, m.status, m.best_of, m.legs_a, m.legs_b, m.summary, i.champion_participant_key,
      i.snapshot->'format'->>'scoringUnit' AS unit, (i.snapshot->'format'->>'legsPerSet')::int AS legs_per_set
    FROM career_tournament_matches m JOIN career_event_instances i ON i.career_save_id = m.career_save_id AND i.id = m.event_id
    WHERE m.career_save_id = ${world.id} AND i.season = 1 AND i.status = 'COMPLETED' ORDER BY m.event_id, m.round, m.slot`);
  const byEvent = new Map<string, typeof matches>();
  for (const m of matches) byEvent.set(String(m.event_id), [...(byEvent.get(String(m.event_id)) ?? []), m]);
  for (const [, list] of byEvent) {
    const rounds = Math.max(...list.map(m => Number(m.round)));
    for (const m of list) {
      if (m.status === "COMPLETED") {
        const target = (Number(m.best_of) + 1) / 2;
        if (m.unit === "SETS") {
          // best_of is best-of SETS; legs are totals across sets.
          const setScore = (m.summary as { sets: [number, number] }).sets;
          const [ws, ls] = m.winner_key === m.a_key ? setScore : [setScore[1], setScore[0]];
          assert.equal(ws, target); assert.ok(ls < target);
          const [wl] = m.winner_key === m.a_key ? [m.legs_a, m.legs_b] : [m.legs_b, m.legs_a];
          assert.ok(Number(wl) >= target * (Number(m.legs_per_set) + 1) / 2, "set winner won enough legs");
        } else {
          const [wl, ll] = m.winner_key === m.a_key ? [m.legs_a, m.legs_b] : [m.legs_b, m.legs_a];
          assert.equal(wl, target); assert.ok(Number(ll) < target);
        }
      }
      if (Number(m.round) > 1) {
        const feeders = list.filter(f => Number(f.round) === Number(m.round) - 1 && Math.ceil(Number(f.slot) / 2) === Number(m.slot));
        assert.deepEqual([m.a_key, m.b_key].sort(), feeders.map(f => f.winner_key).sort(), "winners advance into the next slot");
      }
    }
    assert.equal(list.find(m => Number(m.round) === rounds)!.winner_key, list[0].champion_participant_key);
  }
});

test("NPC fields are plausible by tier and genuinely international at the top", async () => {
  const report = await seasonReport(db, world.id, 1);
  const tiers = await rows(sql`SELECT i.circuit || CASE WHEN i.classification = 'QUALIFIER' THEN ':Q' ELSE '' END AS circuit, p.tier, COUNT(*)::int AS n FROM career_event_entries e JOIN career_event_instances i ON i.career_save_id = e.career_save_id AND i.id = e.event_id
    JOIN LATERAL (
      SELECT player.value->>'tier' AS tier FROM career_tournament_matches m
      JOIN career_simulated_matches s ON s.career_save_id=m.career_save_id AND s.match_key=m.simulated_match_key
      CROSS JOIN LATERAL jsonb_array_elements(s.input_snapshot->'players') player(value)
      WHERE m.career_save_id=e.career_save_id AND m.event_id=e.event_id AND player.value->>'id'=e.participant_key
      ORDER BY m.scheduled_day,m.round,m.slot LIMIT 1
    ) p ON true WHERE e.career_save_id = ${world.id} AND i.season = 1 AND i.status = 'COMPLETED' GROUP BY 1, 2`);
  const share = (circuit: string, tier: string) => { const all = tiers.filter(t => t.circuit === circuit); return all.filter(t => t.tier === tier).reduce((a, t) => a + Number(t.n), 0) / Math.max(1, all.reduce((a, t) => a + Number(t.n), 0)); };
  assert.equal(share("GRASSROOTS", "ELITE"), 0, "elite players do not fill pub nights");
  assert.ok(share("PRO_CIRCUIT", "GRASSROOTS") === 0 && share("PRO_CIRCUIT", "AMATEUR") === 0, "Pro Circuit uses the professional placeholder status");
  assert.ok(share("MAJOR", "ELITE") + share("MAJOR", "PROFESSIONAL") > 0.85, "ranking majors are professional fields");
  assert.ok(share("MAJOR", "ELITE") > share("PRO_CIRCUIT", "ELITE"), "majors are stronger than the floor circuit");
  const nations = Object.keys(report.international.proLevelEntrantNationality);
  assert.ok(nations.length >= 5, `professional fields span ${nations.join(",")}`);
  assert.ok(report.international.proLevelUkIrelandShare < 0.7, `UK/IE share ${report.international.proLevelUkIrelandShare}`);
  assert.ok(Object.keys(report.international.proLevelChampionNationality).length >= 3);
  assert.ok(report.international.proLevelVenueZones.length === 3, "professional events visit UK/IE, Europe and the rest of the world");
  const qs = report.qSchool as { pathway: string; stage: string; distinct_players: number }[];
  assert.deepEqual(qs.map(q => `${q.pathway}:${q.stage}`), ["EUROPE:FINAL", "EUROPE:FIRST", "UK_IRELAND:FINAL", "UK_IRELAND:FIRST"]);
  const crossover = await rows(sql`SELECT e.participant_key FROM career_event_entries e JOIN career_event_instances i ON i.career_save_id = e.career_save_id AND i.id = e.event_id
    WHERE e.career_save_id = ${world.id} AND i.season = 1 AND i.circuit = 'Q_SCHOOL' GROUP BY 1 HAVING COUNT(DISTINCT i.snapshot->'qSchool'->>'pathway') > 1`);
  assert.equal(crossover.length, 0, "no NPC enters both Q-School pathways");
});

test("qualification entitlements persist source/recipient, are consumed by intake and are retry safe", async () => {
  const issued = await rows(sql`SELECT q.*, i.definition_key AS source_definition FROM career_qualification_entitlements q JOIN career_event_instances i ON i.career_save_id = q.career_save_id AND i.id = q.source_event_id
    WHERE q.career_save_id = ${world.id} AND q.awarded_season = 1`);
  assert.ok(issued.some(e => e.target_key === "q-school-final:UK_IRELAND" && String(e.source_definition).startsWith("q-school-first-uk_ireland")));
  for (const e of issued) {
    assert.ok(e.recipient_key && e.source_event_id && e.source_position && e.target_key && e.target_season === 1);
    const result = (await rows(sql`SELECT finishing_position FROM career_event_results WHERE career_save_id = ${world.id} AND event_id = ${e.source_event_id} AND participant_key = ${e.recipient_key}`))[0];
    assert.equal(Number(result.finishing_position), Number(e.source_position), "entitlement matches the recorded result");
  }
  const consumed = issued.filter(e => e.status === "CONSUMED");
  assert.ok(consumed.length > 0);
  for (const e of consumed) {
    const entry = (await rows(sql`SELECT source, entitlement_id FROM career_event_entries WHERE career_save_id = ${world.id} AND event_id = ${e.consumed_by_event_id} AND participant_key = ${e.recipient_key}`))[0];
    assert.deepEqual([entry.source, entry.entitlement_id], ["ENTITLEMENT", e.id]);
  }
  assert.ok(issued.filter(e => e.status !== "CONSUMED").every(e => e.status === "EXPIRED"), "season close expires unused entitlements");
  // Re-issuing the same grants (a retried completion) cannot duplicate them.
  const sample = issued.slice(0, 5).map(e => ({ id: e.id, idempotency_key: e.idempotency_key, recipient_key: e.recipient_key, recipient_kind: e.recipient_kind, npc_id: e.npc_id,
    entitlement_type: e.entitlement_type, source_event_id: e.source_event_id, source_position: e.source_position, source_detail: e.source_detail, target_key: e.target_key,
    target_season: e.target_season, consumption: e.consumption }));
  await db.transaction(tx => insertEntitlements(tx, world.id, 1, sample, "EVENT_RESULT"));
  assert.equal((await rows(sql`SELECT COUNT(*)::int AS n FROM career_qualification_entitlements WHERE career_save_id = ${world.id} AND awarded_season = 1`))[0].n, issued.length);
  // A5 provider boundary reuses the same model idempotently.
  const npc = String(issued[0].recipient_key);
  const grant = { idempotencyKey: "ranking-top-32-s2", providerId: "A5_TEST", recipientKey: npc, entitlementType: "EVENT_ENTRY", targetKey: "world-championship", targetSeason: 2, consumption: "SINGLE_USE" };
  const a = await calendar.issueProviderEntitlement(actor, world.id, grant), b = await calendar.issueProviderEntitlement(actor, world.id, grant);
  assert.equal(a.id, b.id);
  await rejectsStatus(calendar.issueProviderEntitlement(actor, world.id, { ...grant, targetKey: "open-championship" }), 409);
});

test("completed history is immutable and stable as the world moves on", async () => {
  const [event] = await rows(sql`SELECT id FROM career_event_instances WHERE career_save_id = ${world.id} AND season = 1 AND status = 'COMPLETED' ORDER BY start_day LIMIT 1`);
  const snapshot = async () => ({ results: await rows(sql`SELECT * FROM career_event_results WHERE career_save_id = ${world.id} AND event_id = ${event.id} ORDER BY participant_key`),
    matches: await rows(sql`SELECT id, winner_key, legs_a, legs_b, summary FROM career_tournament_matches WHERE career_save_id = ${world.id} AND event_id = ${event.id} ORDER BY id`),
    event: await rows(sql`SELECT * FROM career_event_instances WHERE career_save_id = ${world.id} AND id = ${event.id}`) });
  const before = await snapshot();
  await calendar.advance(actor, world.id, { operationKey: "season-two-week-one", expectedSeason: 2, expectedWeek: 1, target: { kind: "WEEKS", weeks: 1 } });
  assert.deepEqual(await snapshot(), before);
  await rejectsWith(db.execute(sql`UPDATE career_event_results SET finishing_position = 1 WHERE career_save_id = ${world.id} AND event_id = ${event.id}`), /permanent history/);
  await rejectsWith(db.execute(sql`UPDATE career_tournament_matches SET winner_key = a_key WHERE career_save_id = ${world.id} AND event_id = ${event.id} AND status = 'COMPLETED'`), /is final/);
  await rejectsWith(db.execute(sql`UPDATE career_event_instances SET name = 'Rewritten' WHERE career_save_id = ${world.id} AND id = ${event.id}`), /historical and immutable/);
  const history = await calendar.history(actor, world.id, { season: 1, limit: 1000 });
  assert.ok(history.length >= 250 && history.every(h => h.champion));
});

test("persisted match operations replay identically; a reused key with new inputs fails", async () => {
  const [stored] = await rows(sql`SELECT match_key, request, result FROM career_simulated_matches WHERE career_save_id = ${world.id} AND match_key LIKE 'a3:%' ORDER BY match_key LIMIT 1`);
  await db.transaction(async tx => {
    const root = await lockRoot(tx, actor, world.id);
    const state = await worldState(tx, root);
    const [again] = await simulateMatchesInTransaction(tx, root, state, [stored.request as never]);
    assert.deepEqual(again, stored.result);
    const altered = { ...(stored.request as Record<string, unknown>), format: { bestOf: 3, firstThrow: 0 } };
    await rejectsStatus(simulateMatchesInTransaction(tx, root, state, [altered as never]), 409);
  }).catch(error => { if ((error as { status?: number }).status !== 409) throw error; });
  assert.equal((await rows(sql`SELECT COUNT(*)::int AS n FROM career_simulated_matches WHERE career_save_id = ${world.id} AND match_key = ${stored.match_key}`))[0].n, 1);
});

test("the official draw is locked: no regeneration and no duplicate bracket slots", async () => {
  const save = await careerFor(3, 1);
  await calendar.advance({ playerId: 3 }, save.id, { operationKey: "draw-lock-week", expectedSeason: 1, expectedWeek: 1, target: { kind: "WEEKS", weeks: 1 } });
  const [live] = await rows(sql`SELECT * FROM career_event_instances WHERE career_save_id = ${save.id} AND status IN ('IN_PROGRESS','COMPLETED') ORDER BY start_day LIMIT 1`);
  const matches = await rows(sql`SELECT id, a_key, b_key FROM career_tournament_matches WHERE career_save_id = ${save.id} AND event_id = ${live.id} ORDER BY round, slot`);
  await db.transaction(async tx => {
    const root = await lockRoot(tx, { playerId: 3 }, save.id) as RootRow;
    await rejectsStatus(makeDraw(tx, root, live as unknown as InstanceRow, DEFAULT_PROVIDERS), 409);
  }).catch(error => { if ((error as { status?: number }).status !== 409) throw error; });
  await rejectsWith(db.execute(sql`INSERT INTO career_tournament_matches (career_save_id, id, event_id, stage_key, round, slot, best_of, scheduled_day, status, first_throw_method)
    VALUES (${save.id}, gen_random_uuid(), ${live.id}, 'main', 1, 1, 5, ${live.start_day}, 'PENDING', 'BULL_UP')`), /slot_unique|duplicate key/);
  assert.deepEqual(await rows(sql`SELECT id, a_key, b_key FROM career_tournament_matches WHERE career_save_id = ${save.id} AND event_id = ${live.id} ORDER BY round, slot`), matches);
  // Same seed, same week: identical NPC fields (deterministic selection).
  const fieldsOf = async (id: string) => rows(sql`SELECT i.instance_key, e.participant_key FROM career_event_entries e JOIN career_event_instances i ON i.career_save_id = e.career_save_id AND i.id = e.event_id
    WHERE e.career_save_id = ${id} AND i.season = 1 AND i.start_week = 1 ORDER BY 1, 2`);
  assert.deepEqual(await fieldsOf(save.id), await fieldsOf(world.id));
});

async function advanceUntilBlocked(player: number, saveId: string, key: string) {
  for (let i = 0; i < 20; i++) {
    const root = await saves.read(player, saveId);
    const r = await calendar.advance({ playerId: player }, saveId, { operationKey: `${key}-${i}`, expectedSeason: root.currentSeason, expectedWeek: root.currentWeek, target: { kind: "NEXT_MEANINGFUL" } }) as { stop: { reason: string; detail?: { matchIds: string[] } } };
    if (r.stop.reason === "HUMAN_MATCH_PENDING") return { opKey: `${key}-${i}`, matchIds: r.stop.detail!.matchIds };
  }
  throw new Error("human match never became pending");
}

test("human elimination does not stop the tournament; NPCs play on to a champion", async () => {
  const save = await careerFor(2, 1);
  const human = { playerId: 2 };
  const { events } = await calendar.calendar(human, save.id, { scope: "AVAILABLE" });
  const target = events.filter(e => e.capability.executable && !e.series && e.field.size >= 16).sort((a, b) => a.dates.startDay - b.dates.startDay)[0];
  assert.equal((await calendar.enter(human, save.id, { eventId: target.id })).entered, true);
  const blocked = await advanceUntilBlocked(2, save.id, "human-loss");
  const detail = await calendar.event(human, save.id, target.id);
  const next = detail.human.nextMatch!;
  assert.equal(next.status, "AWAITING_HUMAN");
  assert.ok(blocked.matchIds.includes(next.id));
  assert.ok(detail.draw.matches.some(m => m.round === 1 && m.status === "COMPLETED" && m.resultSource === "A2_SIMULATION"), "other first-round matches already played");
  const opponent = next.a!.key === "HUMAN" ? next.b! : next.a!;
  await rejectsStatus(calendar.recordHumanMatchResult(human, save.id, { matchId: next.id, humanLegs: 1, opponentLegs: 1, humanThrewFirst: true }), 409);
  const lost = await calendar.recordHumanMatchResult(human, save.id, { matchId: next.id, humanLegs: 0, opponentLegs: (next.bestOf + 1) / 2, humanThrewFirst: false });
  assert.equal(lost.winnerKey, opponent.key);
  await rejectsStatus(calendar.recordHumanMatchResult(human, save.id, { matchId: next.id, humanLegs: 0, opponentLegs: (next.bestOf + 1) / 2, humanThrewFirst: false }), 409);
  // Resume the same advance operation (blocked advances are not stored as final).
  const root = await saves.read(2, save.id);
  await calendar.advance(human, save.id, { operationKey: blocked.opKey, expectedSeason: root.currentSeason, expectedWeek: root.currentWeek, target: { kind: "NEXT_MEANINGFUL" } });
  const final = await calendar.event(human, save.id, target.id);
  assert.equal(final.event.status, "COMPLETED");
  assert.ok(final.event.champion && final.event.champion.participantKey !== "HUMAN");
  const mine = final.results.find(r => r.participantKey === "HUMAN")!;
  assert.ok(mine.position > 1 && mine.losses === 1);
  assert.equal(final.event.human!.relationship, "COMPLETED");
  assert.ok(final.draw.matches.every(m => ["COMPLETED", "BYE", "WALKOVER"].includes(m.status)));
});

test("post-lock withdrawal is auditable: the human concedes by walkover and the event completes", async () => {
  const save = await careerFor(2, 2);
  const human = { playerId: 2 };
  const { events } = await calendar.calendar(human, save.id, { scope: "AVAILABLE" });
  const target = events.filter(e => e.capability.executable && !e.series && e.field.size >= 16).sort((a, b) => a.dates.startDay - b.dates.startDay)[0];
  await calendar.enter(human, save.id, { eventId: target.id });
  await advanceUntilBlocked(2, save.id, "human-withdraw");
  const out = await calendar.withdraw(human, save.id, { eventId: target.id });
  assert.deepEqual([out.withdrawn, out.postLock], [true, true]);
  const root = await saves.read(2, save.id);
  await calendar.advance(human, save.id, { operationKey: "after-withdraw", expectedSeason: root.currentSeason, expectedWeek: root.currentWeek, target: { kind: "WEEKS", weeks: 1 } });
  const final = await calendar.event(human, save.id, target.id);
  assert.equal(final.event.status, "COMPLETED");
  const walkover = final.draw.matches.find(m => (m.a?.key === "HUMAN" || m.b?.key === "HUMAN") && m.status === "WALKOVER")!;
  assert.ok(walkover && walkover.winnerKey !== "HUMAN" && walkover.resultSource === "WALKOVER");
  assert.equal(final.event.human!.relationship, "WITHDRAWN");
  assert.ok(final.results.some(r => r.participantKey === "HUMAN"), "withdrawn entrant keeps a factual result");
});
