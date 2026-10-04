import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { CareerDatabase } from "../database.ts";
import { createCareerService } from "../service.ts";
import { lockRoot } from "../world/service.ts";
import type { RootRow } from "../calendar/engine.ts";
import { createCareerFinanceService } from "./service.ts";
import { post } from "./ledger.ts";
import { advanceSponsorLifecycle, type SponsorFactsProvider } from "./engine.ts";
import { PRIZE_PROFILES, prizeForPosition } from "./config.ts";
import type { SportingFacts } from "./sponsors.catalogue.ts";

/**
 * A4 validation harness. Deterministic: fixed seed, a fixed entry policy and a fixed
 * match-outcome rule submitted through the intended human-result boundary
 * (recordHumanMatchResult). Fixture facts/funding are labelled where used.
 */
const q = async (db: CareerDatabase, query: ReturnType<typeof sql>) => (await db.execute(query)).rows;
const humanWins = (matchId: string) => parseInt(createHash("sha256").update(matchId).digest("hex").slice(0, 2), 16) % 3 !== 0;

export async function runFinanceHarness(db: CareerDatabase, seed: string, options: { weeks?: number } = {}) {
  const started = performance.now();
  const saves = createCareerService(db);
  const finance = createCareerFinanceService(db);
  const actor = { playerId: 1 };
  const save = await saves.create(1, { slot: 1 });
  await db.execute(sql`UPDATE career_saves SET world_seed = ${seed} WHERE id = ${save.id}`);
  await finance.initialize(actor, save.id);
  const start = await finance.summary(actor, save.id);
  let humanPauses = 0, entered = 0, denied = 0;
  const weeks = options.weeks ?? 53;
  for (let step = 0; step < weeks * 4; step++) {
    const root = await saves.read(1, save.id);
    if ((root.currentSeason - 1) * 52 + root.currentWeek > weeks) break;
    // Policy: enter open, executable events starting within two weeks whose estimated cost ≤ 30% of available money (local first).
    const view = await finance.calendar.calendar(actor, save.id, { scope: "AVAILABLE", toWeek: Math.min(52, root.currentWeek + 2) });
    const candidates = (view.events as { id: string; dates: { startDay: number }; capability: { executable: boolean }; finance: { estimatedPlayerCostPence: number; availablePence: number; travelBand: string } }[])
      .filter(e => e.capability.executable).sort((a, b) => (a.finance.travelBand === "LOCAL" ? 0 : 1) - (b.finance.travelBand === "LOCAL" ? 0 : 1) || a.dates.startDay - b.dates.startDay || (a.id < b.id ? -1 : 1));
    for (const e of candidates) {
      const s = await finance.summary(actor, save.id);
      if (e.finance.estimatedPlayerCostPence > Math.floor(s.availablePence * 0.3)) continue;
      const r = await finance.calendar.enter(actor, save.id, { eventId: e.id });
      if (r.entered && r.created) entered++; else if (!r.entered) denied++;
    }
    // Accept the best available sponsor offer (deterministic: highest tier, then key).
    const sponsors = await finance.sponsors(actor, save.id);
    const tiers = ["LOCAL", "REGIONAL", "PROFESSIONAL", "ELITE"];
    const best = [...sponsors.offers].sort((a, b) => tiers.indexOf(String(b.tier)) - tiers.indexOf(String(a.tier)) || String(a.sponsorKey).localeCompare(String(b.sponsorKey)))[0];
    if (best && (!sponsors.active || tiers.indexOf(String(best.tier)) > tiers.indexOf(String(sponsors.active.tier)) || best.kind === "RENEWAL")) await finance.acceptOffer(actor, save.id, { offerId: String(best.id) });
    const r = await finance.calendar.advance(actor, save.id, { operationKey: `harness-${step}`, expectedSeason: root.currentSeason, expectedWeek: root.currentWeek, target: { kind: "WEEKS", weeks: 1 } }) as { stop: { reason: string; detail?: { matchIds: string[] } } };
    if (r.stop.reason === "HUMAN_MATCH_PENDING") {
      humanPauses++;
      for (const matchId of r.stop.detail!.matchIds) {
        const m = (await q(db, sql`SELECT best_of FROM career_tournament_matches WHERE career_save_id = ${save.id} AND id = ${matchId}`))[0];
        const target = (Number(m.best_of) + 1) / 2, win = humanWins(matchId);
        await finance.calendar.recordHumanMatchResult(actor, save.id, { matchId, humanLegs: win ? target : Math.floor(target / 2), opponentLegs: win ? Math.floor(target / 2) : target, humanThrewFirst: win });
      }
    }
  }
  const end = await finance.summary(actor, save.id);
  const S = save.id;
  const ledger = await q(db, sql`SELECT category, headline, COUNT(*)::int n, SUM(amount_pence)::bigint total, SUM(sponsor_covered_pence)::bigint covered FROM career_finance_entries WHERE career_save_id = ${S} GROUP BY 1, 2 ORDER BY 1`);
  const credits = ledger.reduce((t, r) => t + Math.max(0, Number(r.total)), 0) - start.startingBalancePence;
  const debits = -ledger.reduce((t, r) => t + Math.min(0, Number(r.total)), 0);
  const running = await q(db, sql`SELECT MIN(running)::bigint AS min FROM (SELECT SUM(amount_pence) OVER (ORDER BY created_at, id) AS running FROM career_finance_entries WHERE career_save_id = ${S}) x`);
  const economy = {
    startingBalancePence: start.startingBalancePence, ledgerEntries: end.ledgerEntries, creditsPence: credits, debitsPence: debits, endingBalancePence: end.balancePence,
    careerEarningsPence: end.careerEarningsPence, sponsorEarningsPence: end.sponsorEarningsPence, careerExpensesPence: end.careerExpensesPence,
    sponsorCoveredExpensesPence: end.sponsorCoveredExpensesPence,
    identityHolds: start.startingBalancePence + credits - debits === end.balancePence,
    headlinesReconcile: end.reconciled && start.startingBalancePence + end.careerEarningsPence + end.sponsorEarningsPence - end.careerExpensesPence === end.balancePence,
    lowestRunningBalancePence: Number(running[0].min), byCategory: ledger.map(r => ({ category: r.category, entries: r.n, totalPence: Number(r.total), coveredPence: Number(r.covered) })),
  };
  const awards = await q(db, sql`SELECT classification, finishing_position, cash_award_pence, ranking_eligible_pence FROM career_prize_awards WHERE career_save_id = ${S}`);
  const run = {
    seasonReached: (await saves.read(1, S)).currentSeason, weekReached: (await saves.read(1, S)).currentWeek, entriesMade: entered, entriesDenied: denied, humanMatchPauses: humanPauses,
    events: await q(db, sql`SELECT status, COUNT(*)::int n FROM career_event_finance WHERE career_save_id = ${S} GROUP BY 1 ORDER BY 1`),
    trips: await q(db, sql`SELECT band, COUNT(*)::int n, SUM(jsonb_array_length(event_ids))::int events, SUM(nights)::int nights FROM career_trips WHERE career_save_id = ${S} GROUP BY 1 ORDER BY 1`),
    prizes: { awards: awards.length, paid: awards.filter(a => Number(a.cash_award_pence) > 0).length, titles: awards.filter(a => Number(a.finishing_position) === 1).length,
      cashPence: awards.reduce((t, a) => t + Number(a.cash_award_pence), 0), rankingEligiblePence: awards.reduce((t, a) => t + Number(a.ranking_eligible_pence), 0),
      specialCashWithRankingZero: awards.filter(a => a.classification === "SPECIAL" && Number(a.cash_award_pence) > 0 && Number(a.ranking_eligible_pence) === 0).length },
    sponsors: await finance.sponsors(actor, S).then(s => ({ active: s.active?.sponsorKey ?? null, contracts: [s.active, ...s.history.contracts].filter(Boolean).map(c => `${c!.sponsorKey}:${c!.status}${c!.endReason ? `(${c!.endReason})` : ""}`),
      offers: [...s.offers, ...s.history.offers].map(o => `${o.sponsorKey}:${o.kind}:${o.status}`) })),
    prizeTablesSnapshotted: Number((await q(db, sql`SELECT COUNT(*)::int n FROM career_event_prize_tables WHERE career_save_id = ${S}`))[0].n),
  };
  const safety = {
    negativeBalanceEver: Number(running[0].min) < 0,
    duplicateOperationKeys: Number((await q(db, sql`SELECT COUNT(*)::int n FROM (SELECT 1 FROM career_finance_entries GROUP BY career_save_id, operation_key HAVING COUNT(*) > 1) x`))[0].n),
    duplicateEntryCharges: Number((await q(db, sql`SELECT COUNT(*)::int n FROM (SELECT event_id FROM career_finance_entries f WHERE career_save_id = ${S} AND category = 'ENTRY_FEE'
      AND NOT EXISTS (SELECT 1 FROM career_finance_entries r WHERE r.career_save_id = f.career_save_id AND r.reverses_entry_id = f.id) GROUP BY event_id HAVING COUNT(*) > 1) x`))[0].n),
    duplicatePrizes: Number((await q(db, sql`SELECT COUNT(*)::int n FROM (SELECT event_id FROM career_finance_entries WHERE career_save_id = ${S} AND category = 'PRIZE' GROUP BY event_id HAVING COUNT(*) > 1) x`))[0].n),
    duplicateSponsorBonuses: Number((await q(db, sql`SELECT COUNT(*)::int n FROM (SELECT contract_id, event_id, detail->>'bonusKey' FROM career_finance_entries WHERE career_save_id = ${S} AND category = 'SPONSOR_PERFORMANCE_BONUS' GROUP BY 1, 2, 3 HAVING COUNT(*) > 1) x`))[0].n),
    duplicateRefunds: Number((await q(db, sql`SELECT COUNT(*)::int n FROM (SELECT reverses_entry_id FROM career_finance_entries WHERE career_save_id = ${S} AND category = 'REFUND' GROUP BY 1 HAVING COUNT(*) > 1) x`))[0].n),
    duplicateSigningBonuses: Number((await q(db, sql`SELECT COUNT(*)::int n FROM (SELECT contract_id FROM career_finance_entries WHERE career_save_id = ${S} AND category = 'SPONSOR_SIGNING_BONUS' GROUP BY 1 HAVING COUNT(*) > 1) x`))[0].n),
    unsupportedCharges: Number((await q(db, sql`SELECT COUNT(*)::int n FROM career_finance_entries f JOIN career_event_instances i ON i.career_save_id = f.career_save_id AND i.id = f.event_id WHERE f.career_save_id = ${S} AND NOT i.executable`))[0].n),
    activeContracts: Number((await q(db, sql`SELECT COUNT(*)::int n FROM career_sponsor_contracts WHERE career_save_id = ${S} AND status = 'ACTIVE'`))[0].n),
    retryAdvanceStable: await (async () => { const before = end.ledgerEntries; await finance.calendar.advance(actor, S, { operationKey: "harness-0", expectedSeason: 1, expectedWeek: 1, target: { kind: "WEEKS", weeks: 1 } }); return (await finance.summary(actor, S)).ledgerEntries === before; })(),
  };
  return { economy, run, safety, scenarios: await scenarios(db, seed), runtimeSeconds: +((performance.now() - started) / 1000).toFixed(1) };
}

