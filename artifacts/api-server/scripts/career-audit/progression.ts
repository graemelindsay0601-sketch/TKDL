/**
 * DEV-ONLY Career 2.0 progression & pacing audit driver (isolated in-memory PGlite).
 *
 * Plays one new Career through the REAL services (A1 saves, A2 world, A3 calendar/results,
 * A4 finance, A5 sporting) from Season 1 Week 1 for N seasons, one week at a time.
 *
 * LABELLED FIXTURE BOUNDARY: the human's darts. Every human match goes through the real
 * live-match service (open -> bull-up -> dart log -> server verification -> A3 result);
 * the darts are thrown by the shared bot planner with a fixed skill profile for the
 * chosen player profile (A struggling .. D elite). Nothing else is forced: no titles,
 * ranking points, cards, entitlements or money are granted. No hidden NPC attribute is read.
 *
 * Entry decisions use only what the player-facing calendar shows (canEnter, denials,
 * A4 cost preview, top prize) and the current balance — never future results.
 *
 *   node scripts/career-audit/progression.ts --profile=B --seasons=3 [--seed=1] [--out=file.json]
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { replay, throwDart, type X01Format, type Dart } from "../../src/shared/darts-rules/x01.ts";
import { planBotX01Visit, type BotSkill } from "../../src/shared/darts-rules/bot.ts";
import { seededRandom } from "../../src/shared/darts-rules/random.ts";
import { auditDatabase } from "./db.ts";

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const PROFILE = arg("profile", "B") as "A" | "B" | "C" | "D";
const SEASONS = Number(arg("seasons", "3"));
const SEED = Number(arg("seed", "1"));
const OUT = arg("out", "");
const AVG: Record<string, number> = { A: 40, B: 58, C: 78, D: 98 };
const avg = Number(arg("avg", String(AVG[PROFILE])));
const HUMAN: BotSkill = { avg, sd: 12, checkoutPct: Math.max(0.12, 0.3 + (avg - 60) * 0.006), hitAcc: Math.max(0.25, 0.42 + (avg - 60) * 0.008) };
const n = (v: unknown) => Number(v ?? 0);
const gbp = (p: number) => Math.round(p) / 100;

const a = await auditDatabase();
const { saves, career, live, rows, actor } = a;
const year = 2026;
const s = await saves.create(1, { slot: 1, careerName: `Audit ${PROFILE}`, dateOfBirth: `${year - 25}-06-15`, homeLocality: "ayrshire" });
const id = s.id as string;
await a.db.execute(sql`UPDATE career_saves SET world_seed = ${createHash("sha256").update(`career-audit-${SEED}`).digest("hex")} WHERE id = ${id}`);
await career.initialize(actor, id);
const humanRng = seededRandom(`career-audit-human-${PROFILE}`, SEED);

let matches = 0, wins = 0;
const timing = { play: 0, view: 0, advance: 0 };
async function play(matchId: string) {
  const t0 = performance.now(); try { await playInner(matchId); } finally { timing.play += performance.now() - t0; }
}
async function playInner(matchId: string) {
  let sess = await live.open(actor, id, matchId) as any;
  for (let i = 0; i < 40 && sess.status === "BULL_UP"; i++) sess = await live.bull(actor, id, matchId, { throw: humanRng() < 0.2 ? "INNER" : humanRng() < 0.5 ? "OUTER" : "MISS", expectedRevision: sess.revision });
  const darts: Dart[] = [...sess.darts];
  for (let guard = 0; guard < 100000; guard++) {
    const st = replay(sess.format as X01Format, sess.firstThrower, darts);
    if (st.complete) break;
    const doubleOut = (sess.format as any).outRule !== "STRAIGHT";
    const plan = st.turn === 1
      ? planBotX01Visit(st.scores[1], sess.bot.config, { doubleOut, opened: st.opened[1], rng: seededRandom(sess.bot.seed, "bot-visit", st.visits.filter((v: any) => v.thrower === 1).length) })
      : planBotX01Visit(st.scores[0], HUMAN, { doubleOut, opened: st.opened[0], rng: humanRng });
    let x = st;
    for (const d of plan) { const r = throwDart(x, d); x = r.state; darts.push(d); if (x.complete || !["SCORED", "UNOPENED", "OPENED"].includes(r.outcome)) break; }
  }
  const done = await live.darts(actor, id, matchId, { darts, expectedRevision: sess.revision }) as any;
  if (done.status !== "COMPLETED") throw new Error(`match ${matchId} not completed: ${done.status}`);
  matches++; if (done.result.humanWon) wins++;
}

/** Fallback for formats the live dart loop cannot drive (non-X01 specials): skip by never entering them. */
const playable = (e: any) => e.capability?.executable && (e.format?.gameType ?? "X01") === "X01" && !e.format?.pairs;

