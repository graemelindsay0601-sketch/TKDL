/**
 * DEV-ONLY Career 2.0 pre-integration certification server (F2). Nothing here ships.
 *
 * Serves the built TKDL frontend with the PRODUCTION Career route composition
 * (mirrors src/routes/career.ts: tournament, content, facts, relationships, goals,
 * recognition, life, legacy, identity, live, sporting, finance, calendar, saves)
 * over in-memory or on-disk PostgreSQL (PGlite), with a fixed signed-in player.
 *
 * Schema: the exact Career migration sequence of src/app.ts initSchemaAndData().
 * --repair-missing applies the proposed fixes for the two startup-schema release blockers
 * (F2 register): P0-1 runs createCareerSPHCommercial + createCareerNpcSponsorMarketSPF, which
 * app.ts no longer calls; P0-2 re-applies the SP-E2 ledger constraint after the A9 upgrade,
 * which otherwise narrows it. Default is production-faithful (neither applied).
 *
 * Seeded saves (real service calls; LABELLED HARNESS FIXTURES are one funding
 * adjustment through the A4 ledger and human match results decided by a fixed
 * policy through the server-side recordHumanMatchResult boundary, exactly as the
 * existing A4/A5/A6 harnesses do):
 *   slot 1  "Season Career"   v5, Q-School, local wins, pro losses, a sponsor, played into season 2
 *   slot 2  "New Career"      freshly created, untouched
 *   slot 3  "Legacy Career"   pinned to event database v2 BEFORE the A9 upgrade migration runs
 *   archive "Retired Career"  a club title, then retired (A Career Remembered)
 *
 *   node scripts/career-certification-server.ts [--port=8790] [--dist=../tkdl/dist/public] [--data=DIR] [--repair-missing] [--quick]
 * GET /__cert/state returns the seeded save ids (dev only).
 */
import express from "express";
import path from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { createCareerSaves } from "../src/db/migrations/create_career_saves.ts";
import { createCareerWorld } from "../src/db/migrations/create_career_world.ts";
import { createCareerSponsorshipFoundation } from "../src/db/migrations/create_career_sponsorship_foundation.ts";
import { createCareerCalendar } from "../src/db/migrations/create_career_calendar.ts";
import { createCareerFinance } from "../src/db/migrations/create_career_finance.ts";
import { createCareerSponsorJourneysSPB } from "../src/db/migrations/create_career_sponsor_journeys_spb.ts";
import { createCareerSponsorJourneysSPB3 } from "../src/db/migrations/create_career_sponsor_journeys_spb3.ts";
import { createCareerFinanceSPC } from "../src/db/migrations/create_career_finance_spc.ts";
import { createCareerSponsorHQSPD } from "../src/db/migrations/create_career_sponsor_hq_spd.ts";
import { addContractConcludedSponsorEventSPE1 } from "../src/db/migrations/add_contract_concluded_sponsor_event_spe1.ts";
import { addScheduledSponsorRenewalsSPE1B } from "../src/db/migrations/add_scheduled_sponsor_renewals_spe1b.ts";
import { createCareerSponsorContractActionsSPE2 } from "../src/db/migrations/create_career_sponsor_contract_actions_spe2.ts";
import { createCareerSporting } from "../src/db/migrations/create_career_sporting.ts";
import { createCareerGoals } from "../src/db/migrations/create_career_goals.ts";
import { createCareerLife } from "../src/db/migrations/create_career_life.ts";
import { createCareerLegacy } from "../src/db/migrations/create_career_legacy.ts";
import { upgradeCareerContentA9V1 } from "../src/db/migrations/upgrade_career_content_a9_v1.ts";
import { createCareerSPHCommercial } from "../src/db/migrations/create_career_sph_commercial.ts";
import { createCareerNpcSponsorMarketSPF } from "../src/db/migrations/create_career_npc_sponsor_market_spf.ts";
import { createCareerService } from "../src/career/service.ts";
import { createCareerRouter } from "../src/career/router.ts";
import { createCareerCalendarRouter } from "../src/career/calendar/router.ts";
import { createCareerFinanceRouter } from "../src/career/finance/router.ts";
import { createCareerSportingService } from "../src/career/sporting/service.ts";
import { createCareerSportingRouter } from "../src/career/sporting/router.ts";
import { createCareerLiveMatchService } from "../src/career/live/service.ts";
import { createCareerLiveRouter } from "../src/career/live/router.ts";
import { createCareerIdentityService, createCareerIdentityRouter } from "../src/career/identity/service.ts";
import { createCareerFactsService } from "../src/career/facts/service.ts";
import { createCareerFactsRouter } from "../src/career/facts/router.ts";
import { createCareerRelationshipsService } from "../src/career/relationships/service.ts";
import { createCareerRelationshipsRouter } from "../src/career/relationships/router.ts";
import { createCareerGoalsService } from "../src/career/goals/service.ts";
import { createCareerGoalsRouter } from "../src/career/goals/router.ts";
import { createCareerRecognitionService } from "../src/career/recognition/service.ts";
import { createCareerRecognitionRouter } from "../src/career/recognition/router.ts";
import { createCareerLifeService } from "../src/career/life/service.ts";
import { createCareerLifeRouter } from "../src/career/life/router.ts";
import { createCareerLegacyService } from "../src/career/legacy/service.ts";
import { createCareerLegacyRouter } from "../src/career/legacy/router.ts";
import { captureRetirement } from "../src/career/legacy/persistence.ts";
import { createCareerContentService, createCareerContentRouter } from "../src/career/content/service.ts";
import { createCareerTournamentService, createCareerTournamentRouter } from "../src/career/tournament/service.ts";
import { lockRoot } from "../src/career/world/service.ts";
import { post } from "../src/career/finance/ledger.ts";
import { HARNESS_SEED } from "../src/career/world/harness.ts";
import type { RootRow } from "../src/career/calendar/engine.ts";

