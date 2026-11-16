/**
 * Career soak tester: plays a Career for many weeks the way a player would and checks, every week, that it still
 * works as a game. It follows the Career Guide's steps, enters events, plays its own matches with realistic darts, and
 * at random also streams, answers and offers money matches, joins and plays the pub league and club knockouts, books
 * practice (sometimes forgetting to turn up) and plays any team, county or competition match that stops the week.
 *
 * Every week it checks:
 * - the week moves on (anything that stops Continue can be resolved, nothing stays stuck);
 * - the money ledger reconciles and the balance never goes below zero;
 * - nothing errors, and the Guide, calendar and inbox answer within 2 seconds;
 * - the Guide always has a next step, never suggests an event you can't enter or afford, never repeats one.
 *
 * Usage (DATABASE_URL must point at a dev database; it creates saves):
 *   node scripts/career-soak.ts [weeks=60] [focus=OPEN_SCHEDULE] [playerId] [saveId to continue an existing save]
 * Env: WIN_RATE (0.5), STREAM_RATE (0.25 of weeks; creators always), SEED (random), LOG (path for the week log).
 */
import { sql } from "drizzle-orm";
import { createRequire } from "node:module";
import { appendFileSync, writeFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/node-postgres";
import { readRetryingCareerDatabase } from "../src/career/request-scope.ts";
import { createCareerService } from "../src/career/service.ts";
import { createCareerSportingService } from "../src/career/sporting/service.ts";
import { createCareerGoalsService } from "../src/career/goals/service.ts";
import { createCareerStreamingService } from "../src/career/streaming/service.ts";
import { createCareerMoneyService } from "../src/career/money/service.ts";
import { createCareerGuideService } from "../src/career/guide/service.ts";
import { createCareerLegacyService } from "../src/career/legacy/service.ts";
import { createCareerInboxService } from "../src/career/inbox/service.ts";
import { createCareerLocalNightsService } from "../src/career/local/service.ts";
import { createCareerTeamNightsService } from "../src/career/club/team-service.ts";
import { createCareerCountyTrialService } from "../src/career/club/county-trial-service.ts";
import { createCareerCountyLiveService } from "../src/career/club/county-live-service.ts";
import { createCareerLocalCompetitionService } from "../src/career/club/local-competitions.ts";

const weeks = Number(process.argv[2] ?? 60), focus = process.argv[3] ?? "OPEN_SCHEDULE";
const winRate = Number(process.env.WIN_RATE ?? 0.5), streamRate = Number(process.env.STREAM_RATE ?? 0.25);
/** MONEY=0: a player who never plays money matches (the floor without gambling). */
const moneyMatches = process.env.MONEY !== "0";
const logPath = process.env.LOG ?? `/tmp/career-soak-${focus.toLowerCase()}.log`;
// Seeded randomness, so a run that finds something can be replayed.
let seed = Number(process.env.SEED ?? Math.floor(Math.random() * 1e9));
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const startSeed = seed;

const pg = createRequire(new URL("../../../lib/db/package.json", import.meta.url))("pg") as typeof import("pg");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = readRetryingCareerDatabase(drizzle(pool) as never);
const saves = createCareerService(db), sporting = createCareerSportingService(db), goals = createCareerGoalsService(db);
const streaming = createCareerStreamingService(db), money = createCareerMoneyService(db), legacy = createCareerLegacyService(db);
const local = createCareerLocalNightsService(db), teams = createCareerTeamNightsService(db), trials = createCareerCountyTrialService(db);
const county = createCareerCountyLiveService(db), competitions = createCareerLocalCompetitionService(db);
const guide = createCareerGuideService(db, { calendar: sporting.calendar, goals, sponsors: sporting.finance, streaming, money });
const inbox = createCareerInboxService(db, { calendar: sporting.calendar, streaming, money, sponsors: sporting.finance });

// ---------------------------------------------------------------- findings
type Finding = { week: string; kind: string; detail: string };
const findings: Finding[] = [];
let at = "start";
const find = (kind: string, detail: string) => { findings.push({ week: at, kind, detail }); log(`  !! ${kind}: ${detail}`); };
const log = (line: string) => { try { appendFileSync(logPath, line + "\n"); } catch { /* best effort */ } };
const msg = (e: unknown) => (e as Error)?.message?.split("\n")[0]?.slice(0, 200) ?? String(e);
/** Run something a player would do; an error is a finding unless it's one of the expected answers. */
async function act<T>(what: string, fn: () => Promise<T>, expected: RegExp[] = []): Promise<T | undefined> {
  try { return await fn(); } catch (e) { if (!expected.some(r => r.test(msg(e)))) find("error", `${what}: ${msg(e)}`); else log(`  (${what}: ${msg(e)})`); return undefined; }
}
async function timed<T>(what: string, fn: () => Promise<T>, limitMs = 2000): Promise<T | undefined> {
  const t = Date.now(); const r = await act(what, fn); const ms = Date.now() - t;
  if (ms > limitMs) find("slow", `${what} took ${ms} ms`);
  return r;
}

// ---------------------------------------------------------------- darts
const MISS = { segment: 0, multiplier: 1, value: 0 };
const dart = (segment: number, multiplier: number) => ({ segment, multiplier, value: segment * multiplier });
const VISITS: [number, object[]][] = [[0.14, [dart(5, 1), dart(1, 1), dart(20, 1)]], [0.3, [dart(20, 1), dart(20, 1), dart(5, 1)]], [0.26, [dart(20, 1), dart(20, 1), dart(20, 1)]],
  [0.12, [dart(20, 3), dart(5, 1), dart(20, 1)]], [0.12, [dart(20, 3), dart(20, 1), dart(20, 1)]], [0.04, [dart(20, 3), dart(20, 3), dart(20, 1)]], [0.02, [dart(20, 3), dart(20, 3), dart(20, 3)]]];
const scoreOf = (v: object[]) => (v as { value: number }[]).reduce((a, d) => a + d.value, 0);
function visitFor(rem: number, sharp: number): { darts: object[]; out: boolean } {
  if (rem <= 40 && rem % 2 === 0) return rand() < 0.35 + sharp ? { darts: [MISS, MISS, dart(rem / 2, 2)], out: true } : { darts: [MISS, MISS, MISS], out: false };
  if (rem <= 41) return rand() < 0.3 + sharp ? { darts: [MISS, dart(1, 1), dart((rem - 1) / 2, 2)], out: true } : { darts: [MISS, MISS, MISS], out: false };
  let r = rand(), v = VISITS[0][1];
  for (const [p, darts] of VISITS) { if (r < p) { v = darts; break; } r -= p; }
  if (rem - scoreOf(v) < 2) v = VISITS[0][1];
  return rem - scoreOf(v) < 2 ? { darts: [MISS, MISS, MISS], out: false } : { darts: v, out: false };
}
/** One 501 leg, alternating visits from whoever throws first; you finish a little more often when you're winning. */
function leg(youFirst: boolean, youWin: boolean, start = 501) {
  const darts: object[] = []; const rem = { you: start, them: start };
  for (let turn = 0; turn < 200; turn++) {
    const who = (turn % 2 === 0) === youFirst ? "you" : "them";
    const v = visitFor(rem[who], (who === "you") === youWin ? 0.25 : -0.1);
    darts.push(...v.darts); rem[who] -= scoreOf(v.darts); if (v.out) break;
  }
  return darts;
}
/** Play a match by sending the growing dart log (the server replays it) until the server stops taking darts. */
async function playLog(what: string, send: (darts: object[]) => Promise<unknown>, start = 501) {
  const win = rand() < winRate; let log: object[] = [];
  for (let n = 0; n < 11; n++) {
    log = [...log, ...leg(n % 2 === 0, win, start)];
    try { await send(log); } catch (e) { if (n === 0) find("error", `${what}: ${msg(e)}`); return; }
  }
}

// ---------------------------------------------------------------- the save
const playerId = Number(process.argv[4] ?? (await db.execute(sql`SELECT player_id AS id FROM career_saves ORDER BY created_at DESC LIMIT 1`)).rows[0]?.id);
const actor = { playerId, isAdmin: false };
let saveId = process.argv[5];
writeFileSync(logPath, `career soak · focus ${focus} · seed ${startSeed} · win ${winRate} · money matches ${moneyMatches ? "on" : "off"}\n`);
if (!saveId) {
  const used = new Set((await db.execute(sql`SELECT slot_number FROM career_saves WHERE player_id = ${playerId} AND status = 'ACTIVE'`)).rows.map(r => Number(r.slot_number)));
  const slot = [1, 2, 3].find(s => !used.has(s));
  if (!slot) throw new Error("No free Career slot for this player");
  const save = await saves.create(playerId, { slot, careerName: `Soak ${focus.toLowerCase()} ${startSeed}`, dateOfBirth: "1998-04-02" });
  saveId = save.id;
  await sporting.initialize(actor, saveId);
  if (focus !== "OPEN_SCHEDULE") await goals.focus(actor, saveId, { focus });
  if (focus === "DARTCAST_CREATOR") await act("pathway", () => streaming.setPathway(actor, saveId!, { focus: "DARTCAST", weeklyFrequency: 2 }));
}
const id = saveId!;
console.log(`soak save ${id} · focus ${focus} · seed ${startSeed} · log ${logPath}`);
const balance = async () => Number((await db.execute(sql`SELECT balance_pence FROM career_saves WHERE id = ${id}`)).rows[0]?.balance_pence ?? 0);
const stats = { entries: 0, matches: 0, streams: 0, moneyMatches: 0, localNights: 0, sponsorsSigned: 0, blockers: {} as Record<string, number> };

// ---------------------------------------------------------------- a player's week
async function doStream() {
  const v = await act("streaming.read", () => streaming.read(actor, id)) as { freeNights: number[]; streamsThisWeek: number; perWeek: number; pathway: { scheduledNights: number[] }; formats: { key: string; why: string | null }[]; live: string | null } | undefined;
  if (!v) return;
  // A stream left running (you closed the app mid-stream): pick it up and finish it, as "Resume stream" does.
  if (v.live) {
    const win = rand() < winRate;
    for (let n = 0; n < 9; n++) {
      const r = await act("resume stream darts", () => streaming.darts(actor, id, v.live!, { darts: leg(n % 2 === 0, win) })) as { session: { status: string } } | undefined;
      if (!r || r.session.status !== "LIVE") break;
    }
    await act("end resumed stream", () => streaming.end(actor, id, v.live!), [/not live|ended/i]);
    return;
  }
  const nights = [...new Set([...v.pathway.scheduledNights, ...v.freeNights])].slice(0, Math.max(0, v.perWeek - v.streamsThisWeek));
  for (const d of nights) {
    const format = v.formats.find(f => !f.why && ["CHALLENGER", "COMMUNITY", "KING"].includes(f.key))?.key;
    if (!format) return;
    const s = await act(`go live (${format})`, () => streaming.goLive(actor, id, { dayOfWeek: d, format }), [/already|not free|booked|no free/i]) as { id: string } | undefined;
    if (!s) continue;
    const win = rand() < winRate;
    for (let n = 0; n < 9; n++) {
      const r = await act("stream darts", () => streaming.darts(actor, id, s.id, { darts: leg(n % 2 === 0, win) })) as { session: { status: string } } | undefined;
      if (!r || r.session.status !== "LIVE") break;
    }
    await act("end stream", () => streaming.end(actor, id, s.id), [/not live|ended/i]);
    stats.streams++;
  }
}
async function doMoney() {
  const v = await act("money.read", () => money.read(actor, id)) as { challenge: { opponentKey: string; stakePence: number } | null; members: { key: string; thisWeek: unknown }[] } | undefined;
  if (!v) return;
  if (!v.members.length && !v.challenge) { log("   (no club members to play for money)"); return; }
  const bal = await balance();
  let session: { session: { id: string } | null } | undefined;
  if (v.challenge && v.challenge.stakePence <= bal && rand() < 0.6)
    session = await act("answer money challenge", () => money.play(actor, id, { opponentKey: v.challenge!.opponentKey, stakePence: v.challenge!.stakePence })) as typeof session;
  else if (v.challenge) { await act("decline money challenge", () => money.decline(actor, id)); return; }
  else if (rand() < 0.35 && bal > 2_000) {
    const m = v.members.find(x => !x.thisWeek);
    if (!m) return;
    const talk = await act("offer money match", () => money.offer(actor, id, { opponentKey: m.key, stakePence: 1_000 }), [/already|can't afford|walked/i]) as { members?: { key: string; talk: { status: string; agreedPence: number | null } | null }[] } | undefined;
    let agreed = talk?.members?.find(x => x.key === m.key)?.talk as { status: string; agreedPence: number | null; theirOfferPence?: number | null } | null | undefined;
    // They usually come back with a number: take it if it's affordable, as a player would.
    if (agreed?.status === "OPEN" && agreed.theirOfferPence && agreed.theirOfferPence <= bal) {
      const again = await act("accept their money counter", () => money.offer(actor, id, { opponentKey: m.key, stakePence: agreed!.theirOfferPence! }), [/already|walked|afford/i]) as typeof talk;
      agreed = again?.members?.find(x => x.key === m.key)?.talk as typeof agreed;
    }
    if (agreed?.status === "AGREED" && agreed.agreedPence) session = await act("play agreed money match", () => money.play(actor, id, { opponentKey: m.key, stakePence: agreed.agreedPence! })) as typeof session;
  }
  if (session?.session) { stats.moneyMatches++; await playLog("money match darts", darts => money.darts(actor, id, session!.session!.id, { darts })); }
}
async function doLocal(week: number) {
  const v = await act("local.read", () => local.read(actor, id)) as { pubLeague: unknown; nights: { id: string; kind: string; status: string; dayOfWeek: number }[]; freeNights?: number[] } | undefined;
  if (!v) return;
  if (!v.pubLeague && rand() < 0.3) await act("join pub league", () => local.joinPubLeague(actor, id), [/already|not running|season|full|no league|run weeks/i]);
  if (rand() < 0.35) await act("book knockout", () => local.book(actor, id, { kind: "KNOCKOUT", dayOfWeek: 4 }), [/booked|busy|already|not on|no knockout|week|afford|full|clash|entry free/i]);
  if (rand() < 0.25) await act("book practice", () => local.book(actor, id, { kind: "PRACTICE", dayOfWeek: 1 + Math.floor(rand() * 7), routine: "SCORING" }), [/booked|busy|already|clash|played|past/i]);
  const after = await act("local.read", () => local.read(actor, id)) as typeof v | undefined;
  // Play the match nights (sometimes not: a player forgets, and the night must still settle).
  for (const n of after?.nights ?? []) if (n.status === "BOOKED" && n.kind !== "PRACTICE" && n.kind !== "COACHING" && rand() < 0.7) {
    stats.localNights++;
    await playLog(`local night darts (${n.kind})`, darts => local.darts(actor, id, n.id, { darts }));
  }
  void week;
}
/** Anything that stops Continue: play it, as a player would from the screen it sends them to. */
async function resolve(stop: { reason: string; detail?: Record<string, unknown> }, root: { currentSeason: number }) {
  stats.blockers[stop.reason] = (stats.blockers[stop.reason] ?? 0) + 1;
  const d = stop.detail ?? {};
  switch (stop.reason) {
    case "HUMAN_MATCH_PENDING":
      for (const matchId of (d.matchIds as string[] | undefined) ?? []) {
        const m = (await db.execute(sql`SELECT best_of, i.snapshot->'format' AS format FROM career_tournament_matches t JOIN career_event_instances i ON i.career_save_id = t.career_save_id AND i.id = t.event_id
          WHERE t.career_save_id = ${id} AND t.id = ${matchId}`)).rows[0] as { best_of: number; format: { scoringUnit?: string; legsPerSet?: number } } | undefined;
        const need = (Number(m?.best_of ?? 3) + 1) / 2, win = rand() < winRate, lose = Math.floor(rand() * need);
        // Set play (majors, the World Championship): best_of counts sets, and each set won takes a majority of its legs.
        const setPlay = m?.format?.scoringUnit === "SETS", perSet = (Number(m?.format?.legsPerSet ?? 5) + 1) / 2;
        const sets = setPlay ? { humanSets: win ? need : lose, opponentSets: win ? lose : need } : {};
        const legs = setPlay ? { humanLegs: (win ? need : lose) * perSet, opponentLegs: (win ? lose : need) * perSet }
          : { humanLegs: win ? need : lose, opponentLegs: win ? lose : need };
        await act("record match", () => sporting.calendar.recordHumanMatchResult(actor, id, { matchId, ...legs, ...sets, humanThrewFirst: true }));
        stats.matches++;
      }
      return;
    case "SEASON_REVIEW":
      await act("begin season", () => legacy.begin(actor, id, Number(d.season ?? root.currentSeason), { confirmation: "BEGIN SEASON" }));
      return;
    case "STREAM_PENDING": return void await doStream();
    case "MONEY_MATCH_PENDING": return void await playLog("money match darts (pending)", darts => money.darts(actor, id, String(d.matchId), { darts }));
    case "TEAM_MATCH_PENDING": return void await playLog("team match darts", darts => teams.darts(actor, id, String(d.matchId), { darts }));
    case "COUNTY_TRIAL_PENDING": return void await playLog("county trial darts", darts => trials.darts(actor, id, String(d.matchId), { darts }));
    case "LOCAL_COMPETITION_PENDING":
      return void await playLog("local competition darts", darts => competitions.darts(actor, id, String(d.competitionId), String(d.fixtureId), { darts }));
    default: find("unhandled-stop", `${stop.reason} ${JSON.stringify(d).slice(0, 120)}`);
  }
}

// ---------------------------------------------------------------- the soak
let lastSeason = 0, lastWeek = 0;
for (let i = 0; i < weeks; i++) {
  const root = await saves.read(playerId, id);
  at = `S${root.currentSeason} W${root.currentWeek}`;
  const bal = await balance();
  if (bal < 0) find("negative-balance", `£${(bal / 100).toFixed(2)}`);
  if (root.currentSeason === lastSeason && root.currentWeek === lastWeek) find("stuck", "the week didn't move on last turn");
  lastSeason = root.currentSeason; lastWeek = root.currentWeek;

  // What the player sees.
  const g = await timed("guide", () => guide.read(actor, id));
  await timed("calendar", () => sporting.calendar.calendar(actor, id, { scope: "RELEVANT", fromWeek: Math.max(1, root.currentWeek - 2), toWeek: Math.min(52, root.currentWeek + 8) }));
  await timed("inbox", () => inbox.read(actor, id));
  const fin = await act("finance summary", () => sporting.finance.summary(actor, id)) as { reconciled: boolean; balancePence: number } | undefined;
  if (fin && !fin.reconciled) find("ledger", "finance summary does not reconcile");
  if (fin && fin.balancePence !== bal) find("ledger", `summary £${fin.balancePence / 100} vs save £${bal / 100}`);
  if (g) {
    log(`${at} ${g.today.dayName} £${(bal / 100).toFixed(0)} · ${g.path.current?.title ?? "path done"} · ${g.today.headline}`);
    if (!g.nextSteps.length && !g.today.waitingOn.length) find("guide-empty", "no next step and nothing waiting");
    const keys = g.nextSteps.map(s => s.action.enterEventId).filter(Boolean);
    if (new Set(keys).size !== keys.length) find("guide-duplicate", keys.join(","));
    for (const s of g.nextSteps) log(`   ${s.tone} · ${s.title}`);
    // Do what the Guide says.
    for (const s of g.nextSteps) if (s.action.enterEventId) {
      const r = await act(`enter (guide) ${s.title}`, () => sporting.calendar.enter(actor, id, { eventId: s.action.enterEventId })) as { entered: boolean; denials: string[] } | undefined;
      if (r?.entered) stats.entries++;
      else if (r) find("guide-bad-pick", `${s.title}: ${r.denials.join(",")}`);
    }
  }
  // A sponsor offer on the Guide: look at it and sign, swapping out a deal it clashes with (as a player keen on the money would).
  for (const s of g?.nextSteps ?? []) if (s.key.startsWith("sponsor-offer:")) {
    const offerId = s.key.slice("sponsor-offer:".length);
    const view = await act("sponsors.read", () => sporting.finance.sponsors(actor, id)) as { offers: { id: string; kind: string; conflictingContractIds: string[]; portfolioFull: boolean }[] } | undefined;
    const o = view?.offers.find(x => String(x.id) === offerId);
    if (!o || (o.portfolioFull && !o.conflictingContractIds.length)) { log(`  (sponsor offer: ${o ? "portfolio full" : "gone"})`); continue; }
    const r = await act(`sign ${s.title}`, () => sporting.finance.acceptOffer(actor, id, { offerId, ...(o.kind !== "RENEWAL" && o.conflictingContractIds.length ? { replaceContractIds: o.conflictingContractIds } : {}) }),
      [/requirement|no longer|expired|full|commit|conflict/i]);
    if (r) { stats.sponsorsSigned++; log(`  signed: ${s.title.replace(" wants to sign you", "")}`); }
  }
  // The rest of a player's week, at random.
  if (focus === "DARTCAST_CREATOR" || rand() < streamRate) await doStream();
  if (moneyMatches) await doMoney();
  await doLocal(root.currentWeek);
  if (rand() < 0.1) await act("join team nights", () => teams.join(actor, id), [/already|no team|not|full|season|club/i]);

  // A season review waiting (the header's "Continue Season Review"): read it first, as a player must.
  const review = (await db.execute(sql`SELECT season FROM career_legacy_reviews WHERE career_save_id = ${id} AND acknowledged = false ORDER BY season LIMIT 1`).catch(() => ({ rows: [] }))).rows[0];
  if (review) await act("begin season (pending review)", () => legacy.begin(actor, id, Number(review.season), { confirmation: "BEGIN SEASON" }));
  // Play on: a week, resolving whatever stops it.
  let moved = false;
  for (let step = 0; step < 40; step++) {
    const now = await saves.read(playerId, id);
    if (now.currentWeek !== root.currentWeek || now.currentSeason !== root.currentSeason) { moved = true; break; }
    const r = await act("advance", () => sporting.calendar.advance(actor, id, { operationKey: `soak-${startSeed}-${i}-${step}`, expectedSeason: now.currentSeason, expectedWeek: now.currentWeek,
      target: { kind: "WEEKS", weeks: 1 } })) as { stop: { reason: string; detail?: Record<string, unknown> } } | undefined;
    if (!r) break;
    if (!["TARGET_REACHED", "LIMIT", "MEANINGFUL_DATE", "SEASON_BOUNDARY"].includes(r.stop.reason)) await resolve(r.stop, now);
  }
  if (!moved) {
    const now = await saves.read(playerId, id);
    if (now.currentWeek === root.currentWeek && now.currentSeason === root.currentSeason) find("stuck", "40 tries and the week never moved on");
  }
}

// ---------------------------------------------------------------- report
const end = await guide.read(actor, id).catch(() => null);
const kinds = new Map<string, Finding[]>();
for (const f of findings) kinds.set(f.kind, [...(kinds.get(f.kind) ?? []), f]);
console.log(`\n${weeks} weeks · ${stats.entries} entries · ${stats.matches} matches · ${stats.streams} streams · ${stats.moneyMatches} money matches · ${stats.localNights} local nights · ${stats.sponsorsSigned} sponsors signed`);
console.log(`blockers resolved: ${JSON.stringify(stats.blockers)}`);
console.log(`balance £${((await balance()) / 100).toFixed(0)} · path ${end?.path.label}: ${end?.path.done}/${end?.path.total} (${end?.path.current?.title ?? "complete"})`);
console.log(findings.length ? `\nFINDINGS (${findings.length}):` : "\nNo findings.");
for (const [k, list] of kinds) {
  const distinct = [...new Map(list.map(f => [f.detail.replace(/[0-9a-f-]{36}/g, ":id").replace(/\d+ ms/, "N ms"), f])).values()];
  console.log(`- ${k} ×${list.length}`);
  for (const f of distinct.slice(0, 6)) console.log(`    ${f.week}: ${f.detail}`);
}
await pool.end();
process.exit(0);