const weekly: any[] = [];
const seasonEnds: any[] = [];
const decisions = { entered: 0, skippedBudget: 0, skippedNotWorthTrip: 0, skippedReserve: 0, deniedOnEnter: {} as Record<string, number> };
let sponsor: string | null = null, op = 0, qReserve = 0, qCostSeen = 40000;
const humanPathway = "UK_IRELAND";

for (let step = 0; step < SEASONS * 60; step++) {
  const root = await saves.read(1, id);
  if (root.currentSeason > SEASONS) break;
  const fin = await career.finance.summary(actor, id) as any;
  if (!fin.reconciled) throw new Error(`ledger not reconciled at S${root.currentSeason}W${root.currentWeek}`);
  const tc = await career.tourCard(actor, id) as any;
  const card = !!tc.holdsCard;

  if (!sponsor) {
    const sp = await career.finance.sponsors(actor, id) as any;
    if (sp.offers?.[0]) {
      try { await career.finance.acceptOffer(actor, id, { offerId: String(sp.offers[0].id) }); sponsor = `${sp.offers[0].displayName ?? sp.offers[0].sponsorKey} S${root.currentSeason}W${root.currentWeek}`; } catch { /* real refusal */ }
    }
  }

  // ---- what the player sees: ONE calendar read covering this week and next (the decision horizon)
  const tv = performance.now();
  const view = await career.calendar.calendar(actor, id, { scope: "WORLD", fromWeek: root.currentWeek, toWeek: Math.min(52, root.currentWeek + 1) }) as { events: any[] };
  const thisWeek = view.events.filter(e => e.dates.startWeek === root.currentWeek);
  const can = thisWeek.filter(e => e.human?.canEnter);
  const meaningful = can.filter(e => ["RANKING", "QUALIFIER"].includes(e.classification) && playable(e));
  const denials: Record<string, number> = {};
  for (const e of thisWeek) for (const d of e.human?.denials ?? []) denials[d] = (denials[d] ?? 0) + 1;
  const homeArea = thisWeek.filter(e => e.venue?.country === "GBR" || e.venue?.zone === "UK_IRELAND");
  const eligibleIgnoringMoney = thisWeek.filter(e => (e.human?.denials ?? []).every((d: string) => d === "INSUFFICIENT_FUNDS"));

  // ---- Q-School (home pathway): enter First/Final Stage when enterable (the Career's stated route to a Tour Card)
  const enterable = view.events.filter(e => e.human?.canEnter);
  if (!card) for (const e of enterable.filter(x => x.qSchool?.pathway === humanPathway)) {
    const r = await career.calendar.enter(actor, id, { eventId: e.id }) as any;
    if (r.entered) decisions.entered++; else for (const d of r.denials ?? []) decisions.deniedOnEnter[d] = (decisions.deniedOnEnter[d] ?? 0) + 1;
  }
  // Reserve (policy assumption, labelled): an amateur without a card keeps the visible Q-School First Stage
  // cost back once it is on screen; from week 40 it keeps back the last observed cost (default £400) for next season.
  const qVisible = view.events.find(e => e.qSchool?.stage === "FIRST" && e.qSchool.pathway === humanPathway && !e.human?.denials?.includes("EVENT_FINISHED") && !["ENTERED", "CONFIRMED", "COMPLETED"].includes(e.human?.relationship));
  if (qVisible) qCostSeen = n(qVisible.finance?.estimatedPlayerCostPence) || qCostSeen;
  qReserve = card ? 0 : qVisible ? qCostSeen : root.currentWeek >= 40 ? qCostSeen : 0;

  const share = card ? 0.5 : 0.2;
  for (const e of enterable.filter(x => !x.qSchool && playable(x)).sort((x, y) => x.dates.startDay - y.dates.startDay)) {
    const cost = n(e.finance?.estimatedPlayerCostPence);
    const now = await career.finance.summary(actor, id) as any;
    if (cost > 0) {
      if (e.finance?.travelBand !== "LOCAL" && n(e.finance?.topPrizePence) < 2 * cost && !card) { decisions.skippedNotWorthTrip++; continue; }
      if (cost > n(now.availablePence) * share) { decisions.skippedBudget++; continue; }
      if (n(now.availablePence) - cost < qReserve) { decisions.skippedReserve++; continue; }
    }
    const r = await career.calendar.enter(actor, id, { eventId: e.id }) as any;
    if (r.entered) decisions.entered++; else for (const d of r.denials ?? []) decisions.deniedOnEnter[d] = (decisions.deniedOnEnter[d] ?? 0) + 1;
  }
  const mine = (await career.calendar.calendar(actor, id, { scope: "MY_SCHEDULE", fromWeek: root.currentWeek, toWeek: root.currentWeek }) as { events: any[] }).events
    .filter(e => e.dates.startWeek <= root.currentWeek && e.dates.endWeek >= root.currentWeek);

  weekly.push({ s: root.currentSeason, w: root.currentWeek, card, balance: gbp(n(fin.balancePence)), available: gbp(n(fin.availablePence)),
    worldEvents: thisWeek.length, homeAreaEvents: homeArea.length, enterable: can.length, meaningfulEnterable: meaningful.length,
    eligibleIgnoringMoney: eligibleIgnoringMoney.length, playingThisWeek: mine.length, playingCircuits: mine.map(e => e.circuit), qReserve: gbp(qReserve), denials });

  timing.view += performance.now() - tv; const ta = performance.now();
  const out = await career.calendar.advance(actor, id, { operationKey: `audit-${PROFILE}-${SEED}-${op++}`, expectedSeason: root.currentSeason, expectedWeek: root.currentWeek, target: { kind: "WEEKS", weeks: 1 } }) as any;
  if (out.stop?.reason === "HUMAN_MATCH_PENDING") {
    for (let guard = 0; guard < 200; guard++) {
      const pending = await rows(sql`SELECT id FROM career_tournament_matches WHERE career_save_id = ${id} AND status = 'AWAITING_HUMAN' ORDER BY id LIMIT 1`);
      if (!pending.length) break;
      await play(String(pending[0].id));
    }
    // the advance stopped mid-week: finish the week
    const again = await saves.read(1, id);
    if (again.currentSeason === root.currentSeason && again.currentWeek === root.currentWeek) {
      for (let k = 0; k < 20; k++) {
        const o2 = await career.calendar.advance(actor, id, { operationKey: `audit-${PROFILE}-${SEED}-${op++}`, expectedSeason: root.currentSeason, expectedWeek: root.currentWeek, target: { kind: "WEEKS", weeks: 1 } }) as any;
        if (o2.stop?.reason !== "HUMAN_MATCH_PENDING") break;
        for (let g = 0; g < 200; g++) {
          const p = await rows(sql`SELECT id FROM career_tournament_matches WHERE career_save_id = ${id} AND status = 'AWAITING_HUMAN' ORDER BY id LIMIT 1`);
          if (!p.length) break; await play(String(p[0].id));
        }
        const r2 = await saves.read(1, id);
        if (r2.currentSeason !== root.currentSeason || r2.currentWeek !== root.currentWeek) break;
      }
    }
  }
  timing.advance += performance.now() - ta;
  // season-end snapshot (on the first week of the next season, after the off-season ran)
  const after = await saves.read(1, id);
  if (after.currentSeason !== root.currentSeason) seasonEnds.push(await seasonSnapshot(root.currentSeason));
  // season review gate: acknowledge a pending review so the next season can proceed
  if (after.currentSeason !== root.currentSeason) { await a.beginPendingSeason(id); writeOut(); }
}

