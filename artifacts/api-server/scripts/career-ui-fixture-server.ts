/**
 * DEV-ONLY Career UI validation server (A6, extended in A6.5). Serves the built TKDL frontend and the
 * REAL A1–A5 Career routers over in-memory PostgreSQL (PGlite), with a fixed
 * signed-in fixture player. Nothing here ships: it exists so the Career UI can be
 * inspected against genuine Career state at phone/tablet/desktop widths.
 *
 * HARNESS FIXTURES (labelled): one funding adjustment through the A4 ledger, and
 * the human's PAST match results (while seeding only) decided by a fixed policy
 * through the server-side recordHumanMatchResult boundary. The match each save is
 * left on is played LIVE in the UI through the real GameScorer + A6.5 session
 * routes. Every other number comes from A2/A3/A4/A5.
 *
 * Saves: slot 1 adult Career (Q-School done, pending Pro Circuit match),
 *        slot 2 junior Career (age 15, pending Junior Development Night match, Q-School age-locked),
 *        slot 3 legacy Career with no date of birth (PROFILE_INCOMPLETE); a retired Career in the archive.
 * DEV METHODS (labelled, never shipped):
 *   --reach=double-crown  the slot-1 pending match is re-authored to the Double Crown format
 *                         (501 double-in double-out, best of 3 sets) — the format lab used by the tests.
 *   --reach=palace        slot 1 gets a DEV provider entitlement "world-championship" (the same
 *                         entitlement a qualifier awards), enters the real World Championship and is
 *                         played forward to its pending Palace match (slow: ~50 simulated weeks).
 *   node scripts/career-ui-fixture-server.ts [--port=8787] [--dist=../tkdl/dist/public] [--reach=double-crown|palace]
 */
import express from "express";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { createCareerSaves } from "../src/db/migrations/create_career_saves.ts";
import { createCareerWorld } from "../src/db/migrations/create_career_world.ts";
import { createCareerCalendar } from "../src/db/migrations/create_career_calendar.ts";
import { createCareerFinance } from "../src/db/migrations/create_career_finance.ts";
import { createCareerSporting } from "../src/db/migrations/create_career_sporting.ts";
import { createCareerService } from "../src/career/service.ts";
import { createCareerRouter } from "../src/career/router.ts";
import { createCareerCalendarRouter } from "../src/career/calendar/router.ts";
import { createCareerFinanceRouter } from "../src/career/finance/router.ts";
import { createCareerSportingService } from "../src/career/sporting/service.ts";
import { createCareerSportingRouter } from "../src/career/sporting/router.ts";
import { createCareerLiveMatchService } from "../src/career/live/service.ts";
import { createCareerLiveRouter } from "../src/career/live/router.ts";
import { createCareerIdentityService, createCareerIdentityRouter } from "../src/career/identity/service.ts";
import { EVENT_CATALOGUE_V2 } from "../src/career/calendar/catalogue.ts";
import { randomUUID } from "node:crypto";
import { lockRoot } from "../src/career/world/service.ts";
import { post } from "../src/career/finance/ledger.ts";
import { HARNESS_SEED } from "../src/career/world/harness.ts";
import type { RootRow } from "../src/career/calendar/engine.ts";

const reach = process.argv.find(a => a.startsWith("--reach="))?.slice(8) ?? null;
const port = Number(process.argv.find(a => a.startsWith("--port="))?.slice(7) ?? 8787);
const dist = path.resolve(process.argv.find(a => a.startsWith("--dist="))?.slice(7) ?? path.resolve(import.meta.dirname, "../../tkdl/dist/public"));
const pg = new PGlite();
const db = drizzle(pg);
await pg.exec(`CREATE TABLE players (id INTEGER PRIMARY KEY); INSERT INTO players VALUES (1);
  CREATE TABLE feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);
  INSERT INTO feature_flags VALUES ('tour_career_2', true, false, 'ui fixture')`);
