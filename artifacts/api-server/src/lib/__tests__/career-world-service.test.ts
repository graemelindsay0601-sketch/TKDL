import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { createCareerSaves } from "../../db/migrations/create_career_saves.ts";
import { createCareerWorld } from "../../db/migrations/create_career_world.ts";
import { createCareerService } from "../../career/service.ts";
import { createCareerWorldService } from "../../career/world/service.ts";
import { loadNpcs } from "../../career/world/repository.ts";
import { generateInitialWorld } from "../../career/world/generation.ts";
import { simulateNpcMatch } from "../../career/world/simulation.ts";
import { HARNESS_SEED } from "../../career/world/harness.ts";
import { targetPopulation } from "../../career/world/config.ts";

const pg = new PGlite();
const db = drizzle(pg);
const saves = createCareerService(db);
const worlds = createCareerWorldService(db);
const actor = { playerId: 1 };

before(async () => {
  await pg.exec(`CREATE TABLE players (id INTEGER PRIMARY KEY, points INTEGER); INSERT INTO players VALUES (1,42),(2,71);
    CREATE TABLE feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);
    CREATE TABLE outside_career (id INTEGER PRIMARY KEY, data JSONB); INSERT INTO outside_career VALUES (1,'{"tour":11,"coins":250,"practice":7}'::jsonb)`);
  await createCareerSaves(db);
  await createCareerWorld(db);
});
beforeEach(async () => { await pg.exec("DELETE FROM career_saves; UPDATE feature_flags SET enabled=true, admin_test_mode=false"); });
after(async () => { await pg.close(); });

async function initialized(slot = 1, player = 1) {
  const save = await saves.create(player, { slot });
  // Fixed server-side fixture seed; never a client input to the Career service.
  await db.execute(sql`UPDATE career_saves SET world_seed = ${slot === 1 ? HARNESS_SEED : "bc".repeat(32)} WHERE id = ${save.id}`);
  await worlds.initialize({ playerId: player }, save.id);
  return save;
}
async function snapshot(saveId: string) {
  return {
    players: await loadNpcs(db, saveId),
    world: (await db.execute(sql`SELECT * FROM career_world_state WHERE career_save_id=${saveId}`)).rows,
    periods: (await db.execute(sql`SELECT * FROM career_world_periods WHERE career_save_id=${saveId} ORDER BY season, kind, sequence`)).rows,
    matches: (await db.execute(sql`SELECT * FROM career_simulated_matches WHERE career_save_id=${saveId} ORDER BY match_key`)).rows,
  };
}
async function requestFor(saveId: string, matchKey = "a3-match-identity") {
  const [a, b] = await loadNpcs(db, saveId);
  return { matchKey, playerAId: a.id, playerBId: b.id, context: { category: "floor" as const, roundImportance: 0.2, elimination: false }, format: { bestOf: 7, firstThrow: 0 as const } };
}
const rejectsStatus = async (promise: Promise<unknown>, status: number) => assert.rejects(promise, error => (error as { status?: number }).status === status);

test("existing A1 saves initialize exactly once without rewriting seed or version; concurrent retry is safe", async () => {
  const save = await saves.create(1, { slot: 1 });
  const rootBefore = (await db.execute(sql`SELECT * FROM career_saves WHERE id=${save.id}`)).rows[0];
  const results = await Promise.all([worlds.initialize(actor, save.id), worlds.initialize(actor, save.id)]);
  assert.equal(results.filter(result => result.created).length, 1);
  const players = await loadNpcs(db, save.id);
  assert.equal(players.length, targetPopulation());
  assert.deepEqual([...players].sort((a, b) => a.id.localeCompare(b.id)), generateInitialWorld(String(rootBefore.world_seed), Number(rootBefore.world_generation_version)).sort((a, b) => a.id.localeCompare(b.id)));
  assert.deepEqual((await db.execute(sql`SELECT * FROM career_saves WHERE id=${save.id}`)).rows[0], rootBefore);
  const before = await snapshot(save.id);
  await worlds.initialize(actor, save.id);
  assert.deepEqual(await snapshot(save.id), before);
});

test("failed initialization rolls back all 220 NPCs and can be retried", async () => {
  const save = await saves.create(1, { slot: 1 });
  await pg.exec(`CREATE FUNCTION fail_world_init() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'world init fault'; END; $$ LANGUAGE plpgsql;
    CREATE TRIGGER fail_world_init BEFORE INSERT ON career_world_state FOR EACH ROW EXECUTE FUNCTION fail_world_init()`);
  try {
    await assert.rejects(worlds.initialize(actor, save.id));
    assert.equal((await loadNpcs(db, save.id)).length, 0);
    assert.equal((await saves.read(1, save.id)).status, "ACTIVE");
  } finally { await pg.exec("DROP TRIGGER fail_world_init ON career_world_state; DROP FUNCTION fail_world_init()"); }
  await worlds.initialize(actor, save.id);
  assert.equal((await loadNpcs(db, save.id)).length, 220);
});