async function seasonSnapshot(season: number) {
  const fin = await career.finance.summary(actor, id) as any;
  const pos = async (list: string) => {
    const r = await rows(sql`SELECT r.position FROM career_ranking_snapshots s JOIN career_ranking_snapshot_rows r ON r.career_save_id = s.career_save_id AND r.snapshot_id = s.id
      WHERE s.career_save_id = ${id} AND s.list_key = ${list} AND s.season = ${season} AND r.participant_key = 'HUMAN' ORDER BY s.sequence DESC LIMIT 1`);
    return r.length ? n(r[0].position) : null;
  };
  const res = await rows(sql`SELECT i.circuit, COUNT(*)::int entries, SUM((r.finishing_position = 1)::int)::int titles, SUM(r.wins)::int w, SUM(r.losses)::int l
    FROM career_event_results r JOIN career_event_instances i ON i.career_save_id = r.career_save_id AND i.id = r.event_id
    WHERE r.career_save_id = ${id} AND r.participant_key = 'HUMAN' AND i.season = ${season} GROUP BY 1 ORDER BY 2 DESC`);
  const ledger = await rows(sql`SELECT category, SUM(amount_pence)::bigint amount FROM career_finance_entries WHERE career_save_id = ${id} AND season = ${season} GROUP BY 1`);
  const tc = await career.tourCard(actor, id) as any;
  const cards = await rows(sql`SELECT source, status, start_season, end_season, end_reason FROM career_tour_cards WHERE career_save_id = ${id} AND participant_key = 'HUMAN' ORDER BY created_at`);
  const ms = await rows(sql`SELECT kind, week, list_key FROM career_sporting_milestones WHERE career_save_id = ${id} AND participant_key = 'HUMAN' AND season = ${season} ORDER BY week`);
  return { season, balance: gbp(n(fin.balancePence)), holdsCardAfterRollover: !!tc.holdsCard,
    rankings: { proWorld: await pos("pro-world"), proCircuit: await pos("pro-circuit"), challenger: await pos("challenger"), amateur: await pos("amateur"), openWorld: await pos("open-world"), vault: await pos("vault") },
    results: Object.fromEntries(res.map(r => [String(r.circuit), { entries: n(r.entries), titles: n(r.titles), wl: `${n(r.w)}-${n(r.l)}` }])),
    ledger: Object.fromEntries(ledger.map(r => [String(r.category), gbp(n(r.amount))])),
    cards: cards.map(c => `${c.source}:${c.status} S${c.start_season}-S${c.end_season}${c.end_reason ? ` (${c.end_reason})` : ""}`),
    milestones: ms.map(m => `W${m.week} ${m.kind}${m.list_key ? `:${m.list_key}` : ""}`) };
}

