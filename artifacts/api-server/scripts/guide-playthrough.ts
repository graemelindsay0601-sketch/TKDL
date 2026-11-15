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

const weeks = Number(process.argv[2] ?? 10), focus = process.argv[3] ?? "OPEN_SCHEDULE";
// The Postgres driver lives with the shared db package.
const pg = createRequire(new URL("../../../lib/db/package.json", import.meta.url))("pg") as typeof import("pg");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = readRetryingCareerDatabase(drizzle(pool) as never);
const saves = createCareerService(db), sporting = createCareerSportingService(db), goals = createCareerGoalsService(db);
const guide = createCareerGuideService(db, { calendar: sporting.calendar, goals, sponsors: sporting.finance, streaming: createCareerStreamingService(db), money: createCareerMoneyService(db) });

const playerId = Number(process.argv[4] ?? (await db.execute(sql`SELECT player_id AS id FROM career_saves ORDER BY created_at DESC LIMIT 1`)).rows[0]?.id);
const actor = { playerId, isAdmin: false };
const used = new Set((await db.execute(sql`SELECT slot_number FROM career_saves WHERE player_id = ${playerId} AND status = 'ACTIVE'`)).rows.map(r => Number(r.slot_number)));
const slot = [1, 2, 3].find(s => !used.has(s));
if (!slot) throw new Error("No free Career slot for this player: free one, or pass another player id");
const save = await saves.create(playerId, { slot, careerName: `Guide run ${new Date().toISOString().slice(0, 16)}`, dateOfBirth: "1998-04-02" });
await sporting.initialize(actor, save.id);
if (focus !== "OPEN_SCHEDULE") await goals.focus(actor, save.id, { focus });
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
  // Play on one week; our matches are won or lost at random.
  for (let step = 0; step < 30; step++) {
    const root = await saves.read(playerId, save.id);
    if (root.currentWeek > g.today.week || root.currentSeason > g.today.season) break;
    const r = await sporting.calendar.advance(actor, save.id, { operationKey: `guide-run-${i}-${step}`, expectedSeason: root.currentSeason, expectedWeek: root.currentWeek,
      target: { kind: "WEEKS", weeks: 1 } }) as { stop: { reason: string; detail?: { matchIds?: string[] } } };
    if (r.stop.reason === "HUMAN_MATCH_PENDING") for (const matchId of r.stop.detail?.matchIds ?? []) {
      const m = (await db.execute(sql`SELECT best_of FROM career_tournament_matches WHERE career_save_id = ${save.id} AND id = ${matchId}`)).rows[0];
      const need = (Number(m.best_of) + 1) / 2, win = Math.random() < 0.5;
      await sporting.calendar.recordHumanMatchResult(actor, save.id, { matchId, humanLegs: win ? need : 0, opponentLegs: win ? 0 : need, humanThrewFirst: true });
      if (win) wins++; else losses++;
    } else if (r.stop.reason !== "TARGET_REACHED") console.log(`  (stopped: ${r.stop.reason})`);
  }
}
console.log(`\n${entered} entries, ${wins} matches won, ${losses} lost.`);
process.exit(0);