test("public identity projection omits abilities, potential, development and seeds", async () => {
  const save = await initialized();
  const players = await worlds.listPlayers(actor, save.id);
  assert.equal(players.length, 220);
  const json = JSON.stringify(players);
  for (const hidden of ["potential", "development", "ability", "world_seed", "worldSeed", "wonderkid", "breakthroughAge"]) assert.ok(!json.includes(`"${hidden}"`));
});

test("feature gate and owner scoping protect internal world operations including admin preview", async () => {
  const save = await initialized();
  const request = await requestFor(save.id);
  const before = await snapshot(save.id);
  const stranger = { playerId: 2, isAdmin: true };
  for (const operation of [
    worlds.initialize(stranger, save.id), worlds.listPlayers(stranger, save.id), worlds.simulateMatch(stranger, save.id, request),
    worlds.advancePeriod(stranger, save.id, { season: 1, period: 1, elapsedYears: 0.1, opportunity: 1 }),
    worlds.processOffSeason(stranger, save.id, { season: 1, opportunity: 1 }),
  ]) await rejectsStatus(operation, 404);
  await pg.exec("UPDATE feature_flags SET enabled=false, admin_test_mode=true");
  await rejectsStatus(worlds.initialize(actor, save.id), 404);
  assert.equal((await worlds.listPlayers({ ...actor, isAdmin: true }, save.id)).length, 220);
  assert.deepEqual(await snapshot(save.id), before);
});

test("completed simulations persist inputs and actual stats; retries never reapply form or reroll", async () => {
  const save = await initialized();
  const request = await requestFor(save.id);
  const [first, retry] = await Promise.all([worlds.simulateMatch(actor, save.id, request), worlds.simulateMatch(actor, save.id, request)]);
  assert.deepEqual(first, retry);
  const before = await snapshot(save.id);
  assert.equal(before.matches.length, 1);
  assert.deepEqual(before.matches[0].result, first);
  assert.deepEqual(simulateNpcMatch(before.matches[0].input_snapshot as Parameters<typeof simulateNpcMatch>[0]), first);
  assert.deepEqual(await worlds.simulateMatch(actor, save.id, request), first);
  assert.deepEqual(await snapshot(save.id), before);
  await rejectsStatus(worlds.simulateMatch(actor, save.id, { ...request, format: { bestOf: 31, firstThrow: 0 } }), 409);
  await rejectsStatus(worlds.simulateMatch(actor, save.id, { ...request, context: { ...request.context, category: "major" } }), 409);
  assert.deepEqual(await snapshot(save.id), before);
});

test("result and form updates are atomic when persistence fails", async () => {
  const save = await initialized();
  const request = await requestFor(save.id);
  const before = await snapshot(save.id);
  await pg.exec(`CREATE FUNCTION fail_npc_update() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'npc update fault'; END; $$ LANGUAGE plpgsql;
    CREATE TRIGGER fail_npc_update BEFORE UPDATE ON career_world_players FOR EACH ROW EXECUTE FUNCTION fail_npc_update()`);
  try {
    await assert.rejects(worlds.simulateMatch(actor, save.id, request));
    assert.deepEqual(await snapshot(save.id), before);
  } finally { await pg.exec("DROP TRIGGER fail_npc_update ON career_world_players; DROP FUNCTION fail_npc_update()"); }
  await worlds.simulateMatch(actor, save.id, request);
  assert.equal((await snapshot(save.id)).matches.length, 1);
});

test("periods and off-seasons are monotonic and retry-safe, with one year of development and one ageing step", async () => {
  const save = await initialized();
  const before = await loadNpcs(db, save.id);
  const request = { season: 1, period: 1, elapsedYears: 0.5, opportunity: 0.8 };
  const first = await worlds.advancePeriod(actor, save.id, request);
  const after = await snapshot(save.id);
  assert.deepEqual(await worlds.advancePeriod(actor, save.id, request), first);
  assert.deepEqual(await snapshot(save.id), after);
  await rejectsStatus(worlds.advancePeriod(actor, save.id, { ...request, elapsedYears: 0.2 }), 409);
  await rejectsStatus(worlds.advancePeriod(actor, save.id, { ...request, period: 3 }), 409);
  await rejectsStatus(worlds.advancePeriod(actor, save.id, { ...request, period: 2, elapsedYears: 0.6 }), 409);
  const off = await worlds.processOffSeason(actor, save.id, { season: 1, opportunity: 0.8 });
  const complete = await snapshot(save.id);
  assert.deepEqual(await worlds.processOffSeason(actor, save.id, { season: 1, opportunity: 0.8 }), off);
  assert.deepEqual(await snapshot(save.id), complete);
  assert.equal((await saves.read(1, save.id)).currentSeason, 2);
  assert.equal((await saves.read(1, save.id)).currentWeek, 1);
  assert.equal(complete.world[0].elapsed_year, 0);
  for (const npc of before) {
    const evolved = complete.players.find(row => row.id === npc.id)!;
    assert.equal(evolved.age, npc.age + (evolved.status === "ACTIVE" ? 1 : 0));
  }
  assert.equal(complete.players.filter(npc => npc.status === "ACTIVE").length, 220);
  assert.equal(complete.periods.length, 2);
});