/** Focused, labelled scenarios on separate saves (player 2) with fixture facts/funding. */
async function scenarios(db: CareerDatabase, seed: string) {
  const saves = createCareerService(db);
  const fixture: SportingFacts = { careerStarted: true, titles: 0, bestFinishByCircuit: {}, qualifications: [], professionalStatus: "AMATEUR", tourCard: false, worldRanking: null };
  const facts: SponsorFactsProvider = { id: "HARNESS_FIXTURE", facts: async () => structuredClone(fixture) };
  const finance = createCareerFinanceService(db, { facts });
  const actor = { playerId: 2 };
  const make = async (slot: number) => { const s = await saves.create(2, { slot }); await db.execute(sql`UPDATE career_saves SET world_seed = ${seed} WHERE id = ${s.id}`); await finance.initialize(actor, s.id); return s; };
  const withRoot = async <T>(id: string, work: (tx: Parameters<Parameters<CareerDatabase["transaction"]>[0]>[0], root: RootRow) => Promise<T>) =>
    db.transaction(async tx => work(tx, await lockRoot(tx, actor, id) as RootRow));
  const a = await make(1);
  type E = { id: string; definitionKey: string; name: string; capability: { executable: boolean }; dates: { startWeek: number; startDay: number; endDay: number }; venue: { country: string; localityKey: string | null };
    human: { eligible: boolean; canEnter: boolean; denials: string[] }; finance: Record<string, unknown> & { travelBand: string; entryFeePence: number; estimatedPlayerCostPence: number } };
  const all = (await finance.calendar.calendar(actor, a.id, {})).events as unknown as E[];
  // Prefer events this (Ayrshire, amateur) player is actually eligible for; fall back to any for pure cost illustration.
  const pick = (label: string, f: (e: E) => boolean) => { const e = all.find(x => f(x) && x.human.eligible) ?? all.find(f);
    return e ? { scenario: label, event: e.name, playerEligible: e.human.eligible, days: e.dates.endDay - e.dates.startDay + 1, ...e.finance } : { scenario: label, missing: true }; };
  const costs = [
    pick("free local event", e => e.capability.executable && e.finance.travelBand === "LOCAL" && e.finance.entryFeePence === 0),
    pick("cheap local event", e => e.definitionKey === "friday-night-501" && e.finance.travelBand === "LOCAL"),
    pick("domestic event", e => e.capability.executable && e.finance.travelBand === "DOMESTIC" && !e.definitionKey.startsWith("q-school")),
    pick("UK & Ireland event", e => e.capability.executable && e.finance.travelBand === "UK_IRELAND"),
    pick("European event", e => e.capability.executable && e.finance.travelBand === "EUROPE"),
    pick("long-haul event", e => e.capability.executable && e.finance.travelBand === "LONG_HAUL"),
    pick("multi-day event", e => e.capability.executable && e.dates.endDay > e.dates.startDay && !e.definitionKey.startsWith("q-school")),
    pick("Q-School trip (series)", e => e.definitionKey === "q-school-first-uk_ireland-d1"),
  ];
  // Sponsor ladder with fixture facts on save A.
  const steps: Record<string, unknown> = {};
  steps.noSponsorAtStart = (await finance.sponsors(actor, a.id)).offers.length === 0;
  Object.assign(fixture, { titles: 1, bestFinishByCircuit: { GRASSROOTS: 1 } });
  steps.localOffers = (await finance.evaluateOffers(actor, a.id, { triggerKey: "fixture-first-title" })).created;
  const forge = (await finance.sponsors(actor, a.id)).offers.find(o => o.sponsorKey === "forge-workwear")!;
  const accept1 = await finance.acceptOffer(actor, a.id, { offerId: String(forge.id) });
  const accept2 = await finance.acceptOffer(actor, a.id, { offerId: String(forge.id) });
  steps.acceptIdempotent = accept1.contractId === accept2.contractId && accept1.created && !accept2.created;
  const local = all.find(e => e.definitionKey === "friday-night-501" && e.finance.travelBand === "LOCAL")!;
  const covered = (await finance.calendar.calendar(actor, a.id, {})).events.find(e => e.id === local.id) as unknown as E;
  steps.sponsorCoveredEvent = { event: covered.name, entryFeePence: covered.finance.entryFeePence, sponsorCoverage: covered.finance.sponsorCoverage, playerCostPence: covered.finance.estimatedPlayerCostPence };
  await finance.calendar.enter(actor, a.id, { eventId: local.id });
  for (let i = 0; i < 20; i++) {
    const root = await saves.read(2, a.id);
    if (root.currentWeek > local.dates.startWeek) break;
    const r = await finance.calendar.advance(actor, a.id, { operationKey: `scenario-a-${i}`, expectedSeason: root.currentSeason, expectedWeek: root.currentWeek, target: { kind: "WEEKS", weeks: 1 } }) as { stop: { reason: string; detail?: { matchIds: string[] } } };
    if (r.stop.reason === "HUMAN_MATCH_PENDING") for (const matchId of r.stop.detail!.matchIds) {
      const m = (await q(db, sql`SELECT best_of FROM career_tournament_matches WHERE career_save_id = ${a.id} AND id = ${matchId}`))[0];
      await finance.calendar.recordHumanMatchResult(actor, a.id, { matchId, humanLegs: (Number(m.best_of) + 1) / 2, opponentLegs: 0, humanThrewFirst: true });
    }
  }
  steps.sponsorLedger = (await q(db, sql`SELECT category, amount_pence, sponsor_covered_pence FROM career_finance_entries WHERE career_save_id = ${a.id} AND (headline = 'SPONSOR' OR sponsor_covered_pence > 0) ORDER BY category`))
    .map(r => `${r.category}:${r.amount_pence}${Number(r.sponsor_covered_pence) ? ` (covered ${r.sponsor_covered_pence})` : ""}`);
  await withRoot(a.id, (tx, root) => advanceSponsorLifecycle(tx, root, async () => structuredClone(fixture), 2, 1));
  steps.renewalAtSeasonEnd = await finance.sponsors(actor, a.id).then(s => ({ history: s.history.contracts.map(c => `${c.sponsorKey}:${c.status}`), renewalOffers: s.offers.filter(o => o.kind === "RENEWAL").length }));
  const b = await make(2);
  Object.assign(fixture, { titles: 1, bestFinishByCircuit: { GRASSROOTS: 2 } });
  await finance.evaluateOffers(actor, b.id, { triggerKey: "fixture-final" });
  await withRoot(b.id, (tx, root) => advanceSponsorLifecycle(tx, root, async () => structuredClone(fixture), 1, 9));
  steps.unacceptedOfferExpires = (await finance.sponsors(actor, b.id)).history.offers.map(o => `${o.sponsorKey}:${o.status}`);
  // Q-School trip with labelled fixture funding; cancellation and unsupported checks.
  await withRoot(b.id, (tx, root) => post(tx, root, { operationKey: "adjustment:fixture-qschool-funding", category: "ADJUSTMENT", amountPence: 100000, headline: "START", reason: "HARNESS FIXTURE funding" }));
  const qs = all.find(e => e.definitionKey === "q-school-first-uk_ireland-d1")!;
  await finance.calendar.enter(actor, b.id, { eventId: qs.id });
  for (let i = 0; i < 4; i++) {
    const root = await saves.read(2, b.id);
    const r = await finance.calendar.advance(actor, b.id, { operationKey: `scenario-b-${i}`, expectedSeason: root.currentSeason, expectedWeek: root.currentWeek, target: { kind: "WEEKS", weeks: 1 } }) as { stop: { reason: string; detail?: { matchIds: string[] } } };
    if (r.stop.reason === "HUMAN_MATCH_PENDING") for (const matchId of r.stop.detail!.matchIds) {
      const m = (await q(db, sql`SELECT best_of FROM career_tournament_matches WHERE career_save_id = ${b.id} AND id = ${matchId}`))[0];
      await finance.calendar.recordHumanMatchResult(actor, b.id, { matchId, humanLegs: 0, opponentLegs: (Number(m.best_of) + 1) / 2, humanThrewFirst: false });
    }
  }
  const qsActual = await finance.eventFinance(actor, b.id, qs.id);
  steps.qSchoolActual = { entryFeePaidPence: qsActual.actuals?.entryFeePaidPence, travelPaidPence: qsActual.actuals?.travelPaidPence, accommodationPaidPence: qsActual.actuals?.accommodationPaidPence,
    trip: qsActual.actuals?.trip ? { band: qsActual.actuals.trip.band, nights: qsActual.actuals.trip.nights, events: (qsActual.actuals.trip.events as string[]).length } : null };
  // Near-broke: drain save C to £0 and show the free recovery route.
  const c = await make(3);
  await withRoot(c.id, (tx, root) => post(tx, root, { operationKey: "adjustment:fixture-broke", category: "ADJUSTMENT", amountPence: -25000, headline: "EXPENSE", reason: "HARNESS FIXTURE drain" }));
  const cal = (await finance.calendar.calendar(actor, c.id, {})).events as unknown as E[];
  const free = cal.filter(e => e.capability.executable && e.finance.estimatedPlayerCostPence === 0 && e.human.eligible).map(e => e.dates.startWeek).sort((x, y) => x - y);
  const gap = free.length ? Math.max(free[0] - 1, ...free.slice(1).map((w, i) => w - free[i]), 52 - free[free.length - 1]) : 52;
  const nearBroke = { balancePence: (await finance.summary(actor, c.id)).balancePence, freePrizePayingEventsThisSeason: free.length, freeEventWeeks: free, longestGapWeeks: gap,
    paidEventsEnterable: cal.filter(e => e.finance.estimatedPlayerCostPence > 0 && e.human.canEnter).length,
    paidEventsRefusedForFunds: cal.filter(e => e.human.denials.includes("INSUFFICIENT_FUNDS")).length };
  // Archived save cannot transact; cross-save isolation.
  await saves.retire(2, c.id);
  let archived = "allowed";
  try { await finance.calendar.enter(actor, c.id, { eventId: local.id }); } catch (e) { archived = `refused ${(e as { status?: number }).status}`; }
  let crossSave = "leaked";
  try { await finance.summary({ playerId: 1 }, a.id); } catch (e) { crossSave = `refused ${(e as { status?: number }).status}`; }
  const prizes = ["prize:grassroots", "prize:challenger", "prize:pro_circuit", "prize:special"].map(k => ({ profile: k,
    champion: prizeForPosition(PRIZE_PROFILES[k], 1), runnerUp: prizeForPosition(PRIZE_PROFILES[k], 2), lastSixteen: prizeForPosition(PRIZE_PROFILES[k], 9), firstRoundOf128: prizeForPosition(PRIZE_PROFILES[k], 65) }));
  return { eventCosts: costs, prizes, sponsorship: steps, nearBroke, archivedSaveEntry: archived, otherPlayerReadsSave: crossSave,
    scenarioBalancesReconcile: (await Promise.all([a, b].map(s => finance.summary(actor, s.id)))).every(s => s.reconciled) };
}