await createCareerSaves(db); await createCareerWorld(db); await createCareerCalendar(db); await createCareerFinance(db); await createCareerSporting(db);
const saves = createCareerService(db);
const career = createCareerSportingService(db);
const actor = { playerId: 1 };
const live = createCareerLiveMatchService(db, career.calendar);
const year = new Date().getUTCFullYear();

// ---------------------------------------------------------------- seed real Career state
const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rows;
let op = 0;
async function newSave(slot: number, name: string, dateOfBirth?: string, homeLocality?: string) {
  const s = await saves.create(1, { slot, careerName: name, ...(dateOfBirth ? { dateOfBirth } : {}), ...(homeLocality ? { homeLocality } : {}) });
  await db.execute(sql`UPDATE career_saves SET world_seed = ${HARNESS_SEED} WHERE id = ${s.id}`);
  await career.initialize(actor, s.id);
  return s.id;
}
const winPolicy = (def: string, day: number | null, round: number) => def.startsWith("q-school-first") ? true : def.startsWith("q-school-final") ? day === 1 : round <= 2;
async function playTo(id: string, week: number, stopAtPending = false) {
  for (let i = 0; i < 200; i++) {
    const r = await saves.read(1, id);
    if (r.currentWeek >= week) return;
    const out = await career.calendar.advance(actor, id, { operationKey: `fixture-advance-${op++}`, expectedSeason: r.currentSeason, expectedWeek: r.currentWeek, target: { kind: "WEEKS", weeks: 1 } }) as { stop: { reason: string } };
    if (out.stop.reason !== "HUMAN_MATCH_PENDING") continue;
    if (stopAtPending) return;
    for (const m of await rows(sql`SELECT m.id, m.best_of, m.round, i.definition_key, i.series_day FROM career_tournament_matches m JOIN career_event_instances i ON i.career_save_id = m.career_save_id AND i.id = m.event_id
      WHERE m.career_save_id = ${id} AND m.status = 'AWAITING_HUMAN'`)) {
      const t = (Number(m.best_of) + 1) / 2, win = winPolicy(String(m.definition_key), m.series_day === null ? null : Number(m.series_day), Number(m.round));
      await career.calendar.recordHumanMatchResult(actor, id, { matchId: String(m.id), humanLegs: win ? t : 1, opponentLegs: win ? 1 : t, humanThrewFirst: true });
    }
  }
}
const enterDef = async (id: string, def: string, maxWeek = 52) => {
  for (const e of await rows(sql`SELECT id FROM career_event_instances WHERE career_save_id = ${id} AND definition_key = ${def} AND status = 'REGISTRATION_OPEN' AND start_week <= ${maxWeek} ORDER BY start_day`))
    await career.calendar.enter(actor, id, { eventId: String(e.id) });
};
console.log("Seeding Career fixture saves (real A1–A5 play)…");
const A = await newSave(1, "Validation Career", "1996-05-14", "ayrshire");
await db.transaction(async tx => post(tx, await lockRoot(tx, actor, A) as RootRow, { operationKey: "adjustment:ui-fixture-funding", category: "ADJUSTMENT", amountPence: 300000, headline: "START", reason: "UI FIXTURE funding" }));
await enterDef(A, "q-school-first-uk_ireland-d1");
await playTo(A, 3);
await enterDef(A, "q-school-final-uk_ireland-d1");
await playTo(A, 4);
await enterDef(A, "pro-circuit-championship", 6);
await playTo(A, 9);
const offers = await career.finance.sponsors(actor, A);
if (offers.offers[0]) await career.finance.acceptOffer(actor, A, { offerId: String(offers.offers[0].id) });
await enterDef(A, "pro-circuit-championship", 10);
if (reach === "palace") {
  // DEV METHOD (labelled): the same provider entitlement a World Championship qualifier awards.
  const root = (await saves.read(1, A));
  await db.execute(sql`INSERT INTO career_qualification_entitlements (career_save_id, id, idempotency_key, recipient_key, recipient_kind, entitlement_type, source_kind,
    source_detail, awarded_season, target_key, target_season, consumption, status)
    VALUES (${A}, ${randomUUID()}, 'dev-fixture:palace', 'HUMAN', 'HUMAN', 'EVENT_ENTRY', 'PROVIDER', ${JSON.stringify({ devFixture: true })}::jsonb, ${root.currentSeason},
      'world-championship', ${root.currentSeason}, 'SINGLE_USE', 'ACTIVE')`);
  await playTo(A, 48);
  await enterDef(A, "world-darts-championship");
  await playTo(A, 52, true);
} else {
  await playTo(A, 11, true); // leave a genuinely pending human match: it is played live in the UI
}
if (reach === "double-crown") {
  // DEV METHOD (labelled): re-author the pending match to the Double Crown format (best of 3 sets).
  const m = (await rows(sql`SELECT id, event_id FROM career_tournament_matches WHERE career_save_id = ${A} AND status = 'AWAITING_HUMAN' LIMIT 1`))[0];
  const dc = EVENT_CATALOGUE_V2.find(d => d.key === "double-crown")!.format;
  await db.execute(sql`UPDATE career_event_instances SET snapshot = jsonb_set(snapshot, '{format}', ${JSON.stringify({ ...dc, stages: [{ ...dc.stages[0], bestOfByRound: [3] }] })}::jsonb)
    WHERE career_save_id = ${A} AND id = ${m.event_id}`);
  await db.execute(sql`UPDATE career_tournament_matches SET best_of = 3 WHERE career_save_id = ${A} AND id = ${m.id}`);
}
// Junior Career: 15 at Career start (turns 16 in June of season 1).
const J = await newSave(2, "Junior Career", `${year - 16}-06-01`, "north-east");
await enterDef(J, "junior-development-night", 8);
await playTo(J, 12, true);
const C = await newSave(3, "Retired Career", "1990-01-01");
await saves.retire(1, C);
await newSave(3, "Legacy Career"); // no DOB: PROFILE_INCOMPLETE
console.log("Seeded.");

