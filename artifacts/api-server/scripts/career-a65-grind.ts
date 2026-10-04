/**
 * DEV-ONLY A6.5 validation: the amateur -> Q-School grind.
 *
 * One new Career (current event database, adult DOB, no fixture funding) is played
 * from Season 1 Week 1 to the end of Season 2's Q-School. Every human match goes
 * through the REAL live-session boundary (open -> bull-up -> dart log -> server
 * verification -> A3 result). The human's darts come from the shared bot planner
 * with a fixed "competent club player" profile (seeded, so the run is deterministic).
 *
 * Entry policy (what a sensible amateur does, no hindsight):
 *   - Q-School: enter every First Stage day of one pathway as soon as entry opens, if affordable.
 *   - otherwise enter open events whose estimated cost is free or <= 20% of available cash,
 *     keeping back the Q-School cost once the Q-School season is near.
 *   - accept the first sponsor offer.
 *
 *   node scripts/career-a65-grind.ts [--avg=62] [--seeds=3]
 */
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { createCareerSaves } from "../src/db/migrations/create_career_saves.ts";
import { createCareerWorld } from "../src/db/migrations/create_career_world.ts";
import { createCareerCalendar } from "../src/db/migrations/create_career_calendar.ts";
import { createCareerFinance } from "../src/db/migrations/create_career_finance.ts";
import { createCareerSporting } from "../src/db/migrations/create_career_sporting.ts";
import { createCareerService } from "../src/career/service.ts";
import { createCareerSportingService } from "../src/career/sporting/service.ts";
import { createCareerLiveMatchService } from "../src/career/live/service.ts";
import { replay, throwDart, type X01Format, type Dart } from "../src/shared/darts-rules/x01.ts";
import { planBotX01Visit, type BotSkill } from "../src/shared/darts-rules/bot.ts";
import { seededRandom } from "../src/shared/darts-rules/random.ts";

const arg = (k: string, d: number) => Number(process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d);
const AVG = arg("avg", 62);
const SEEDS = arg("seeds", 3);
const SHARE = arg("share", 0.2);
const HUMAN: BotSkill = { avg: AVG, sd: 12, checkoutPct: 0.3 + (AVG - 60) * 0.006, hitAcc: 0.42 + (AVG - 60) * 0.008 };
const year = new Date().getUTCFullYear();
const pence = (p: number) => `£${(p / 100).toFixed(2)}`;

