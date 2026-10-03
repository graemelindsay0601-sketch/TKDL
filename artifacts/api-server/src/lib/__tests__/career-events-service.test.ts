import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { fixture } from "./career-events-fixture.ts";
import { createCareerEventService } from "../../career/events/service.ts";
import { eventFrom } from "../../career/events/repository.ts";
import { createCareerEvents } from "../../db/migrations/create_career_events.ts";
import { HARNESS_SEED } from "../../career/world/harness.ts";
import { harnessProvider } from "../../career/events/harness.ts";
import type { EventSnapshot } from "../../career/events/types.ts";
let f: Awaited<ReturnType<typeof fixture>>;
before(async () => { f = await fixture(); });
after(async () => { await f.pg.close(); });
beforeEach(async () => {
  await f.pg.exec("DELETE FROM career_saves; UPDATE feature_flags SET enabled=true,admin_test_mode=false");
  f.save = await f.saves.create(1, { slot: 1 });
  await f.db.execute(sql`UPDATE career_saves SET world_seed=${HARNESS_SEED} WHERE id=${f.save.id}`);
  await f.events.initialize(f.actor, f.save.id);
});
const rowEvents = async () => (await f.db.execute(sql`SELECT * FROM career_events WHERE career_save_id=${f.save.id} ORDER BY start_day,id`)).rows.map(eventFrom);
const local = async () => (await rowEvents()).find(e => e.definition.key === "local-scotland")!;
const go = (day: number, expectedDay = 0, operationKey = `to-${day}`) => f.events.advance(f.actor, f.save.id, { operationKey, season: 1, expectedDay, targetDay: day });

