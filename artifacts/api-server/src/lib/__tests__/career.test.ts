import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import express from "express";
import session from "express-session";
import pino from "pino";
import { createCareerSaves } from "../../db/migrations/create_career_saves.ts";
import { createCareerService } from "../../career/service.ts";
import { createCareerRouter } from "../../career/router.ts";
import { CAREER_DEFAULTS, CAREER_VERSIONS } from "../../career/config.ts";

// Runs real PostgreSQL DDL/constraints/transactions in WASM, with no production URL.
const pg = new PGlite();
const db = drizzle(pg);
const service = createCareerService(db);
let server: ReturnType<ReturnType<typeof express>["listen"]>;
let base: string;
const cookies: Record<string, string> = {};
const unexpectedErrors: unknown[] = [];
const testLogger = pino({ level: "error" }, { write(message: string) { unexpectedErrors.push(message); } });

before(async () => {
  await pg.exec(`
    CREATE TABLE players (id INTEGER PRIMARY KEY, name TEXT NOT NULL, points INTEGER NOT NULL);
    INSERT INTO players VALUES (1, 'Player A', 55), (2, 'Player B', 90);
    CREATE TABLE feature_flags (
      feature_name TEXT UNIQUE NOT NULL, enabled BOOLEAN NOT NULL,
      admin_test_mode BOOLEAN NOT NULL, description TEXT
    );
    CREATE TABLE unrelated_tkdl_state (player_id INTEGER REFERENCES players(id), data JSONB NOT NULL);
    INSERT INTO unrelated_tkdl_state VALUES (1, '{"coins":99,"tourRun":14,"trophies":[1,2],"leagueStats":42,"cosmetics":[3],"master501":8,"cardClash":9,"achievements":[7]}');
  `);
  await createCareerSaves(db);
  const app = express();
  app.use(express.json());
  app.use(session({ secret: "career-isolated-test-session-secret", resave: false, saveUninitialized: false }));
  // Test-only sign-in harness exercises real signed session cookies. Never registered in TKDL.
  app.post("/test/login/:player", (req, res) => {
    Object.assign(req.session, { playerId: Number(req.params.player), isAdmin: req.body.admin === true });
    res.json({ ok: true });
  });
  app.use((req, _res, next) => {
    req.log = testLogger;
    next();
  });
  app.use("/api/career", createCareerRouter(service));
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  for (const [name, player, admin] of [["a", 1, false], ["b", 2, false], ["admin", 1, true]] as const) {
    const response = await fetch(`${base}/test/login/${player}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ admin }),
    });
    cookies[name] = response.headers.get("set-cookie")!.split(";")[0];
    await response.json();
  }
});

beforeEach(async () => {
  await pg.exec("DELETE FROM career_saves; UPDATE feature_flags SET enabled = true, admin_test_mode = false");
});

after(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  await pg.close();
  assert.deepEqual(unexpectedErrors, []);
});

async function request(method: string, path = "/saves", body?: unknown, user = "a") {
  const response = await fetch(`${base}/api/career${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookies[user] ? { Cookie: cookies[user] } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  // HTTP assertions intentionally inspect both success and error envelopes.
  const bodyData = response.status === 204 ? {} : await response.json() as Record<string, any>;
  return { status: response.status, body: bodyData };
}

async function stored(id: string) {
  return (await db.execute(sql`SELECT * FROM career_saves WHERE id = ${id}`)).rows[0];
}

async function unrelated() {
  return {
    players: (await db.execute(sql`SELECT * FROM players ORDER BY id`)).rows,
    modes: (await db.execute(sql`SELECT * FROM unrelated_tkdl_state ORDER BY player_id`)).rows,
  };
}

test("authenticated creation persists Day 1 defaults, server seed, versions and initial ledger", async () => {
  const result = await request("POST", "/saves", { slot: 1 });
  assert.equal(result.status, 201);
  const save = result.body;
  assert.equal(save.slotNumber, 1);
  assert.equal(save.status, "ACTIVE");
  assert.equal(save.balancePence, 25_000);
  assert.equal(save.currency, "GBP");
  assert.equal(save.currentSeason, 1);
  assert.equal(save.currentWeek, 1);
  assert.equal(save.difficulty, "STANDARD");
  assert.equal(save.standing, "Unknown Amateur");
  assert.equal(save.professionalRanking, null);
  assert.equal(save.professionalRankingMoneyPence, 0);
  assert.equal(save.sponsor, null);
  assert.equal(save.hasTourCard, false);
  assert.equal(save.retiredAt, null);
  for (const [key, value] of Object.entries(CAREER_VERSIONS)) assert.equal(save[key], value);
  for (const key of ["worldSeed", "world_seed", "playerId", "player_id", "settingsSnapshot", "settings_snapshot"]) assert.equal(key in save, false);
  const row = await stored(save.id);
  assert.equal(row.player_id, 1);
  assert.match(String(row.world_seed), /^[a-f0-9]{64}$/);
  assert.deepEqual(row.settings_snapshot, CAREER_DEFAULTS);
  const ledger = (await db.execute(sql`SELECT kind, amount_pence FROM career_finance_entries WHERE career_save_id = ${save.id}`)).rows;
  assert.deepEqual(ledger, [{ kind: "CAREER_START", amount_pence: 25_000 }]);
  assert.equal((await request("GET", `/saves/${save.id}`)).status, 200);
});

test("valid difficulties and trimmed optional display name", async () => {
  for (const [index, difficulty] of ["ACCESSIBLE", "STANDARD", "CHALLENGING"].entries()) {
    const { status, body } = await request("POST", "/saves", { slot: index + 1, difficulty, careerName: "  Amateur  " });
    assert.equal(status, 201);
    assert.equal(body.difficulty, difficulty);
    assert.equal(body.careerName, "Amateur");
  }
});

test("invalid slots, difficulty, names and client-controlled server fields are rejected", async () => {
  for (const slot of [-1, 0, 4, 1.5, "1", null]) {
    assert.equal((await request("POST", "/saves", { slot })).status, 400);
  }
  for (const body of [null, {}, { slot: 1, difficulty: "elite" }, { slot: 1, careerName: " " }, { slot: 1, careerName: "a".repeat(81) },
    { slot: 1, playerId: 2 }, { slot: 1, worldSeed: "client" }, { slot: 1, balancePence: 999 }, { slot: 1, careerSchemaVersion: 99 }]) {
    // Express rejects literal null JSON before our router; use service for that shape.
    if (body === null) await assert.rejects(service.create(1, body));
    else assert.equal((await request("POST", "/saves", body)).status, 400);
  }
  assert.equal((await request("GET", "/saves/not-a-uuid")).status, 400);
});

test("three deterministic slots; per-player active uniqueness without a lifetime cap", async () => {
  assert.deepEqual((await request("GET")).body, {
    slots: [1, 2, 3].map(slotNumber => ({ slotNumber, career: null })), archived: [],
  });
  const first = await request("POST", "/saves", { slot: 1 });
  assert.equal((await request("POST", "/saves", { slot: 1 })).status, 409);
  assert.equal((await request("POST", "/saves", { slot: 2 })).status, 201);
  assert.equal((await request("POST", "/saves", { slot: 3 })).status, 201);
  assert.equal((await request("POST", "/saves", { slot: 1 }, "b")).status, 201);
  const listing = (await request("GET")).body;
  assert.equal(listing.slots[0].career.id, first.body.id);
  assert.equal(listing.slots.filter((slot: { career: unknown }) => slot.career).length, 3);
  const seeds = (await db.execute(sql`SELECT world_seed FROM career_saves`)).rows.map(row => row.world_seed);
  assert.equal(new Set(seeds).size, 4);
});

test("all lifecycle endpoints require a session", async () => {
  const id = randomUUID();
  for (const [method, path, body] of [
    ["GET", "/saves", undefined], ["POST", "/saves", { slot: 1 }],
    ["GET", `/saves/${id}`, undefined], ["POST", `/saves/${id}/restart`, {}],
    ["POST", `/saves/${id}/retire`, {}], ["DELETE", `/saves/${id}`, undefined],
  ] as const) assert.equal((await request(method, path, body, "anonymous")).status, 401);
});

test("other owners and unknown resources return identical 404s, including for admins", async () => {
  const career = await service.create(2, { slot: 1 });
  const initial = await stored(career.id);
  for (const user of ["a", "admin"]) {
    for (const [method, suffix] of [["GET", ""], ["POST", "/restart"], ["POST", "/retire"], ["DELETE", ""]]) {
      const foreign = await request(method, `/saves/${career.id}${suffix}`, undefined, user);
      const missing = await request(method, `/saves/${randomUUID()}${suffix}`, undefined, user);
      assert.equal(foreign.status, 404);
      assert.deepEqual(foreign, missing);
    }
  }
  assert.deepEqual(await stored(career.id), initial);
  assert.equal((await request("GET")).body.slots.every((slot: { career: unknown }) => slot.career === null), true);
});

test("feature flag denies by default, supports admin preview, and never bypasses ownership", async () => {
  await pg.exec("UPDATE feature_flags SET enabled = false, admin_test_mode = false");
  assert.equal((await request("POST", "/saves", { slot: 1 })).status, 404);
  assert.equal((await request("GET", "/saves", undefined, "admin")).status, 404);
  await pg.exec("UPDATE feature_flags SET admin_test_mode = true");
  assert.equal((await request("GET")).status, 404);
  assert.equal((await request("POST", "/saves", { slot: 1 }, "admin")).status, 201);
  await pg.exec("DELETE FROM feature_flags WHERE feature_name = 'tour_career_2'");
  assert.equal((await request("GET", "/saves", undefined, "admin")).status, 404);
  await createCareerSaves(db);
});

test("restart replaces universe, resets progression/versions, cascades children and isolates other modes/saves", async () => {
  const career = await service.create(1, { slot: 2, difficulty: "CHALLENGING", careerName: "My career" });
  const other = await service.create(1, { slot: 3 });
  const otherBefore = await stored(other.id);
  const unrelatedBefore = await unrelated();
  const seed = (await stored(career.id)).world_seed;
  await db.execute(sql`
    UPDATE career_saves SET balance_pence = 90000, current_season = 8, current_week = 31,
      professional_ranking = 42, professional_ranking_money_pence = 8000, sponsor = 'Sponsor',
      has_tour_card = true, standing = 'Professional', career_schema_version = 9,
      world_generation_version = 9, event_database_version = 9, player_database_version = 9,
      settings_snapshot = '{"old":true}'::jsonb WHERE id = ${career.id}
  `);
  // A future child requires only a cascading FK, no changes to restart code.
  await pg.exec("CREATE TABLE career_test_child (career_save_id UUID REFERENCES career_saves(id) ON DELETE CASCADE, value TEXT)");
  try {
    await db.execute(sql`INSERT INTO career_test_child VALUES (${career.id}, 'progress'), (${other.id}, 'keep')`);
    const response = await request("POST", `/saves/${career.id}/restart`, {});
    assert.equal(response.status, 200);
    const fresh = response.body;
    assert.notEqual(fresh.id, career.id);
    assert.equal(fresh.slotNumber, 2);
    assert.equal(fresh.careerName, "My career");
    assert.equal(fresh.difficulty, "CHALLENGING");
    assert.equal(fresh.balancePence, 25_000);
    assert.equal(fresh.currentSeason, 1);
    assert.equal(fresh.currentWeek, 1);
    assert.equal(fresh.professionalRanking, null);
    assert.equal(fresh.professionalRankingMoneyPence, 0);
    assert.equal(fresh.sponsor, null);
    assert.equal(fresh.hasTourCard, false);
    assert.equal(fresh.standing, "Unknown Amateur");
    for (const [key, value] of Object.entries(CAREER_VERSIONS)) assert.equal(fresh[key], value);
    assert.notEqual((await stored(fresh.id)).world_seed, seed);
    assert.deepEqual((await stored(fresh.id)).settings_snapshot, { ...CAREER_DEFAULTS, difficulty: "CHALLENGING" });
    assert.equal(await stored(career.id), undefined);
    assert.equal((await request("GET", `/saves/${career.id}`)).status, 404);
    assert.deepEqual((await db.execute(sql`SELECT * FROM career_test_child`)).rows, [{ career_save_id: other.id, value: "keep" }]);
    const ledger = (await db.execute(sql`SELECT * FROM career_finance_entries WHERE career_save_id = ${career.id}`)).rows;
    assert.equal(ledger.length, 0);
    assert.equal((await db.execute(sql`SELECT * FROM career_finance_entries WHERE career_save_id = ${fresh.id}`)).rows.length, 1);
    assert.deepEqual(await stored(other.id), otherBefore);
    assert.deepEqual(await unrelated(), unrelatedBefore);
  } finally {
    await pg.exec("DROP TABLE career_test_child");
  }
});

test("retirement preserves the universe and ledger, rejects restart/re-retire, permits unlimited slot reuse", async () => {
  const ids: string[] = [];
  for (let i = 0; i < 5; i++) {
    const career = await service.create(1, { slot: 1 });
    const seed = (await stored(career.id)).world_seed;
    const retired = await request("POST", `/saves/${career.id}/retire`, {});
    assert.equal(retired.status, 200);
    assert.equal(retired.body.status, "RETIRED");
    assert.ok(retired.body.retiredAt);
    assert.equal((await stored(career.id)).world_seed, seed);
    assert.equal((await request("GET", `/saves/${career.id}`)).status, 200);
    assert.equal((await request("POST", `/saves/${career.id}/restart`, {})).status, 409);
    assert.equal((await request("POST", `/saves/${career.id}/retire`, {})).status, 409);
    ids.push(career.id);
  }
  const listed = (await request("GET")).body;
  assert.equal(listed.slots[0].career, null);
  assert.deepEqual(new Set(listed.archived.map((row: { id: string }) => row.id)), new Set(ids));
  assert.equal((await request("GET", "/saves", undefined, "b")).body.archived.length, 0);
  assert.equal((await db.execute(sql`SELECT * FROM career_finance_entries`)).rows.length, 5);
  assert.equal((await request("POST", "/saves", { slot: 1 })).status, 201);
});

test("delete cascades only the selected universe, including an explicitly deleted archive", async () => {
  const unrelatedBefore = await unrelated();
  const active = await service.create(1, { slot: 1 });
  const archived = await service.create(1, { slot: 2 });
  await service.retire(1, archived.id);
  const other = await service.create(1, { slot: 2 });
  const beforeOther = await stored(other.id);
  for (const career of [active, archived]) {
    assert.equal((await request("DELETE", `/saves/${career.id}`)).status, 204);
    assert.equal(await stored(career.id), undefined);
    assert.equal((await db.execute(sql`SELECT * FROM career_finance_entries WHERE career_save_id = ${career.id}`)).rows.length, 0);
    assert.equal((await request("DELETE", `/saves/${career.id}`)).status, 404);
  }
  assert.deepEqual(await stored(other.id), beforeOther);
  assert.deepEqual(await unrelated(), unrelatedBefore);
});

test("creation and restart roll back fully if the initial ledger write fails", async () => {
  const career = await service.create(1, { slot: 1 });
  const before = await stored(career.id);
  const ledgerBefore = (await db.execute(sql`SELECT * FROM career_finance_entries`)).rows;
  await pg.exec(`CREATE FUNCTION career_test_fail() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'injected ledger failure'; END; $$ LANGUAGE plpgsql;
    CREATE TRIGGER career_test_fail BEFORE INSERT ON career_finance_entries FOR EACH ROW EXECUTE FUNCTION career_test_fail()`);
  try {
    await assert.rejects(service.create(1, { slot: 2 }));
    await assert.rejects(service.restart(1, career.id));
    assert.deepEqual(await stored(career.id), before);
    assert.equal((await service.list(1)).slots[1].career, null);
    assert.deepEqual((await db.execute(sql`SELECT * FROM career_finance_entries`)).rows, ledgerBefore);
  } finally {
    await pg.exec("DROP TRIGGER career_test_fail ON career_finance_entries; DROP FUNCTION career_test_fail()");
  }
});

test("competing create requests yield one save, one ledger entry, and a 409", async () => {
  const results = await Promise.all([request("POST", "/saves", { slot: 1 }), request("POST", "/saves", { slot: 1 })]);
  assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
  assert.equal((await db.execute(sql`SELECT * FROM career_saves`)).rows.length, 1);
  assert.equal((await db.execute(sql`SELECT * FROM career_finance_entries`)).rows.length, 1);
});

test("database rejects bypassed slot/status/version/ownership checks and duplicate active slots", async () => {
  const career = await service.create(1, { slot: 1 });
  const second = await service.create(1, { slot: 2 });
  for (const query of [
    sql`UPDATE career_saves SET slot_number = 4 WHERE id = ${career.id}`,
    sql`UPDATE career_saves SET slot_number = 1 WHERE id = ${second.id}`,
    sql`UPDATE career_saves SET difficulty = 'elite' WHERE id = ${career.id}`,
    sql`UPDATE career_saves SET status = 'RETIRED' WHERE id = ${career.id}`,
    sql`UPDATE career_saves SET career_schema_version = 0 WHERE id = ${career.id}`,
    sql`UPDATE career_saves SET world_seed = 'client' WHERE id = ${career.id}`,
    sql`UPDATE career_saves SET player_id = 999 WHERE id = ${career.id}`,
    sql`INSERT INTO career_finance_entries (id, career_save_id, kind, amount_pence) VALUES (${randomUUID()}, ${randomUUID()}, 'CAREER_START', 25000)`,
  ]) await assert.rejects(db.execute(query));
});

test("migration rerun preserves careers, ledger and administrator feature settings", async () => {
  const career = await service.create(1, { slot: 1 });
  const before = await stored(career.id);
  const unrelatedBefore = await unrelated();
  await pg.exec("UPDATE feature_flags SET enabled = false, admin_test_mode = true");
  await createCareerSaves(db);
  await createCareerSaves(db);
  assert.deepEqual(await stored(career.id), before);
  assert.equal(await service.isAvailable(false), false);
  assert.equal(await service.isAvailable(true), true);
  assert.equal((await db.execute(sql`SELECT * FROM career_finance_entries`)).rows.length, 1);
  assert.deepEqual(await unrelated(), unrelatedBefore);
});

test("lifecycle request bodies cannot override player, seed, settings or state", async () => {
  const career = await service.create(1, { slot: 1 });
  const before = await stored(career.id);
  for (const suffix of ["restart", "retire"]) {
    assert.equal((await request("POST", `/saves/${career.id}/${suffix}`, { playerId: 2 })).status, 400);
  }
  assert.equal((await request("DELETE", `/saves/${career.id}`, { playerId: 2 })).status, 400);
  assert.deepEqual(await stored(career.id), before);
});

test("failed migration rolls back its tables instead of leaving a partial foundation", async () => {
  const isolated = new PGlite();
  try {
    // Missing feature_flags deliberately fails the final statement.
    await isolated.exec("CREATE TABLE players (id INTEGER PRIMARY KEY)");
    await assert.rejects(createCareerSaves(drizzle(isolated)));
    const result = await isolated.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
    assert.deepEqual(result.rows, [{ tablename: "players" }]);
  } finally {
    await isolated.close();
  }
});

test("competing restart requests cannot create two replacement universes", async () => {
  const career = await service.create(1, { slot: 1 });
  const results = await Promise.all([
    request("POST", `/saves/${career.id}/restart`, {}),
    request("POST", `/saves/${career.id}/restart`, {}),
  ]);
  assert.deepEqual(results.map(result => result.status).sort(), [200, 404]);
  assert.equal((await db.execute(sql`SELECT * FROM career_saves`)).rows.length, 1);
  assert.equal((await db.execute(sql`SELECT * FROM career_finance_entries`)).rows.length, 1);
});

test("retiring one save leaves another save and unrelated TKDL state untouched", async () => {
  const career = await service.create(1, { slot: 1 });
  const other = await service.create(1, { slot: 2 });
  const beforeOther = await stored(other.id);
  const beforeUnrelated = await unrelated();
  await service.retire(1, career.id);
  assert.deepEqual(await stored(other.id), beforeOther);
  assert.deepEqual(await unrelated(), beforeUnrelated);
});