type Run = Record<string, unknown>;
async function run(seedIndex: number): Promise<Run> {
  const pg = new PGlite();
  const db = drizzle(pg);
  await pg.exec(`CREATE TABLE players (id INTEGER PRIMARY KEY); INSERT INTO players VALUES (1);
    CREATE TABLE feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);
    INSERT INTO feature_flags VALUES ('tour_career_2', true, false, 'grind')`);
  await createCareerSaves(db); await createCareerWorld(db); await createCareerCalendar(db); await createCareerFinance(db); await createCareerSporting(db);
  const saves = createCareerService(db);
  const career = createCareerSportingService(db);
  const live = createCareerLiveMatchService(db, career.calendar);
  const actor = { playerId: 1 };
  const s = await saves.create(1, { slot: 1, careerName: "Grind", dateOfBirth: `${year - 25}-06-15`, homeLocality: "ayrshire" });
  await db.execute(sql`UPDATE career_saves SET world_seed = ${createHash("sha256").update(`a65-grind-${seedIndex}`).digest("hex")} WHERE id = ${s.id}`);
  await career.initialize(actor, s.id);
  const id = s.id;
  const startBalance = (await career.finance.summary(actor, id)).balancePence;
  const humanRng = seededRandom("a65-grind-human", seedIndex);
  let op = 0, matches = 0, wins = 0, legsFor = 0, legsAgainst = 0, entries = 0, qPathway: string | null = null;
  const enteredKinds = new Map<string, number>();
  let qSchoolAffordableAt: { season: number; week: number; availablePence: number; costPence: number } | null = null;
  let sponsor: string | null = null;
  let endOfSeason1: string | null = null;
  let qSchoolCost: { firstStageSeriesPence: number; availableAtOpenPence: number } | null = null;

  async function play(matchId: string) {
    let sess = await live.open(actor, id, matchId) as any;
    for (let i = 0; i < 40 && sess.status === "BULL_UP"; i++) sess = await live.bull(actor, id, matchId, { throw: humanRng() < 0.2 ? "INNER" : humanRng() < 0.5 ? "OUTER" : "MISS", expectedRevision: sess.revision });
    const darts: Dart[] = [...sess.darts];
    for (;;) {
      const st = replay(sess.format as X01Format, sess.firstThrower, darts);
      if (st.complete) break;
      const plan = st.turn === 1
        ? planBotX01Visit(st.scores[1], sess.bot.config, { doubleOut: true, opened: st.opened[1], rng: seededRandom(sess.bot.seed, "bot-visit", st.visits.filter(v => v.thrower === 1).length) })
        : planBotX01Visit(st.scores[0], HUMAN, { doubleOut: true, opened: st.opened[0], rng: humanRng });
      let x = st;
      for (const d of plan) { const r = throwDart(x, d); x = r.state; darts.push(d); if (x.complete || !["SCORED", "UNOPENED", "OPENED"].includes(r.outcome)) break; }
    }
    const done = await live.darts(actor, id, matchId, { darts, expectedRevision: sess.revision }) as any;
    if (done.status !== "COMPLETED") throw new Error(`match ${matchId} not completed`);
    matches++; if (done.result.humanWon) wins++;
    legsFor += done.result.legs[0]; legsAgainst += done.result.legs[1];
  }

  for (let step = 0; step < 400; step++) {
    const save = await saves.read(1, id);
    if (save.currentSeason > 2 || (save.currentSeason === 2 && save.currentWeek > 6)) break;
    const fin = await career.finance.summary(actor, id);
    if (save.currentSeason === 2 && !endOfSeason1) endOfSeason1 = pence(fin.balancePence);
    if (save.currentSeason === 2 && !qSchoolCost) {
      const world = (await career.calendar.calendar(actor, id, { scope: "WORLD", circuit: "Q_SCHOOL", season: 2 })) as { events: any[] };
      const first = world.events.filter(e => e.qSchool?.stage === "FIRST" && e.qSchool.pathway === "UK_IRELAND");
      qSchoolCost = { firstStageSeriesPence: first.reduce((t: number, e: any) => t + (e.finance?.estimatedPlayerCostPence ?? 0), 0), availableAtOpenPence: fin.availablePence };
    }
    if (!sponsor) {
      const offers = await career.finance.sponsors(actor, id);
      if (offers.offers[0]) { await career.finance.acceptOffer(actor, id, { offerId: String(offers.offers[0].id) }); sponsor = `${offers.offers[0].displayName ?? offers.offers[0].sponsorKey} (S${save.currentSeason} W${save.currentWeek})`; }
    }
    const avail = (await career.calendar.calendar(actor, id, { scope: "AVAILABLE" })) as { events: any[] };
    const qEvents = avail.events.filter(e => e.qSchool?.stage === "FIRST" && (!qPathway || e.qSchool.pathway === qPathway));
    if (qEvents.length) {
      const cost = qEvents.reduce((t: number, e: any) => t + (e.finance?.estimatedPlayerCostPence ?? 0), 0);
      if (!qSchoolAffordableAt) qSchoolAffordableAt = { season: save.currentSeason, week: save.currentWeek, availablePence: fin.availablePence, costPence: cost };
      for (const e of qEvents) {
        const r = await career.calendar.enter(actor, id, { eventId: e.id }) as { entered: boolean };
        if (r.entered) { entries++; qPathway = e.qSchool.pathway; enteredKinds.set("Q_SCHOOL", (enteredKinds.get("Q_SCHOOL") ?? 0) + 1); }
      }
    }
    // Hold back the Q-School cost during the run-in to next season's Q-School (weeks 40+ of season 1).
    const reserve = save.currentSeason === 1 && save.currentWeek >= 40 ? 120000 : 0;
    for (const e of avail.events.filter(e => !e.qSchool)) {
      const cost = e.finance?.estimatedPlayerCostPence ?? 0;
      const now = await career.finance.summary(actor, id);
      if (cost > 0 && (cost > now.availablePence * SHARE || now.availablePence - cost < reserve)) continue;
      const r = await career.calendar.enter(actor, id, { eventId: e.id }) as { entered: boolean };
      if (r.entered) { entries++; enteredKinds.set(e.circuit, (enteredKinds.get(e.circuit) ?? 0) + 1); }
    }
    const out = await career.calendar.advance(actor, id, { operationKey: `a65-grind-advance-${seedIndex}-${op++}`, expectedSeason: save.currentSeason, expectedWeek: save.currentWeek, target: { kind: "NEXT_MEANINGFUL" } }) as any;
    if (out.stop.reason === "HUMAN_MATCH_PENDING") for (const m of out.stop.detail.matchIds) await play(m);
  }
  const fin = await career.finance.summary(actor, id);
  const sporting = await career.summary(actor, id) as any;
  const q = await career.qSchool(actor, id, { season: 2 }) as any;
  const qView = q.pathways?.find((p: any) => p.pathway === qPathway) ?? null;
  const save = await saves.read(1, id);
  await pg.close();
  return {
    seed: seedIndex, reached: `S${save.currentSeason} W${save.currentWeek}`, startBalance: pence(startBalance),
    entries, enteredByCircuit: Object.fromEntries(enteredKinds), matches, wins, winRate: matches ? +(wins / matches).toFixed(3) : 0, legs: `${legsFor}-${legsAgainst}`,
    careerEarnings: pence(fin.careerEarningsPence), expenses: pence(fin.careerExpensesPence), sponsorEarnings: pence(fin.sponsorEarningsPence), balance: pence(fin.balancePence),
    sponsor, endOfSeason1, qSchoolCost: qSchoolCost && { firstStageSeries: pence(qSchoolCost.firstStageSeriesPence), availableAtSeason2: pence(qSchoolCost.availableAtOpenPence) }, qSchoolOpenedAt: qSchoolAffordableAt && { ...qSchoolAffordableAt, availablePence: pence(qSchoolAffordableAt.availablePence), costPence: pence(qSchoolAffordableAt.costPence) },
    qSchool: qView ? { pathway: qPathway, firstStage: qView.firstStage ?? null, finalStage: qView.finalStage ?? null, card: qView.cardLine ?? qView.tourCard ?? null } : "not entered",
    tourCard: sporting.tourCard?.holdsCard ?? false,
  };
}

console.log(`A6.5 grind validation — human profile ${JSON.stringify(HUMAN)}, entry share ${SHARE}, ${SEEDS} world seed(s)`);
for (let i = 1; i <= SEEDS; i++) {
  const t = Date.now();
  console.log(JSON.stringify(await run(i)), `${((Date.now() - t) / 1000).toFixed(0)}s`);
}