// ---------------------------------------------------------------- app
const app = express();
app.use(express.json());
app.use((req, _res, next) => { (req as unknown as { session: unknown }).session = { playerId: 1 }; (req as unknown as { log: unknown }).log = { error: console.error }; next(); });
const available = (isAdmin: boolean) => saves.isAvailable(isAdmin);
const careerRouter = express.Router();
careerRouter.use(createCareerIdentityRouter(createCareerIdentityService(db), available));
careerRouter.use(createCareerLiveRouter(live, available));
careerRouter.use(createCareerSportingRouter(career, available));
careerRouter.use(createCareerFinanceRouter(career.finance, available));
careerRouter.use(createCareerCalendarRouter(career.calendar, available));
careerRouter.use(createCareerRouter(saves));
app.use("/api/career", careerRouter);
// Minimal non-Career stubs so the TKDL shell renders (fixture player signed in).
app.get("/api/startup", (_req, res) => { res.json({ ready: true, phase: "READY" }); });
app.get("/api/auth/me", (_req, res) => { res.json({ id: 1, username: "fixture", isAdmin: false, playerId: 1, playerName: "Fixture Player", lastLoginAt: null }); });
app.get("/api/settings", (_req, res) => { res.json({}); });
app.get("/api/notifications/unread-count", (_req, res) => { res.json({ count: 0, communityCount: 0 }); });
app.use("/api", (_req, res) => { res.status(404).json({ error: "Not available in the Career UI fixture" }); });
app.use(express.static(dist));
app.get(/.*/, (_req, res) => { res.sendFile(path.join(dist, "index.html")); });
app.listen(port, () => console.log(`Career UI fixture on http://localhost:${port}/career (slot 1 ${A} pending live match${reach ? ` [DEV ${reach}]` : ""}, slot 2 junior, slot 3 legacy/no DOB, retired in archive)`));