test("retired NPC identities and match history persist while new generations restore population", async () => {
  const save = await initialized();
  const request = await requestFor(save.id);
  const result = await worlds.simulateMatch(actor, save.id, request);
  await db.execute(sql`UPDATE career_world_players SET age=110, stage='VETERAN' WHERE career_save_id=${save.id}`);
  await worlds.processOffSeason(actor, save.id, { season: 1, opportunity: 0.5 });
  const state = await snapshot(save.id);
  assert.equal(state.players.length, 440);
  assert.equal(state.players.filter(npc => npc.status === "RETIRED").length, 220);
  assert.equal(state.players.filter(npc => npc.status === "ACTIVE").length, 220);
  assert.deepEqual(state.matches[0].result, result);
  await rejectsStatus(worlds.simulateMatch(actor, save.id, { ...request, matchKey: "retired-players" }), 409);
  assert.deepEqual(await worlds.simulateMatch(actor, save.id, request), result);
});

test("save retirement preserves NPCs and blocks every world mutation; uninitialized archives stay empty", async () => {
  const save = await initialized();
  const request = await requestFor(save.id);
  const before = await snapshot(save.id);
  await saves.retire(1, save.id);
  await rejectsStatus(worlds.initialize(actor, save.id), 409);
  await rejectsStatus(worlds.simulateMatch(actor, save.id, request), 409);
  await rejectsStatus(worlds.advancePeriod(actor, save.id, { season: 1, period: 1, elapsedYears: 0.1, opportunity: 1 }), 409);
  await rejectsStatus(worlds.processOffSeason(actor, save.id, { season: 1, opportunity: 1 }), 409);
  assert.deepEqual(await snapshot(save.id), before);
  assert.equal((await worlds.listPlayers(actor, save.id)).length, 220);
  const empty = await saves.create(1, { slot: 1 });
  await saves.retire(1, empty.id);
  await rejectsStatus(worlds.initialize(actor, empty.id), 409);
  assert.equal((await worlds.listPlayers(actor, empty.id)).length, 0);
});

test("A1 restart/delete cascade the complete A2 universe without affecting other saves or game modes", async () => {
  const save = await initialized();
  const other = await initialized(2);
  const otherBefore = await snapshot(other.id);
  const outside = (await db.execute(sql`SELECT * FROM outside_career`)).rows;
  const playersBefore = (await db.execute(sql`SELECT * FROM players ORDER BY id`)).rows;
  await worlds.simulateMatch(actor, save.id, await requestFor(save.id));
  await worlds.advancePeriod(actor, save.id, { season: 1, period: 1, elapsedYears: 0.1, opportunity: 1 });
  const originalIds = new Set((await loadNpcs(db, save.id)).map(npc => npc.id));
  const restarted = await saves.restart(1, save.id);
  assert.deepEqual(await snapshot(save.id), { players: [], world: [], periods: [], matches: [] });
  await worlds.initialize(actor, restarted.id);
  assert.ok((await loadNpcs(db, restarted.id)).every(npc => !originalIds.has(npc.id)));
  await worlds.simulateMatch(actor, restarted.id, await requestFor(restarted.id));
  await saves.delete(1, restarted.id);
  assert.deepEqual(await snapshot(restarted.id), { players: [], world: [], periods: [], matches: [] });
  assert.deepEqual(await snapshot(other.id), otherBefore);
  assert.deepEqual((await db.execute(sql`SELECT * FROM outside_career`)).rows, outside);
  assert.deepEqual((await db.execute(sql`SELECT * FROM players ORDER BY id`)).rows, playersBefore);
});