function writeOut() { if (OUT) writeFileSync(OUT, JSON.stringify({ partial: true, profile: PROFILE, seasonEnds, decisions, weekly }, null, 1)); }
const qs = await rows(sql`SELECT season, stage, COUNT(*)::int days, SUM(points)::int points, MIN(finishing_position)::int best FROM career_qschool_results
  WHERE career_save_id = ${id} AND participant_key = 'HUMAN' GROUP BY 1,2 ORDER BY 1,2`);
const result = { timingSeconds: Object.fromEntries(Object.entries(timing).map(([k, v]) => [k, Math.round(v / 1000)])), profile: PROFILE, skill: HUMAN, seed: SEED, seasons: SEASONS, matches, matchWinPct: matches ? +(100 * wins / matches).toFixed(1) : 0,
  sponsor, decisions, qSchool: qs, seasonEnds, weekly };
const json = JSON.stringify(result, null, 1);
if (OUT) writeFileSync(OUT, json); else console.log(json);
console.log(JSON.stringify({ timing: result.timingSeconds, profile: PROFILE, seed: SEED, matches, matchWinPct: result.matchWinPct, sponsor, seasonEnds: seasonEnds.map(e => ({ s: e.season, bal: e.balance, card: e.holdsCardAfterRollover, rk: e.rankings, cards: e.cards })) }));
await a.pg.close();