test("A1 initializes one persistent season; repeat initialization and migration do not rewrite snapshots", async () => {
  const before = await rowEvents();
  await f.events.initialize(f.actor, f.save.id); await createCareerEvents(f.db);
  assert.deepEqual(await rowEvents(), before);
  assert.equal(before.length, 384);
  await f.db.execute(sql`UPDATE career_saves SET event_database_version=99 WHERE id=${f.save.id}`);
  await assert.rejects(f.events.calendar(f.actor, f.save.id));
});
test("human entry, duplicate retry, withdrawal and overlapping schedules are enforced", async () => {
  const event = await local(), concurrent = (await rowEvents()).find(e => e.startDay === event.startDay && e.id !== event.id)!;
  assert.equal((await f.events.enter(f.actor, f.save.id, event.id)).status, "ENTERED");
  assert.equal((await f.events.enter(f.actor, f.save.id, event.id)).status, "ENTERED");
  assert.equal((await f.events.enter(f.actor, f.save.id, concurrent.id)).status, "SCHEDULE_CONFLICT");
  await f.events.withdraw(f.actor, f.save.id, event.id);
  assert.equal((await f.events.enter(f.actor, f.save.id, concurrent.id)).status, "ENTERED");
  await f.events.withdraw(f.actor, f.save.id, concurrent.id);
  const later = (await rowEvents()).find(e => e.definition.key === "local-scotland" && e.startDay > event.startDay)!;
  assert.equal((await f.events.enter(f.actor, f.save.id, later.id)).status, "ENTERED");
});
test("NPCs use identical eligibility/conflict authority and retired identities cannot enter", async () => {
  const event = await local(), another = (await rowEvents()).find(e => e.startDay === event.startDay && e.id !== event.id)!;
  const npc = String((await f.db.execute(sql`SELECT id FROM career_world_players WHERE career_save_id=${f.save.id} LIMIT 1`)).rows[0].id);
  assert.equal((await f.events.enter(f.actor, f.save.id, event.id, npc)).status, "ENTERED");
  assert.equal((await f.events.enter(f.actor, f.save.id, another.id, npc)).status, "SCHEDULE_CONFLICT");
  await f.db.execute(sql`UPDATE career_world_players SET status='RETIRED',stage='RETIRED',retired_season=1 WHERE career_save_id=${f.save.id} AND id=${npc}`);
  assert.equal((await f.events.enter(f.actor, f.save.id, event.id, npc)).status, "INELIGIBLE");
});
test("meaningful decision precedes draw lock and calendar DTO is private, bounded and geographic", async () => {
  const calendar = await f.events.calendar(f.actor, f.save.id, { limit: 7 });
  assert.equal(calendar.events.length, 7);
  assert.ok(calendar.events.filter(e => e.circuit === "GRASSROOTS").every(e => e.venue.region === "Scotland"));
  const next = calendar.nextDecision;
  await go(next.day);
  assert.equal((await f.events.enter(f.actor, f.save.id, next.eventId!)).status, "ENTERED");
  const json = JSON.stringify(calendar);
  for (const hidden of ["world_seed", "ability", "potential", "development"]) assert.ok(!json.includes(`"${hidden}"`));
  await assert.rejects(f.events.calendar(f.actor, f.save.id, { limit: 500 }));
});
test("locked field/draw is stable, human defeat continues to champion, live retries cannot change facts", async () => {
  const event = await local();
  await f.events.enter(f.actor, f.save.id, event.id);
  await go(event.startDay);
  const detail = await f.events.detail(f.actor, f.save.id, event.id), match = detail.nextMatch!;
  assert.ok(match); assert.equal(detail.field.length, 8);
  const slots = detail.draw!.slots;
  await f.events.lockDraw(f.actor, f.save.id, event.id);
  assert.deepEqual((await f.events.detail(f.actor, f.save.id, event.id)).draw!.slots, slots);
  await assert.rejects(f.events.withdraw(f.actor, f.save.id, event.id));
  const receipt = { matchId: match.id, receiptId: "trusted-scorer-receipt", score: (match.a === "human" ? [0, 4] : [4, 0]) as [number, number] };
  await f.events.progress(f.actor, f.save.id, event.id, receipt);
  const completed = await f.events.detail(f.actor, f.save.id, event.id);
  assert.equal(completed.status, "COMPLETED"); assert.notEqual(completed.result!.champion, "human"); assert.equal(completed.playerFinish!.losses, 1);
  await f.events.progress(f.actor, f.save.id, event.id, receipt);
  assert.deepEqual((await f.events.detail(f.actor, f.save.id, event.id)).result, completed.result);
  await assert.rejects(f.events.progress(f.actor, f.save.id, event.id, { ...receipt, score: [4, 3] }));
  await assert.rejects(f.db.execute(sql`UPDATE career_events SET result='{}'::jsonb WHERE career_save_id=${f.save.id} AND id=${event.id}`));
  await assert.rejects(f.db.execute(sql`UPDATE career_events SET snapshot='{}'::jsonb WHERE career_save_id=${f.save.id} AND id=${event.id}`));
});
test("unsupported events do not call A2 and are explicitly recorded as unavailable", async () => {
  const event = (await rowEvents()).find(e => e.definition.key === "special-cricket")!;
  assert.equal((await f.events.enter(f.actor, f.save.id, event.id)).status, "UNSUPPORTED_FORMAT");
  assert.equal((await f.events.progress(f.actor, f.save.id, event.id)).status, "UNSUPPORTED_FORMAT");
  assert.equal((await f.db.execute(sql`SELECT count(*)::int AS n FROM career_simulated_matches`)).rows[0].n, 0);
});
test("multi-week advancement uses elapsed weeks exactly once and repeated operation cannot skip again", async () => {
  const first = await go(21);
  assert.deepEqual(await go(21), first);
  const periods = (await f.db.execute(sql`SELECT sequence FROM career_world_periods WHERE career_save_id=${f.save.id} AND kind='PERIOD' ORDER BY sequence`)).rows;
  assert.deepEqual(periods.map(r => r.sequence), [1, 2, 3]);
  await assert.rejects(go(28, 0, "new-stale"));
  await assert.rejects(go(28, 0, "to-21"));
  await go(28, 21, "next-week");
  assert.equal((await f.db.execute(sql`SELECT period FROM career_world_state WHERE career_save_id=${f.save.id}`)).rows[0].period, 4);
});
test("ownership/flags/retirement protect all mutations; archived queries remain available", async () => {
  await assert.rejects(f.events.initialize({ playerId: 2 }, f.save.id));
  await f.pg.exec("UPDATE feature_flags SET enabled=false"); await assert.rejects(f.events.calendar(f.actor, f.save.id));
  await f.pg.exec("UPDATE feature_flags SET enabled=true");
  const event = await local(); await f.saves.retire(1, f.save.id);
  await assert.rejects(f.events.enter(f.actor, f.save.id, event.id)); await assert.rejects(go(7));
  assert.ok((await f.events.calendar(f.actor, f.save.id)).events.length);
});
test("restart and delete cascade A3 state while another save remains intact", async () => {
  const other = await f.saves.create(2, { slot: 1 }); await f.events.initialize({ playerId: 2 }, other.id);
  const old = f.save.id, replacement = await f.saves.restart(1, old);
  assert.equal((await f.db.execute(sql`SELECT count(*)::int AS n FROM career_events WHERE career_save_id=${old}`)).rows[0].n, 0);
  assert.equal((await f.db.execute(sql`SELECT count(*)::int AS n FROM career_events WHERE career_save_id=${other.id}`)).rows[0].n, 384);
  await f.events.initialize(f.actor, replacement.id); await f.saves.delete(1, replacement.id);
  assert.equal((await f.db.execute(sql`SELECT count(*)::int AS n FROM career_seasons WHERE career_save_id=${replacement.id}`)).rows[0].n, 0);
});
test("failure during match persistence rolls back draw, A2 matches/forms and calendar time together", async () => {
  const before = (await f.db.execute(sql`SELECT id,form FROM career_world_players WHERE career_save_id=${f.save.id} ORDER BY id`)).rows;
  await f.pg.exec("CREATE FUNCTION a3_fail() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'injected'; END; $$ LANGUAGE plpgsql; CREATE TRIGGER a3_fail BEFORE INSERT ON career_simulated_matches FOR EACH ROW EXECUTE FUNCTION a3_fail()");
  try { await assert.rejects(go(7)); } finally { await f.pg.exec("DROP TRIGGER a3_fail ON career_simulated_matches; DROP FUNCTION a3_fail()"); }
  assert.deepEqual((await f.db.execute(sql`SELECT id,form FROM career_world_players WHERE career_save_id=${f.save.id} ORDER BY id`)).rows, before);
  assert.equal((await f.db.execute(sql`SELECT day FROM career_seasons WHERE career_save_id=${f.save.id}`)).rows[0].day, 0);
  assert.equal((await f.db.execute(sql`SELECT count(*)::int AS n FROM career_events WHERE draw IS NOT NULL`)).rows[0].n, 0);
});
test("default A5 provider never fabricates cards/ranks or bypasses unknown facts", async () => {
  const service = createCareerEventService(f.db);
  const event = (await rowEvents()).find(e => e.definition.key === "pro-circuit")!;
  const who = String((await f.db.execute(sql`SELECT id FROM career_world_players WHERE career_save_id=${f.save.id} AND professional_status='PROFESSIONAL' LIMIT 1`)).rows[0].id);
  await go(event.opensDay);
  const denied = await service.enter(f.actor, f.save.id, event.id, who);
  assert.equal(denied.status, "INELIGIBLE");
});