const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const flag = (k: string) => process.argv.includes(`--${k}`);
const port = Number(arg("port") ?? 8790);
const dist = path.resolve(arg("dist") ?? path.resolve(import.meta.dirname, "../../tkdl/dist/public"));
const dataDir = arg("data") ?? null;
const repair = flag("repair-missing"), quick = flag("quick");
const statePath = dataDir ? path.join(dataDir, "..", `${path.basename(dataDir)}.state.json`) : null;
const reuse = !!(dataDir && existsSync(dataDir) && statePath && existsSync(statePath));
const pg = dataDir ? new PGlite(dataDir) : new PGlite();
const db = drizzle(pg);
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---------------------------------------------------------------- schema: app.ts order
async function baseSchema() {
  await pg.exec(`CREATE TABLE IF NOT EXISTS players (id INTEGER PRIMARY KEY); INSERT INTO players VALUES (1) ON CONFLICT DO NOTHING;
    CREATE TABLE IF NOT EXISTS feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);
    INSERT INTO feature_flags VALUES ('tour_career_2', true, false, 'certification harness') ON CONFLICT DO NOTHING`);
  await createCareerSaves(db); await createCareerWorld(db); await createCareerSponsorshipFoundation(db);
  await createCareerCalendar(db); await createCareerFinance(db);
  if (repair) await createCareerSPHCommercial(db);
  await createCareerSponsorJourneysSPB(db); await createCareerSponsorJourneysSPB3(db); await createCareerFinanceSPC(db); await createCareerSponsorHQSPD(db);
  if (repair) await createCareerNpcSponsorMarketSPF(db);
  await addContractConcludedSponsorEventSPE1(db); await addScheduledSponsorRenewalsSPE1B(db); await createCareerSponsorContractActionsSPE2(db);
  await createCareerSporting(db); await createCareerGoals(db); await createCareerLife(db); await createCareerLegacy(db);
}

// ---------------------------------------------------------------- production composition (routes/career.ts)
const saves = createCareerService(db, { onRetired: captureRetirement });
const sporting = createCareerSportingService(db);
const live = createCareerLiveMatchService(db, sporting.calendar);
const actor = { playerId: 1 };
const available = (isAdmin: boolean) => saves.isAvailable(isAdmin);

