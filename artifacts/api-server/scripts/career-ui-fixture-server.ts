/**
 * DEV-ONLY Career UI validation server (A6). Serves the built TKDL frontend and the
 * REAL A1–A5 Career routers over in-memory PostgreSQL (PGlite), with a fixed
 * signed-in fixture player. Nothing here ships: it exists so the Career UI can be
 * inspected against genuine Career state at phone/tablet/desktop widths.
 *
 * HARNESS FIXTURES (labelled): one funding adjustment through the A4 ledger, and
 * the human's match results decided by a fixed policy through the server-side
 * recordHumanMatchResult boundary (live play is not connected yet). Every other
 * number comes from A2/A3/A4/A5.
 *   node scripts/career-ui-fixture-server.ts [--port=8787] [--dist=../tkdl/dist/public]
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
import { lockRoot } from "../src/career/world/service.ts";
import { post } from "../src/career/finance/ledger.ts";
import { HARNESS_SEED } from "../src/career/world/harness.ts";
import type { RootRow } from "../src/career/calendar/engine.ts";

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

// ---------------------------------------------------------------- seed real Career state
const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rows;
let op = 0;
async function newSave(slot: number, name: string) {
  const s = await saves.create(1, { slot, careerName: name });
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
const A = await newSave(1, "Validation Career");
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
await playTo(A, 11, true); // leave a genuinely pending human match: the UI must show the honest boundary
await newSave(2, "Fresh Career");
const C = await newSave(3, "Retired Career");
await saves.retire(1, C);
console.log("Seeded.");

// ---------------------------------------------------------------- app
const app = express();
app.use(express.json());
app.use((req, _res, next) => { (req as unknown as { session: unknown }).session = { playerId: 1 }; (req as unknown as { log: unknown }).log = { error: console.error }; next(); });
const available = (isAdmin: boolean) => saves.isAvailable(isAdmin);
const careerRouter = express.Router();
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
app.listen(port, () => console.log(`Career UI fixture on http://localhost:${port}/career (saves: ${A} active+pending match, slot 2 fresh, slot 3 retired)`));
