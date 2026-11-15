/**
 * Guide playthrough: a fresh Career played week by week doing only what the Career Guide suggests (enter what its steps
 * say to enter, then play on), with your matches won or lost at random. Prints what the Guide said each week, so its
 * advice can be read as a player would meet it. Runs against DATABASE_URL (a local dev database: it creates a save).
 * Usage: node scripts/guide-playthrough.ts [weeks=10] [focus=OPEN_SCHEDULE] [playerId]
 */
import { sql } from "drizzle-orm";
import { createRequire } from "node:module";
import { drizzle } from "drizzle-orm/node-postgres";
import { readRetryingCareerDatabase } from "../src/career/request-scope.ts";
import { createCareerService } from "../src/career/service.ts";
import { createCareerSportingService } from "../src/career/sporting/service.ts";
import { createCareerGoalsService } from "../src/career/goals/service.ts";
import { createCareerStreamingService } from "../src/career/streaming/service.ts";
import { createCareerMoneyService } from "../src/career/money/service.ts";
import { createCareerGuideService } from "../src/career/guide/service.ts";
import { createCareerLegacyService } from "../src/career/legacy/service.ts";

const weeks = Number(process.argv[2] ?? 10), focus = process.argv[3] ?? "OPEN_SCHEDULE";
// The Postgres driver lives with the shared db package.
const pg = createRequire(new URL("../../../lib/db/package.json", import.meta.url))("pg") as typeof import("pg");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = readRetryingCareerDatabase(drizzle(pool) as never);
const legacy = createCareerLegacyService(db);
const saves = createCareerService(db), sporting = createCareerSportingService(db), goals = createCareerGoalsService(db);
const streaming = createCareerStreamingService(db);
const guide = createCareerGuideService(db, { calendar: sporting.calendar, goals, sponsors: sporting.finance, streaming, money: createCareerMoneyService(db) });

const winRate = Number(process.env.WIN_RATE ?? 0.5);
const playerId = Number(process.argv[4] ?? (await db.execute(sql`SELECT player_id AS id FROM career_saves ORDER BY created_at DESC LIMIT 1`)).rows[0]?.id);
const actor = { playerId, isAdmin: false };
const used = new Set((await db.execute(sql`SELECT slot_number FROM career_saves WHERE player_id = ${playerId} AND status = 'ACTIVE'`)).rows.map(r => Number(r.slot_number)));
const slot = [1, 2, 3].find(s => !used.has(s));
if (!slot) throw new Error("No free Career slot for this player: free one, or pass another player id");
const save = await saves.create(playerId, { slot, careerName: `Guide run ${new Date().toISOString().slice(0, 16)}`, dateOfBirth: "1998-04-02" });
await sporting.initialize(actor, save.id);
if (focus !== "OPEN_SCHEDULE") await goals.focus(actor, save.id, { focus });
// A creator opens DartCast and streams twice a week, as the creator path's steps say.
const creator = focus === "DARTCAST_CREATOR";
if (creator) await streaming.setPathway(actor, save.id, { focus: "DARTCAST", weeklyFrequency: 2 }).catch(e => console.log(`  (pathway: ${(e as Error).message})`));
const T20 = { segment: 20, multiplier: 3, value: 60 }, T19 = { segment: 19, multiplier: 3, value: 57 }, D12 = { segment: 12, multiplier: 2, value: 24 }, MISS = { segment: 0, multiplier: 1, value: 0 };
const dart = (segment: number, multiplier: number) => ({ segment, multiplier, value: segment * multiplier });
/** Pub-standard visits (about a 50 average): mostly 26 to 60, some tons, the odd 140 and 180. */
const VISITS: [number, object[]][] = [[0.14, [dart(5, 1), dart(1, 1), dart(20, 1)]], [0.3, [dart(20, 1), dart(20, 1), dart(5, 1)]], [0.26, [dart(20, 1), dart(20, 1), dart(20, 1)]],
  [0.12, [dart(20, 3), dart(5, 1), dart(20, 1)]], [0.12, [dart(20, 3), dart(20, 1), dart(20, 1)]], [0.04, [dart(20, 3), dart(20, 3), dart(20, 1)]], [0.02, [dart(20, 3), dart(20, 3), dart(20, 3)]]];
const scoreOf = (v: object[]) => (v as { value: number }[]).reduce((a, d) => a + d.value, 0);
function visitFor(rem: number): { darts: object[]; out: boolean } {
  if (rem <= 40 && rem % 2 === 0) return Math.random() < 0.45 ? { darts: [MISS, MISS, dart(rem / 2, 2)], out: true } : { darts: [MISS, MISS, MISS], out: false };
  if (rem <= 41) return Math.random() < 0.4 ? { darts: [MISS, dart(1, 1), dart((rem - 1) / 2, 2)], out: true } : { darts: [MISS, MISS, MISS], out: false };
  let r = Math.random(), v = VISITS[0][1];
  for (const [p, darts] of VISITS) { if (r < p) { v = darts; break; } r -= p; }
  // Never bust or leave 1: drop to a smaller visit near the finish.
  while (rem - scoreOf(v) < 2 && v !== VISITS[0][1]) v = VISITS[0][1];
  return rem - scoreOf(v) < 2 ? { darts: [MISS, MISS, MISS], out: false } : { darts: v, out: false };
}
/** One leg, alternating visits from whoever throws first, until someone checks out. */
const leg = (youFirst: boolean) => { const darts: object[] = []; const rem = { you: 501, them: 501 };
  for (let turn = 0; turn < 200; turn++) { const who = (turn % 2 === 0) === youFirst ? "you" : "them"; const v = visitFor(rem[who]);
    darts.push(...v.darts); rem[who] -= scoreOf(v.darts); if (v.out) break; }
  return darts; };