// ---------------------------------------------------------------- seeding helpers (labelled fixtures)
const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rows as Record<string, unknown>[];
let op = 0;
type Policy = (m: { def: string; circuit: string; round: number; day: number | null }) => boolean;
async function newSave(slot: number, name: string, dob: string, locality: string, version?: number) {
  const s = await saves.create(1, { slot, careerName: name, dateOfBirth: dob, homeLocality: locality });
  await db.execute(sql`UPDATE career_saves SET world_seed = ${HARNESS_SEED} WHERE id = ${s.id}`);
  if (version) await db.execute(sql`UPDATE career_saves SET event_database_version = ${version} WHERE id = ${s.id}`); // LABELLED: simulate an older save
  await sporting.initialize(actor, s.id);
  return s.id as string;
}
async function fund(id: string, pence: number) {
  await db.transaction(async tx => post(tx, await lockRoot(tx, actor, id) as RootRow,
    { operationKey: `adjustment:cert-funding-${id}`, category: "ADJUSTMENT", amountPence: pence, headline: "START", reason: "CERTIFICATION FIXTURE funding" }));
}
async function decide(id: string, policy: Policy) {
  for (const m of await rows(sql`SELECT m.id, m.best_of, m.round, i.definition_key, i.series_day, i.circuit FROM career_tournament_matches m
    JOIN career_event_instances i ON i.career_save_id = m.career_save_id AND i.id = m.event_id WHERE m.career_save_id = ${id} AND m.status = 'AWAITING_HUMAN'`)) {
    const t = (Number(m.best_of) + 1) / 2;
    const win = policy({ def: String(m.definition_key), circuit: String(m.circuit), round: Number(m.round), day: m.series_day === null ? null : Number(m.series_day) });
    await sporting.calendar.recordHumanMatchResult(actor, id, { matchId: String(m.id), humanLegs: win ? t : 0, opponentLegs: win ? 0 : t, humanThrewFirst: true });
  }
}
async function playTo(id: string, season: number, week: number, policy: Policy, enter?: (s: number, w: number) => Promise<void>) {
  for (let i = 0; i < 400; i++) {
    const r = await saves.read(1, id);
    if (r.currentSeason > season || (r.currentSeason === season && r.currentWeek >= week)) return;
    await enter?.(r.currentSeason, r.currentWeek);
    const out = await sporting.calendar.advance(actor, id, { operationKey: `cert-advance-${op++}`, expectedSeason: r.currentSeason, expectedWeek: r.currentWeek,
      target: { kind: "WEEKS", weeks: 1 } }) as { stop: { reason: string } };
    if (out.stop.reason === "HUMAN_MATCH_PENDING") await decide(id, policy);
  }
}
async function enterIfOpen(id: string, defs: string[], withinWeeks = 2) {
  const r = await saves.read(1, id);
  for (const e of await rows(sql`SELECT id, definition_key FROM career_event_instances WHERE career_save_id = ${id} AND season = ${r.currentSeason}
    AND status = 'REGISTRATION_OPEN' AND start_week <= ${r.currentWeek + withinWeeks} AND definition_key IN (${sql.join(defs.map(d => sql`${d}`), sql`,`)}) ORDER BY start_day`)) {
    try { await sporting.calendar.enter(actor, id, { eventId: String(e.id) }); } catch { /* not eligible / already entered: real denial, skip */ }
  }
}
const LOCAL_WINS = new Set(["friday-night-501", "sunday-league-sprint", "county-501-open", "county-championship", "town-open"]);
const seasonPolicy: Policy = m => m.def.startsWith("q-school-first") ? true : m.def.startsWith("q-school-final") ? m.day === 1 : LOCAL_WINS.has(m.def) ? true : m.round <= 1;