test("database bounds and composite foreign keys reject cross-save participants and invalid state", async () => {
  const save = await initialized();
  const other = await initialized(2);
  const [npc] = await loadNpcs(db, save.id), [foreign] = await loadNpcs(db, other.id);
  const request = await requestFor(save.id);
  await rejectsStatus(worlds.simulateMatch(actor, save.id, { ...request, playerBId: foreign.id }), 404);
  for (const query of [
    sql`UPDATE career_world_players SET scoring=101 WHERE career_save_id=${save.id}`,
    sql`UPDATE career_world_players SET form=2 WHERE career_save_id=${save.id}`,
    sql`UPDATE career_world_players SET potential=0 WHERE career_save_id=${save.id}`,
    sql`UPDATE career_world_players SET age=2 WHERE career_save_id=${save.id}`,
    sql`UPDATE career_world_players SET stage='CHAMPION' WHERE career_save_id=${save.id}`,
    sql`UPDATE career_world_players SET status='RETIRED' WHERE career_save_id=${save.id}`,
    sql`UPDATE career_world_players SET tendencies='{"local":null,"floor":0,"stage":0,"qualifier":0,"major":0}'::jsonb WHERE career_save_id=${save.id}`,
    sql`UPDATE career_world_players SET tendencies='{}'::jsonb WHERE career_save_id=${save.id}`,
    sql`INSERT INTO career_simulated_matches (career_save_id,id,match_key,season,period,simulation_version,player_a_id,player_b_id,winner_id,request,input_snapshot,result)
      VALUES (${save.id},${randomUUID()},'cross-save',1,0,1,${npc.id},${foreign.id},${npc.id},'{}','{}','{}')`,
  ]) await assert.rejects(db.execute(query));
});

test("A2 migration is repeatable on populated A1/A2 saves and unsupported versions fail closed", async () => {
  const save = await initialized();
  const before = await snapshot(save.id);
  await createCareerWorld(db);
  await createCareerWorld(db);
  assert.deepEqual(await snapshot(save.id), before);
  await db.execute(sql`UPDATE career_saves SET world_generation_version=99 WHERE id=${save.id}`);
  await assert.rejects(worlds.initialize(actor, save.id), /Unsupported/);
  assert.equal((await db.execute(sql`SELECT world_generation_version FROM career_saves WHERE id=${save.id}`)).rows[0].world_generation_version, 99);
  assert.deepEqual(await snapshot(save.id), before);
});

test("world operations do not accept client seed overrides or skip-time requests", async () => {
  const save = await initialized();
  const before = await snapshot(save.id);
  await assert.rejects(worlds.simulateMatch(actor, save.id, { ...await requestFor(save.id), seed: "client" }));
  await assert.rejects(worlds.advancePeriod(actor, save.id, { season: 1, period: 1, elapsedYears: 10, opportunity: 1 }));
  await rejectsStatus(worlds.processOffSeason(actor, save.id, { season: 10, opportunity: 1 }), 409);
  assert.deepEqual(await snapshot(save.id), before);
});

test("failed period and off-season persistence restore all NPC and clock state", async () => {
  const save = await initialized();
  const before = await snapshot(save.id);
  const rootBefore = await saves.read(1, save.id);
  await pg.exec(`CREATE FUNCTION fail_world_period() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'period fault'; END; $$ LANGUAGE plpgsql;
    CREATE TRIGGER fail_world_period BEFORE INSERT ON career_world_periods FOR EACH ROW EXECUTE FUNCTION fail_world_period()`);
  try {
    await assert.rejects(worlds.advancePeriod(actor, save.id, { season: 1, period: 1, elapsedYears: 0.5, opportunity: 1 }));
    await assert.rejects(worlds.processOffSeason(actor, save.id, { season: 1, opportunity: 1 }));
    assert.deepEqual(await snapshot(save.id), before);
    assert.deepEqual(await saves.read(1, save.id), rootBefore);
  } finally { await pg.exec("DROP TRIGGER fail_world_period ON career_world_periods; DROP FUNCTION fail_world_period()"); }
});

test("database uniqueness protects world and match identities independently of service checks", async () => {
  const save = await initialized();
  const request = await requestFor(save.id);
  await worlds.simulateMatch(actor, save.id, request);
  const [first, second] = await loadNpcs(db, save.id);
  await assert.rejects(db.execute(sql`UPDATE career_world_players SET world_key=${first.worldKey} WHERE career_save_id=${save.id} AND id=${second.id}`));
  await assert.rejects(db.execute(sql`INSERT INTO career_simulated_matches (career_save_id,id,match_key,season,period,simulation_version,player_a_id,player_b_id,winner_id,request,input_snapshot,result)
    SELECT career_save_id,${randomUUID()}::uuid,match_key,season,period,simulation_version,player_a_id,player_b_id,winner_id,request,input_snapshot,result
    FROM career_simulated_matches WHERE career_save_id=${save.id}`));
});

test("A2 migration rolls back its new tables when a late DDL step fails", async () => {
  const isolated = new PGlite();
  try {
    await isolated.exec("CREATE TABLE career_saves (id UUID PRIMARY KEY); CREATE TABLE career_simulated_matches (id UUID)");
    await assert.rejects(createCareerWorld(drizzle(isolated)));
    const tables = await isolated.query<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
    assert.deepEqual(tables.rows.map(row => row.tablename), ["career_saves", "career_simulated_matches"]);
  } finally { await isolated.close(); }
});
