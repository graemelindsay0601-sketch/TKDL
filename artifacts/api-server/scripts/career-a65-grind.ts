/**
 * DEV-ONLY A6.5 validation: the amateur -> Q-School grind (§25 / §38).
 *
 * One new Career (current event database, adult DOB, home Ayrshire, normal £250 start,
 * no fixture funding) is played from Season 1 Week 1 through Season 2's and, if needed,
 * Season 3's Q-School. Every human match goes through the REAL live-session boundary
 * (open -> bull-up -> dart log -> server verification -> A3 result). The human's darts
 * come from the shared bot planner with a fixed skill profile (seeded => deterministic).
 * Every money figure is read back from the A4 ledger; every finish from A3 results.
 *
 * Entry policies (no hindsight; the player never sees future results):
 *   --policy=sensible (default) a financially sensible amateur. Uses only what the A4 preview shows
 *   (player cost after sponsor cover = fee + travel + accommodation, travel band, top prize) and the
 *   current balance; it never sees results in advance:
 *       - Q-School First Stage (all days of one pathway) whenever it is enterable (pathway value);
 *       - free events: enter;
 *       - LOCAL events: enter if the cost is <= 20% of available cash;
 *       - travelled events: enter only if the top prize is at least 2x the player's cost (the trip can
 *         pay for itself) AND the cost is <= 20% of available cash;
 *       - once cash covers the Q-School First Stage, or from S1 W40, that amount is kept back;
 *       - accept the first sponsor offer.
 *   Every skipped event is counted by reason (budget / not worth the trip / saving for Q-School).
 *   --policy=loose the first A6.5 run: any event <= 20% of cash, travel included (shown to lose
 *                  money on away grassroots nights: ~£60 trips to play for a £60 top prize).
 *   --policy=farm  the exploit probe: ONLY grassroots events (any distance) plus Q-School.
 *
 *   node scripts/career-a65-grind.ts [--avg=50] [--seeds=3] [--policy=sensible|farm]
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
import { ageOn } from "../src/career/identity/age.ts";

const arg = (k: string, d: number) => Number(process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d);
const AVG = arg("avg", 50);
const SEEDS = arg("seeds", 3);
const FIRST_SEED = arg("first-seed", 1);
const SHARE = 0.2;
const POLICY = process.argv.find(a => a.startsWith("--policy="))?.slice(9) ?? "sensible";
const HUMAN: BotSkill = { avg: AVG, sd: 12, checkoutPct: 0.3 + (AVG - 60) * 0.006, hitAcc: 0.42 + (AVG - 60) * 0.008 };
const year = new Date().getUTCFullYear();
const gbp = (p: number) => `£${(p / 100).toFixed(2)}`;
const n = (v: unknown) => Number(v ?? 0);

async function run(seedIndex: number) {
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
  const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rows as Record<string, unknown>[];
  const profile = (await rows(sql`SELECT to_char(date_of_birth, 'YYYY-MM-DD') dob, to_char(career_start_date, 'YYYY-MM-DD') start FROM career_profiles WHERE career_save_id = ${id}`))[0];
  const startingAge = ageOn(String(profile.dob), String(profile.start));
  const humanRng = seededRandom("a65-grind-human", seedIndex);

  // Q-School First Stage commitment from A4's own preview (one day's standalone estimate covers the
  // whole series: per-series fee + one trip). Measured on the season-1 UK & Ireland series.
  const qWorld = (await career.calendar.calendar(actor, id, { scope: "WORLD", circuit: "Q_SCHOOL" })) as { events: any[] };
  const qD1 = qWorld.events.find(e => e.qSchool?.stage === "FIRST" && e.qSchool.pathway === "UK_IRELAND" && e.qSchool.day === 1);
  const qPreview = await career.finance.eventFinance(actor, id, qD1.id) as any;
  const qCost = n(qPreview.estimatedPlayerCostPence ?? qD1.finance?.estimatedPlayerCostPence);

  let op = 0, matches = 0, wins = 0, qPathway: string | null = null;
  let firstAffordable: { season: number; week: number; availablePence: number } | null = null;
  let qEntered: { season: number; week: number; availableBeforePence: number; availableAfterPence: number } | null = null;
  let qPlayedSeason: number | null = null;
  let sponsor: string | null = null;
  let minAffordableOpportunities = Infinity, weeksWithoutAffordable = 0, weeksWithFree = 0, steps = 0;
  const skipped = { overBudget: 0, notWorthTheTrip: 0, savingForQSchool: 0 };
  const schedule: { local: Record<string, number>; travelled: Record<string, number> } = { local: {}, travelled: {} };
  let minCachedBalance = Infinity;

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
  }

  for (let step = 0; step < 600; step++) {
    const save = await saves.read(1, id);
    if (save.currentSeason > 3 || (save.currentSeason === 3 && save.currentWeek > 6)) break;
    if (qPlayedSeason !== null && (save.currentSeason > qPlayedSeason || save.currentWeek > 6)) break;
    const fin = await career.finance.summary(actor, id);
    // Invariant (A4 forbids debt): the authoritative balance cache is never negative and always
    // equals the ledger sum at every transaction boundary we observe.
    const cached = n((await rows(sql`SELECT balance_pence FROM career_saves WHERE id = ${id}`))[0].balance_pence);
    if (cached < 0 || !fin.reconciled) throw new Error(`INVARIANT FAILED: balance ${cached}, reconciled ${fin.reconciled} at S${save.currentSeason} W${save.currentWeek}`);
    minCachedBalance = Math.min(minCachedBalance, cached);
    if (!firstAffordable && fin.availablePence >= qCost) firstAffordable = { season: save.currentSeason, week: save.currentWeek, availablePence: fin.availablePence };
    if (!sponsor) {
      const offers = await career.finance.sponsors(actor, id);
      if (offers.offers[0]) { await career.finance.acceptOffer(actor, id, { offerId: String(offers.offers[0].id) }); sponsor = `${offers.offers[0].displayName ?? offers.offers[0].sponsorKey} (S${save.currentSeason} W${save.currentWeek})`; }
    }
    const avail = (await career.calendar.calendar(actor, id, { scope: "AVAILABLE" })) as { events: any[] };
    // §25 check: legitimate affordable / free competitive opportunities (playable formats only).
    const playable = avail.events.filter(e => !e.qSchool && e.capability.executable);
    const affordable = playable.filter(e => (e.finance?.estimatedPlayerCostPence ?? 0) <= fin.availablePence);
    steps++; minAffordableOpportunities = Math.min(minAffordableOpportunities, affordable.length);
    if (!affordable.length) weeksWithoutAffordable++;
    if (playable.some(e => (e.finance?.estimatedPlayerCostPence ?? 0) === 0)) weeksWithFree++;

    const qEvents = avail.events.filter(e => e.qSchool?.stage === "FIRST" && (!qPathway || e.qSchool.pathway === qPathway));
    if (qEvents.length && !qEntered) {
      const before = fin.availablePence;
      let any = false;
      for (const e of qEvents) {
        const r = await career.calendar.enter(actor, id, { eventId: e.id }) as { entered: boolean };
        if (r.entered) { any = true; qPathway = e.qSchool.pathway; }
      }
      if (any) { qEntered = { season: save.currentSeason, week: save.currentWeek, availableBeforePence: before, availableAfterPence: (await career.finance.summary(actor, id)).availablePence }; qPlayedSeason = save.currentSeason; }
    }
    // Saving for Q-School: once the money is there (or the season-1 run-in), keep it back.
    const reserve = !qEntered && (fin.availablePence >= qCost || (save.currentSeason === 1 && save.currentWeek >= 40)) ? qCost : 0;
    for (const e of playable) {
      if (POLICY === "farm" && e.circuit !== "GRASSROOTS") continue;
      const cost = e.finance?.estimatedPlayerCostPence ?? 0;
      const now = await career.finance.summary(actor, id);
      if (cost > 0) {
        if (POLICY === "sensible" && e.finance?.travelBand !== "LOCAL" && (e.finance?.topPrizePence ?? 0) < 2 * cost) { skipped.notWorthTheTrip++; continue; }
        if (cost > now.availablePence * SHARE) { skipped.overBudget++; continue; }
        if (now.availablePence - cost < reserve) { skipped.savingForQSchool++; continue; }
      }
      const r = await career.calendar.enter(actor, id, { eventId: e.id }) as { entered: boolean };
      if (r.entered) schedule[e.finance?.travelBand === "LOCAL" ? "local" : "travelled"][e.circuit] = (schedule[e.finance?.travelBand === "LOCAL" ? "local" : "travelled"][e.circuit] ?? 0) + 1;
    }
    const out = await career.calendar.advance(actor, id, { operationKey: `a65-grind-advance-${seedIndex}-${op++}`, expectedSeason: save.currentSeason, expectedWeek: save.currentWeek, target: { kind: "NEXT_MEANINGFUL" } }) as any;
    if (out.stop.reason === "HUMAN_MATCH_PENDING") for (const m of out.stop.detail.matchIds) await play(m);
  }

  // ------------------------------------------------------------------ read everything back from A3/A4
  const save = await saves.read(1, id);
  const fin = await career.finance.summary(actor, id);
  const ledger = await rows(sql`SELECT category, COUNT(*)::int n, SUM(amount_pence)::int amount, SUM(COALESCE(gross_amount_pence, ABS(amount_pence)))::int gross, SUM(sponsor_covered_pence)::int covered
    FROM career_finance_entries WHERE career_save_id = ${id} GROUP BY 1 ORDER BY 1`);
  const cat = (c: string) => ledger.find(r => r.category === c) ?? { n: 0, amount: 0, gross: 0, covered: 0 };
  // Balance at TRANSACTION boundaries: all postings of one transaction share created_at, so sum them
  // together (sorting individual rows inside a transaction by random id produced a fake -£80 earlier).
  const running = await rows(sql`SELECT season, week, SUM(SUM(amount_pence)) OVER (ORDER BY created_at)::int bal
    FROM career_finance_entries WHERE career_save_id = ${id} GROUP BY created_at, season, week ORDER BY created_at`);
  const progression: Record<string, string> = {};
  for (const r of running) { const k = `S${r.season ?? 1}W${String(Math.ceil(n(r.week || 1) / 8) * 8).padStart(2, "0")}`; progression[k] = gbp(n(r.bal)); }
  const minBalance = Math.min(...running.map(r => n(r.bal)));
  const results = await rows(sql`SELECT i.circuit, COUNT(*)::int entries, SUM((r.finishing_position = 1)::int)::int titles, SUM((r.finishing_position = 2)::int)::int finals,
      SUM((r.finishing_position BETWEEN 3 AND 4)::int)::int semis, SUM(r.wins)::int w, SUM(r.losses)::int l
    FROM career_event_results r JOIN career_event_instances i ON i.career_save_id = r.career_save_id AND i.id = r.event_id
    WHERE r.career_save_id = ${id} AND r.participant_key = 'HUMAN' GROUP BY 1 ORDER BY 2 DESC`);
  // Per-circuit money: prize vs the direct cost of playing there (fee + travel + accommodation, net of sponsor cover).
  const money = await rows(sql`SELECT i.circuit,
      SUM(CASE WHEN f.category = 'PRIZE' THEN f.amount_pence ELSE 0 END)::int prize,
      -SUM(CASE WHEN f.category IN ('ENTRY_FEE','TRAVEL','ACCOMMODATION','REFUND') THEN f.amount_pence ELSE 0 END)::int cost
    FROM career_finance_entries f JOIN career_event_instances i ON i.career_save_id = f.career_save_id AND i.id = f.event_id
    WHERE f.career_save_id = ${id} GROUP BY 1`);
  const perCircuit = Object.fromEntries(results.map(r => {
    const m = money.find(x => x.circuit === r.circuit) ?? { prize: 0, cost: 0 };
    return [String(r.circuit), { entries: n(r.entries), titles: n(r.titles), finals: n(r.finals), semis: n(r.semis), matchWL: `${n(r.w)}-${n(r.l)}`,
      prize: gbp(n(m.prize)), directCost: gbp(n(m.cost)), netPerEntry: gbp(Math.round((n(m.prize) - n(m.cost)) / Math.max(1, n(r.entries)))) }];
  }));
  const adjustments = cat("ADJUSTMENT").n;
  const qView = qPathway ? ((await career.qSchool(actor, id, { season: qPlayedSeason ?? 2 })) as any).pathways?.find((p: any) => p.pathway === qPathway) : null;
  await pg.close();
  return {
    seed: seedIndex, policy: POLICY, reached: `S${save.currentSeason} W${save.currentWeek}`,
    startingAge,
    startingBalance: gbp(n(cat("CAREER_START").amount)),
    eventsEntered: results.reduce((t, r) => t + n(r.entries), 0), matches, matchWinPct: matches ? +(100 * wins / matches).toFixed(1) : 0,
    titles: results.reduce((t, r) => t + n(r.titles), 0), perCircuit,
    entryFees: gbp(-n(cat("ENTRY_FEE").amount)), entryFeesSponsorCovered: gbp(n(cat("ENTRY_FEE").covered)),
    travel: gbp(-n(cat("TRAVEL").amount)), accommodation: gbp(-n(cat("ACCOMMODATION").amount)),
    travelAccommodationSponsorCovered: gbp(n(cat("TRAVEL").covered) + n(cat("ACCOMMODATION").covered)),
    refunds: gbp(n(cat("REFUND").amount)), prizeMoney: gbp(n(cat("PRIZE").amount)),
    sponsor, sponsorIncome: gbp(n(cat("SPONSOR_SIGNING_BONUS").amount) + n(cat("SPONSOR_EVENT_PAYMENT").amount) + n(cat("SPONSOR_PERFORMANCE_BONUS").amount)),
    balanceProgression: progression, minimumBalance: gbp(minBalance), finalBalance: gbp(fin.balancePence),
    qSchoolFirstStageCost: gbp(qCost), qSchoolCostBreakdown: (({ entryFeePence, estimatedTravelPence, estimatedAccommodationPence, nights }) => ({ fee: gbp(n(entryFeePence)), travel: gbp(n(estimatedTravelPence)), accommodation: gbp(n(estimatedAccommodationPence)), nights }))(qPreview.preview ?? qPreview),
    firstAffordable: firstAffordable && { at: `S${firstAffordable.season} W${firstAffordable.week}`, available: gbp(firstAffordable.availablePence) },
    qSchoolEntered: qEntered && { at: `S${qEntered.season} W${qEntered.week}`, availableBefore: gbp(qEntered.availableBeforePence), availableAfterCommitment: gbp(qEntered.availableAfterPence) },
    qSchoolOutcome: qView ? { firstStage: qView.firstStage ?? null, finalStagePlace: qView.finalStagePlace ?? qView.finalStage?.place ?? null } : "not entered",
    opportunities: { weeksChecked: steps, minAffordablePlayableEvents: minAffordableOpportunities, weeksWithNoAffordableEvent: weeksWithoutAffordable, weeksWithAFreeEvent: weeksWithFree },
    schedule, skippedForEconomicReasons: skipped,
    integrity: { minBalanceAtTransactionBoundaries: gbp(minBalance), minAuthoritativeBalanceObserved: gbp(minCachedBalance), adjustmentEntries: adjustments, coinConversion: false },
  };
}

console.log(`A6.5 grind validation — profile ${JSON.stringify(HUMAN)}, policy ${POLICY}, seeds ${FIRST_SEED}..${FIRST_SEED + SEEDS - 1}`);
for (let i = FIRST_SEED; i < FIRST_SEED + SEEDS; i++) {
  const t = Date.now();
  console.log(JSON.stringify(await run(i)), `${((Date.now() - t) / 1000).toFixed(0)}s`);
}