/** Play out a stream's darts (a leg or two either way, whoever throws first), then end it. */
async function stream(dayOfWeek: number): Promise<string> {
  const v = await streaming.read(actor, save.id) as { formats: { key: string; why: string | null }[] };
  const format = v.formats.find(f => !f.why && ["CHALLENGER", "COMMUNITY", "KING", "CHECKOUTS"].includes(f.key))?.key ?? v.formats.find(f => !f.why)?.key;
  if (!format) return "no format";
  const s = await streaming.goLive(actor, save.id, { dayOfWeek, format }) as { id: string };
  for (let n = 0; n < 9; n++) {
    const r = await streaming.darts(actor, save.id, s.id, { darts: leg(n % 2 === 0) }) as { session: { status: string } };
    if (r.session.status !== "LIVE") break;
  }
  await streaming.end(actor, save.id, s.id).catch(() => undefined);
  return format;
}
console.log(`save ${save.id} (slot ${slot}), focus ${focus}\n`);

let wins = 0, losses = 0, entered = 0;
for (let i = 0; i < weeks; i++) {
  const g = await guide.read(actor, save.id);
  const bal = Number((await db.execute(sql`SELECT balance_pence FROM career_saves WHERE id = ${save.id}`)).rows[0]?.balance_pence ?? 0);
  console.log(`— Week ${g.today.week} ${g.today.dayName} (${g.today.phase}) · £${(bal / 100).toFixed(0)} · path: ${g.path.current?.title ?? "done"} ${g.path.current?.progress ? `(${g.path.current.progress})` : ""}`);
  console.log(`  ${g.today.headline}`);
  for (const [n, s] of g.nextSteps.entries()) console.log(`  ${n + 1}. [${s.tone}] ${s.title} — ${s.why}`);
  if (g.missed.length) console.log(`  missed: ${g.missed.map(m => `${m.name} (${m.when})`).join("; ")}`);
  // Do what the guide says: enter its suggested events.
  for (const s of g.nextSteps) if (s.action.enterEventId) {
    const r = await sporting.calendar.enter(actor, save.id, { eventId: s.action.enterEventId }) as { entered: boolean; denials: string[] };
    console.log(`  → enter ${s.title.replace(/^(Enter|Last week to enter) /, "")}: ${r.entered ? "entered" : r.denials.join(",")}`);
    if (r.entered) entered++;
  }
  if (creator) {
    const v = await streaming.read(actor, save.id) as { freeNights: number[]; streamsThisWeek: number; perWeek: number; pathway: { scheduledNights: number[] } };
    // Booked shows first (Continue waits for them), then free nights up to the weekly allowance.
    const nights = [...new Set([...v.pathway.scheduledNights, ...v.freeNights])].slice(0, Math.max(0, v.perWeek - v.streamsThisWeek));
    for (const d of nights) { const f = await stream(d).catch(e => `error: ${(e as Error).message}`); console.log(`  → stream ${["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][d]} (${f})`); }
    const after = await streaming.read(actor, save.id) as { followers: number; tier: { name: string } };
    console.log(`  DartCast: ${after.followers} followers, ${after.tier.name}`);
  }
  // Play on one week; our matches are won or lost at random.
  for (let step = 0; step < 30; step++) {
    const root = await saves.read(playerId, save.id);
    if (root.currentWeek > g.today.week || root.currentSeason > g.today.season) break;
    const r = await sporting.calendar.advance(actor, save.id, { operationKey: `guide-run-${i}-${step}`, expectedSeason: root.currentSeason, expectedWeek: root.currentWeek,
      target: { kind: "WEEKS", weeks: 1 } }) as { stop: { reason: string; detail?: { matchIds?: string[] } } };
    if (r.stop.reason === "HUMAN_MATCH_PENDING") for (const matchId of r.stop.detail?.matchIds ?? []) {
      const m = (await db.execute(sql`SELECT best_of FROM career_tournament_matches WHERE career_save_id = ${save.id} AND id = ${matchId}`)).rows[0];
      const need = (Number(m.best_of) + 1) / 2, win = Math.random() < winRate;
      await sporting.calendar.recordHumanMatchResult(actor, save.id, { matchId, humanLegs: win ? need : 0, opponentLegs: win ? 0 : need, humanThrewFirst: true });
      if (win) wins++; else losses++;
    } else if (r.stop.reason === "SEASON_REVIEW") {
      // Read the season review and begin the next season, as the Guide's first step says.
      const season = Number((r.stop.detail as { season?: number } | undefined)?.season ?? root.currentSeason);
      await legacy.begin(actor, save.id, season, { confirmation: "BEGIN SEASON" }).catch(e => console.log(`  (season review: ${(e as Error).message})`));
      console.log(`  == season ${season} reviewed; next season begins ==`);
      break;
    } else if (r.stop.reason !== "TARGET_REACHED") console.log(`  (stopped: ${r.stop.reason})`);
  }
}
const end = await guide.read(actor, save.id);
const fin = (await db.execute(sql`SELECT balance_pence, has_tour_card FROM career_saves WHERE id = ${save.id}`)).rows[0] as { balance_pence: number; has_tour_card?: boolean };
console.log(`\n${entered} entries, ${wins} matches won, ${losses} lost. Balance £${(Number(fin.balance_pence) / 100).toFixed(0)}.`);
console.log(`Path ${end.path.label}: ${end.path.done}/${end.path.total} steps; now: ${end.path.current?.title ?? "complete"} ${end.path.current?.progress ?? ""}`);
process.exit(0);