async function smallQualificationCalendar(kind: "EVENT" | "FAMILY" | "STAGE" = "EVENT") {
  const base = await local();
  const source: EventSnapshot = { ...base, definition: { ...base.definition, classification: "QUALIFIER", rankingCategory: null, qualification: { targetKey: "qualified-final", targetKind: kind, top: 2 } } };
  const target: EventSnapshot = { ...base, id: "aaaaaaaa-bbbb-8ccc-8ddd-eeeeeeeeeeee", key: "qualified-final:1", startDay: 11, endDay: 11, closesDay: 10,
    definition: { ...base.definition, key: "qualified-final", family: "qualified-final", eligibility: { op: "ENTITLEMENT" } } };
  await f.db.execute(sql`DELETE FROM career_events WHERE career_save_id=${f.save.id}`);
  for (const e of [source, target]) await f.db.execute(sql`INSERT INTO career_events(career_save_id,id,season,instance_key,circuit,classification,start_day,end_day,opens_day,closes_day,status,snapshot)
    VALUES(${f.save.id},${e.id},1,${e.key},${e.definition.circuit},${e.definition.classification},${e.startDay},${e.endDay},0,${e.closesDay},'REGISTRATION_OPEN',${JSON.stringify(e)}::jsonb)`);
  return { source, target };
}
test("qualifications retain source and recipient across reload/provider movement and issue only once", async () => {
  for (const kind of ["EVENT", "FAMILY", "STAGE"] as const) {
    // Fresh fixture save for each target granularity.
    if (kind !== "EVENT") {
      await f.saves.delete(1, f.save.id); f.save = await f.saves.create(1, { slot: 1 }); await f.events.initialize(f.actor, f.save.id);
    }
    const { source, target } = await smallQualificationCalendar(kind);
    await go(4, 0, `qualify-${kind}`);
    const first = (await f.db.execute(sql`SELECT * FROM career_event_entitlements WHERE career_save_id=${f.save.id} ORDER BY participant_key`)).rows;
    assert.equal(first.length, 2); assert.ok(first.every(r => r.source_event_id === source.id && r.target_kind === kind));
    if (kind === "EVENT") assert.ok(first.every(r => r.target_event_id === target.id));
    await f.events.progress(f.actor, f.save.id, source.id);
    const reloaded = createCareerEventService(f.db, { facts: async () => ({}) });
    assert.equal((await reloaded.enter(f.actor, f.save.id, target.id, String(first[0].participant_key))).status, "ENTERED");
    assert.deepEqual((await f.db.execute(sql`SELECT * FROM career_event_entitlements WHERE career_save_id=${f.save.id} ORDER BY participant_key`)).rows, first);
    await go(11, 4, `final-${kind}`);
    assert.equal((await f.events.detail(f.actor, f.save.id, target.id)).status, "COMPLETED");
  }
});
test("season boundary invokes exactly 52 periods and one A2 off-season; retry preserves old history", async () => {
  await smallQualificationCalendar();
  await go(364);
  const history = await rowEvents();
  assert.ok(history.every(e => e.status === "COMPLETED"));
  const periods = (await f.db.execute(sql`SELECT sequence FROM career_world_periods WHERE career_save_id=${f.save.id} AND kind='PERIOD' ORDER BY sequence`)).rows;
  assert.deepEqual(periods.map(r => r.sequence), Array.from({ length: 52 }, (_, i) => i + 1));
  const first = await f.events.closeSeason(f.actor, f.save.id, 1);
  assert.deepEqual(await f.events.closeSeason(f.actor, f.save.id, 1), first);
  assert.equal((await f.db.execute(sql`SELECT count(*)::int AS n FROM career_world_periods WHERE career_save_id=${f.save.id} AND kind='OFF_SEASON'`)).rows[0].n, 1);
  assert.deepEqual((await rowEvents()).filter(e => e.season === 1), history);
  assert.equal((await rowEvents()).filter(e => e.season === 2).length, 384);
  assert.equal((await f.saves.read(1, f.save.id)).currentSeason, 2);
});
test("failed multi-week or off-season operation rolls back A2 time and replacement state", async () => {
  await smallQualificationCalendar();
  await f.pg.exec("CREATE FUNCTION a3_time_fail() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'injected'; END; $$ LANGUAGE plpgsql; CREATE TRIGGER a3_time_fail BEFORE INSERT ON career_calendar_operations FOR EACH ROW EXECUTE FUNCTION a3_time_fail()");
  try { await assert.rejects(go(21)); } finally { await f.pg.exec("DROP TRIGGER a3_time_fail ON career_calendar_operations; DROP FUNCTION a3_time_fail()"); }
  assert.equal((await f.db.execute(sql`SELECT period FROM career_world_state WHERE career_save_id=${f.save.id}`)).rows[0].period, 0);
  await go(364);
  const old = (await f.db.execute(sql`SELECT * FROM career_world_players WHERE career_save_id=${f.save.id} ORDER BY id`)).rows;
  await f.pg.exec("CREATE FUNCTION a3_season_fail() RETURNS trigger AS $$ BEGIN IF NEW.season=2 THEN RAISE EXCEPTION 'injected'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql; CREATE TRIGGER a3_season_fail BEFORE INSERT ON career_seasons FOR EACH ROW EXECUTE FUNCTION a3_season_fail()");
  try { await assert.rejects(f.events.closeSeason(f.actor, f.save.id, 1)); } finally { await f.pg.exec("DROP TRIGGER a3_season_fail ON career_seasons; DROP FUNCTION a3_season_fail()"); }
  assert.equal((await f.saves.read(1, f.save.id)).currentSeason, 1);
  assert.deepEqual((await f.db.execute(sql`SELECT * FROM career_world_players WHERE career_save_id=${f.save.id} ORDER BY id`)).rows, old);
});
test("database rejects invalid entry identity and cross-save child references", async () => {
  const event = await local(), other = await f.saves.create(2, { slot: 1 });
  await f.events.initialize({ playerId: 2 }, other.id);
  const npc = String((await f.db.execute(sql`SELECT id FROM career_world_players WHERE career_save_id=${other.id} LIMIT 1`)).rows[0].id);
  await assert.rejects(f.db.execute(sql`INSERT INTO career_event_entries(career_save_id,event_id,participant_key,npc_id,status,identity) VALUES(${f.save.id},${event.id},${npc},${npc},'ENTERED','{}')`));
  await assert.rejects(f.db.execute(sql`INSERT INTO career_event_entries(career_save_id,event_id,participant_key,status,identity) VALUES(${f.save.id},${event.id},'not-human','ENTERED','{}')`));
});
