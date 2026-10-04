import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import type { AddressInfo } from "node:net";
import express from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql, getTableColumns } from "drizzle-orm";
import { bootstrapCareerBeta, createCareerBetaRouter, careerBetaEnabled } from "../../beta/career-fixture.ts";
import { createCareerSaves } from "../../db/migrations/create_career_saves.ts";
import { createCareerWorld } from "../../db/migrations/create_career_world.ts";
import { createCareerCalendar } from "../../db/migrations/create_career_calendar.ts";
import { createCareerFinance } from "../../db/migrations/create_career_finance.ts";
import { createCareerSporting } from "../../db/migrations/create_career_sporting.ts";
import { createCareerService } from "../../career/service.ts";
import { createCareerRouter } from "../../career/router.ts";
import { createCareerSportingService } from "../../career/sporting/service.ts";
import { createCareerSportingRouter } from "../../career/sporting/router.ts";
import { createCareerCalendarRouter } from "../../career/calendar/router.ts";
import { createCareerLiveMatchService } from "../../career/live/service.ts";
import { createCareerLiveRouter } from "../../career/live/router.ts";
import { HARNESS_SEED } from "../../career/world/harness.ts";

const pg = new PGlite(), db = drizzle(pg), env: NodeJS.ProcessEnv = { NODE_ENV: "production" };
const saves = createCareerService(db), career = createCareerSportingService(db);
const password = randomBytes(24).toString("hex");
let server: ReturnType<ReturnType<typeof express>["listen"]>, base: string;
before(async () => {
  await pg.exec(`CREATE TABLE players(id serial PRIMARY KEY,player_id text UNIQUE NOT NULL,name text NOT NULL,status text DEFAULT 'ACTIVE',is_active boolean DEFAULT true);
    CREATE TABLE users(id serial PRIMARY KEY,username text UNIQUE NOT NULL,password_hash text NOT NULL,player_id integer NOT NULL,is_admin boolean NOT NULL DEFAULT false,last_login_at timestamptz,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
    CREATE TABLE feature_flags(feature_name text UNIQUE,enabled boolean,admin_test_mode boolean,description text);
    INSERT INTO players(player_id,name) VALUES('P001','Ordinary player');
    CREATE FUNCTION pg_advisory_xact_lock(integer) RETURNS void LANGUAGE SQL AS 'SELECT';`);
  await db.execute(sql`INSERT INTO users(username,password_hash,player_id,is_admin) VALUES('ordinary',${await bcrypt.hash(password, 4)},1,false)`);
  await createCareerSaves(db); await createCareerWorld(db); await createCareerCalendar(db); await createCareerFinance(db); await createCareerSporting(db);
  // Load the UNCHANGED production auth router against the isolated PostgreSQL
  // adapter. No production database URL or credentials are loaded by this test.
  (globalThis as any).__careerBetaTestDb = db;
  const source = `export const db=globalThis.__careerBetaTestDb; export { usersTable } from ${JSON.stringify(new URL("../../../../../lib/db/src/schema/users.ts", import.meta.url).href)}; export { playersTable } from ${JSON.stringify(new URL("../../../../../lib/db/src/schema/players.ts", import.meta.url).href)};`;
  const hooks = registerHooks({ resolve(specifier, context, next) {
    if (specifier === "@workspace/db") return { url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true };
    if (specifier.startsWith(".") && context.parentURL) {
      const ts = new URL(`${specifier}.ts`, context.parentURL);
      if (ts.protocol === "file:" && existsSync(ts)) return next(ts.href, context);
    }
    return next(specifier, context);
  } });
  const auth = (await import("../../routes/auth.ts")).default;
  hooks.deregister();
  const { playersTable } = await import("../../../../../lib/db/src/schema/players.ts");
  for (const column of Object.values(getTableColumns(playersTable))) {
    if (!["id", "player_id", "name", "status", "is_active"].includes(column.name))
      await pg.exec(`ALTER TABLE players ADD COLUMN "${column.name}" ${column.getSQLType()}`);
  }
  const app = express(); app.set("trust proxy", 1);
  app.use(express.json()); app.use(express.urlencoded({ extended: false }));
  app.use(session({ secret: randomBytes(32).toString("hex"), name: "tkdl.sid", resave: false, saveUninitialized: false,
    cookie: { secure: true, httpOnly: true, sameSite: "strict" } }));
  app.use((req, _res, next) => { (req as any).log = { info() {}, error() {} }; next(); });
  app.use("/api", createCareerBetaRouter(db, env)); app.use("/api", auth);
  const available = (admin: boolean) => saves.isAvailable(admin);
  app.use("/api/career", createCareerLiveRouter(createCareerLiveMatchService(db, career.calendar), available));
  app.use("/api/career", createCareerSportingRouter(career, available));
  app.use("/api/career", createCareerCalendarRouter(career.calendar, available));
  app.use("/api/career", createCareerRouter(saves));
  server = app.listen(0); base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => { server?.close(); await pg.close(); delete (globalThis as any).__careerBetaTestDb; });
async function call(path: string, cookie = "", body?: unknown) {
  return fetch(base + path, { method: body === undefined ? "GET" : "POST", redirect: "manual",
    headers: { "Content-Type": "application/json", "X-Forwarded-Proto": "https", ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
}
const cookieOf = (r: Response) => r.headers.get("set-cookie")!.split(";")[0];
const json = async (r: Response): Promise<any> => r.json();
async function entry() {
  const r = await call("/api/auth/career-beta"); assert.equal(r.status, 200);
  assert.match(r.headers.get("set-cookie")!, /Secure/); assert.match(r.headers.get("set-cookie")!, /HttpOnly/); assert.match(r.headers.get("set-cookie")!, /SameSite=Strict/);
  const html = await r.text(); assert.match(html, /Career Beta \/ Test Account/);
  return { cookie: cookieOf(r), token: html.match(/name="token" value="([a-f0-9]+)"/)![1] };
}
test("absent/false/non-exact flags deny all beta entry and bootstrap", async () => {
  for (const flag of [undefined, "false", "TRUE", "1", " true "]) {
    if (flag === undefined) delete env.CAREER_BETA_FIXTURE; else env.CAREER_BETA_FIXTURE = flag;
    assert.equal(careerBetaEnabled(env), false);
    for (const path of ["/api/auth/career-beta", "/api/auth/career-beta/status"]) assert.equal((await call(path)).status, 404);
    assert.equal((await call("/api/auth/career-beta", "", {})).status, 404);
    await assert.rejects(bootstrapCareerBeta(db, env), /disabled/);
  }
  assert.equal((await db.execute(sql`SELECT count(*)::int AS n FROM users`)).rows[0].n, 1);
});
test("unchanged production password login, me and logout work with beta off", async () => {
  env.CAREER_BETA_FIXTURE = "false";
  assert.equal((await call("/api/auth/login", "", { username: "ordinary", password: "wrong" })).status, 401);
  const login = await call("/api/auth/login", "", { username: "ordinary", password }); assert.equal(login.status, 200);
  const cookie = cookieOf(login); assert.equal((await json(await call("/api/auth/me", cookie))).playerId, 1);
  assert.equal((await call("/api/auth/logout", cookie, {})).status, 204);
  assert.equal((await call("/api/auth/me", cookie)).status, 401);
});
let betaCookie: string, betaPlayer: number;
test("explicit true: deliberate entry regenerates secure session; bootstrap is idempotent", async () => {
  env.CAREER_BETA_FIXTURE = "true";
  const e = await entry();
  assert.equal((await call("/api/auth/career-beta", e.cookie, { token: e.token, playerId: 1 })).status, 403);
  assert.equal((await call("/api/auth/career-beta", e.cookie, {})).status, 403);
  const r = await call("/api/auth/career-beta", e.cookie, { token: e.token }); assert.equal(r.status, 303); assert.equal(r.headers.get("location"), "/career");
  betaCookie = cookieOf(r); assert.notEqual(betaCookie, e.cookie);
  const me = await json(await call("/api/auth/me", betaCookie)); betaPlayer = me.playerId;
  assert.notEqual(betaPlayer, 1); assert.equal(me.isAdmin, false); assert.equal(me.playerName, "Career Beta / Test Account");
  const one = await bootstrapCareerBeta(db, env), two = await bootstrapCareerBeta(db, env); assert.deepEqual(one, two);
  assert.equal((await db.execute(sql`SELECT count(*)::int AS n FROM users`)).rows[0].n, 2);
  assert.equal((await db.execute(sql`SELECT count(*)::int AS n FROM players`)).rows[0].n, 2);
});
test("beta owns genuine Career saves; another owner's save and live session stay inaccessible", async () => {
  const other = await saves.create(1, { slot: 1, dateOfBirth: "1990-01-01" });
  const created = await call("/api/career/saves", betaCookie, { slot: 1, dateOfBirth: "1990-01-01", careerName: "Beta test save" });
  assert.equal(created.status, 201); const own = await json(created);
  await db.execute(sql`UPDATE career_saves SET world_seed=${HARNESS_SEED} WHERE id IN (${own.id},${other.id})`);
  assert.equal((await call(`/api/career/saves/${own.id}`, betaCookie)).status, 200);
  assert.equal((await call(`/api/career/saves/${own.id}/initialize`, betaCookie, {})).status, 200);
  async function pending(playerId: number, saveId: string) {
    const actor = { playerId };
    await career.initialize(actor, saveId);
    const events = (await career.calendar.calendar(actor, saveId, { scope: "AVAILABLE" })).events;
    const event = events.find(e => e.definitionKey === "friday-night-501" && e.human?.canEnter);
    assert.ok(event, "real affordable local event exists");
    assert.equal((await career.calendar.enter(actor, saveId, { eventId: event.id })).entered, true);
    for (let i = 0; i < 12; i++) {
      const save = await saves.read(playerId, saveId);
      const advanced = await career.calendar.advance(actor, saveId, { operationKey: `beta-test-${saveId}-${i}`, expectedSeason: save.currentSeason, expectedWeek: save.currentWeek, target: { kind: "NEXT_MEANINGFUL" } }) as any;
      if (advanced.stop.reason === "HUMAN_MATCH_PENDING") return String(advanced.stop.detail.matchIds[0]);
    }
    throw new Error("No pending match reached");
  }
  const ownMatch = await pending(betaPlayer, own.id);
  const opened = await call(`/api/career/saves/${own.id}/matches/${ownMatch}/session`, betaCookie, {});
  assert.equal(opened.status, 200, await opened.text());
  const otherMatch = await pending(1, other.id);
  await createCareerLiveMatchService(db, career.calendar).open({ playerId: 1 }, other.id, otherMatch);
  assert.equal((await call(`/api/career/saves/${other.id}`, betaCookie)).status, 404);
  assert.equal((await call(`/api/career/saves/${other.id}/matches/${otherMatch}/session`, betaCookie, {})).status, 404);
  assert.equal((await call(`/api/career/saves/${other.id}/matches/${otherMatch}/session`, betaCookie)).status, 404);
  assert.equal((await call("/api/admin/users", betaCookie)).status, 403);
  const e = await entry(); await call("/api/auth/career-beta", e.cookie, { token: e.token });
  assert.equal((await saves.list(betaPlayer)).slots[0].career?.id, own.id, "repeat sign-in preserves test saves");
});
test("disabling flag revokes existing beta sessions without touching normal accounts", async () => {
  env.CAREER_BETA_FIXTURE = "false";
  assert.equal((await call("/api/auth/me", betaCookie)).status, 401);
  assert.equal((await call("/api/career/saves", betaCookie)).status, 401);
  assert.equal((await call("/api/auth/login", "", { username: "ordinary", password })).status, 200);
});