// ---------------------------------------------------------------- seed
type State = { season: string; fresh: string; legacy: string; retired: string; repair: boolean; sponsorLog: string[] };
const sponsorLog: string[] = [];
let state: State;
if (reuse) {
  state = JSON.parse(readFileSync(statePath!, "utf8"));
  log("Reusing seeded data", dataDir);
} else {
  log(`Schema (production order${repair ? " + missing SPF/SPH" : ""})`);
  await baseSchema();
  log("Legacy save on event database v2 (before A9 upgrade)");
  const legacy = await newSave(3, "Legacy Career", "1988-03-02", "ayrshire", 2);
  await fund(legacy, 150000);
  await playTo(legacy, 1, 6, m => m.round <= 2, async () => enterIfOpen(legacy, ["friday-night-501", "sunday-league-sprint"]));
  log("A9 content upgrade migration");
  await upgradeCareerContentA9V1(db);
  // P0-2 proposed fix: the A9 upgrade re-runs the A4 finance migration, narrowing the ledger category
  // constraint back below SP-C/SP-E2. Re-applying SP-E2 (idempotent) restores it.
  if (repair) await createCareerSponsorContractActionsSPE2(db);
  log("Retired save");
  const retired = await newSave(1, "Retired Career", "1979-11-20", "north-east");
  await fund(retired, 150000);
  await playTo(retired, 1, 10, seasonPolicy, async () => enterIfOpen(retired, [...LOCAL_WINS]));
  await saves.retire(1, retired);
  log("Season save (this takes a while: a full simulated season)");
  const season = await newSave(1, "Season Career", "1996-05-14", "ayrshire");
  await fund(season, 400000);
  const enterSeason = async () => enterIfOpen(season, [...LOCAL_WINS, "q-school-first-uk_ireland-d1", "q-school-final-uk_ireland-d1", "pro-circuit-championship", "challenger-event"]);
  await playTo(season, 1, 9, seasonPolicy, enterSeason);
  // Accept the first offer the server will actually allow; refusals are real service responses and are recorded.
  const offers = await sporting.finance.sponsors(actor, season) as { offers: { id: string; sponsorKey?: string; sponsor_key?: string }[] };
  for (const o of offers.offers) {
    try { await sporting.finance.acceptOffer(actor, season, { offerId: String(o.id) }); sponsorLog.push(`accepted ${o.id}`); break; }
    catch (e) { sponsorLog.push(`refused ${o.id}: ${(e as Error).message}`); }
  }
  log("Sponsor offers", sponsorLog);
  if (quick) await playTo(season, 1, 20, seasonPolicy, enterSeason);
  else await playTo(season, 2, 3, seasonPolicy, enterSeason);
  log("New save");
  const fresh = await newSave(2, "New Career", "2001-08-09", "north-east");
  state = { season, fresh, legacy, retired, repair, sponsorLog };
  if (statePath) writeFileSync(statePath, JSON.stringify(state, null, 2));
  log("Seeded", state);
}

// ---------------------------------------------------------------- app
const app = express();
app.use(express.json());
app.use((req, _res, next) => { (req as unknown as { session: unknown }).session = { playerId: 1 }; (req as unknown as { log: unknown }).log = { error: console.error, warn: console.warn, info: () => {} }; next(); });
const router = express.Router();
router.use(createCareerTournamentRouter(createCareerTournamentService(db, sporting.calendar), sporting.calendar, available));
router.use(createCareerContentRouter(createCareerContentService(db, sporting)));
router.use(createCareerFactsRouter(createCareerFactsService(db)));
router.use(createCareerRelationshipsRouter(createCareerRelationshipsService(db)));
router.use(createCareerGoalsRouter(createCareerGoalsService(db)));
router.use(createCareerRecognitionRouter(createCareerRecognitionService(db)));
router.use(createCareerLifeRouter(createCareerLifeService(db)));
router.use(createCareerLegacyRouter(createCareerLegacyService(db)));
router.use(createCareerIdentityRouter(createCareerIdentityService(db), available));
router.use(createCareerLiveRouter(live, available));
router.use(createCareerSportingRouter(sporting, available));
router.use(createCareerFinanceRouter(sporting.finance, available));
router.use(createCareerCalendarRouter(sporting.calendar, available));
router.use(createCareerRouter(saves));
app.use("/api/career", router);
app.get("/__cert/state", (_req, res) => { res.json(state); });
// Minimal non-Career stubs so the TKDL shell renders with the fixture player signed in.
app.get("/api/startup", (_req, res) => { res.json({ ready: true, phase: "READY" }); });
app.get("/api/auth/me", (_req, res) => { res.json({ id: 1, username: "certification", isAdmin: false, playerId: 1, playerName: "Certification Player", lastLoginAt: null }); });
app.get("/api/settings", (_req, res) => { res.json({}); });
app.get("/api/notifications/unread-count", (_req, res) => { res.json({ count: 0, communityCount: 0 }); });
app.use("/api", (req, res) => { res.status(404).json({ error: `Not served by the certification harness: ${req.path}` }); });
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => { console.error("UNHANDLED", err.message); res.status(500).json({ error: err.message }); });
app.use(express.static(dist));
app.get(/.*/, (_req, res) => { res.sendFile(path.join(dist, "index.html")); });
app.listen(port, () => log(`Career certification harness on http://localhost:${port}/career${repair ? " [repair-missing]" : ""}`));
