/** Ranking history archive: old seasons' weekly tables are thinned to what the screens read, with a per-season summary. */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { createCareerSaves } from "../../db/migrations/create_career_saves.ts";
import { createCareerWorld } from "../../db/migrations/create_career_world.ts";
import { createCareerSponsorshipFoundation } from "../../db/migrations/create_career_sponsorship_foundation.ts";
import { createCareerNpcSponsorMarketSPF } from "../../db/migrations/create_career_npc_sponsor_market_spf.ts";
import { createCareerCalendar } from "../../db/migrations/create_career_calendar.ts";
import { createCareerFinance } from "../../db/migrations/create_career_finance.ts";
import { createCareerSporting } from "../../db/migrations/create_career_sporting.ts";
import { createCareerService } from "../../career/service.ts";
import { archiveRankingSeason, seasonsToArchive, archiveExistingRankingHistory, FULL_RANKING_SEASONS } from "../../career/sporting/archive.ts";

const pg = new PGlite(), db = drizzle(pg);
let id = "";
const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rows;
const WEEKS = 12, PLAYERS = 20;
/** Week w's table: the human sits at 15, NPC i at a position that moves round each week (so bests and worsts differ). */
const table = (w: number) => { const npcs = Array.from({ length: PLAYERS - 1 }, (_, i) => `npc-${i}`);
  const order = [...npcs.slice(w % npcs.length), ...npcs.slice(0, w % npcs.length)]; order.splice(14, 0, "HUMAN"); return order; };

before(async () => {
  await pg.exec(`CREATE TABLE players (id INTEGER PRIMARY KEY); INSERT INTO players VALUES (1);
    CREATE TABLE feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);
    INSERT INTO feature_flags VALUES ('tour_career_2', true, false, 'test')`);
  for (const m of [createCareerSaves, createCareerWorld, createCareerSponsorshipFoundation, createCareerNpcSponsorMarketSPF, createCareerCalendar, createCareerFinance, createCareerSporting]) await m(db);
  id = (await createCareerService(db).create(1, { slot: 1, careerName: "Archive" })).id;
  for (const season of [1, 2]) for (let w = 1; w <= WEEKS; w++) {
    const snap = randomUUID(), P = season * 100 + w, seq = (season - 1) * WEEKS + w;
    await db.execute(sql`INSERT INTO career_ranking_snapshots (career_save_id, id, list_key, sequence, season, week, publication_index, ranking_rules_version,
        participant_count, counted_contributions, new_contributions, expired_contributions, cut_values, reason)
      VALUES (${id}, ${snap}, 'pro-world', ${seq}, ${season}, ${w}, ${P}, 1, ${PLAYERS}, ${PLAYERS}, 0, 0, '{}', 'RESULTS')`);
    for (const [i, key] of table(w).entries()) await db.execute(sql`INSERT INTO career_ranking_snapshot_rows (career_save_id, snapshot_id, list_key, publication_index, season,
        participant_key, participant_kind, position, value_pence, is_new, career_high_position, counted_contributions)
      VALUES (${id}, ${snap}, 'pro-world', ${P}, ${season}, ${key}, ${key === "HUMAN" ? "HUMAN" : "NPC"}, ${i + 1}, ${1000 - i}, false, ${i + 1}, 1)`);
  }
});
after(async () => { await pg.close(); });

test("only seasons older than the full window are archived, once each", async () => {
  assert.deepEqual(await seasonsToArchive(db, id, 1 + FULL_RANKING_SEASONS - 1), [], "the current season and the two before it stay whole");
  assert.deepEqual(await seasonsToArchive(db, id, 2 + FULL_RANKING_SEASONS), [1, 2]);
});

test("an archived season keeps the human weekly, the top 8 weekly, monthly full tables, each player's best, and a summary", async () => {
  const before = await rows(sql`SELECT r.participant_key, r.position, s.week FROM career_ranking_snapshot_rows r JOIN career_ranking_snapshots s
    ON s.career_save_id = r.career_save_id AND s.id = r.snapshot_id WHERE r.career_save_id = ${id} AND r.season = 1`);
  const removed = await archiveRankingSeason(db, id, 1);
  const afterRows = await rows(sql`SELECT r.participant_key, r.position, s.week FROM career_ranking_snapshot_rows r JOIN career_ranking_snapshots s
    ON s.career_save_id = r.career_save_id AND s.id = r.snapshot_id WHERE r.career_save_id = ${id} AND r.season = 1`);
  const kept = new Set(afterRows.map(r => `${r.week}:${r.participant_key}`));
  const fullWeeks = new Set([1, 4, 8, 12]);
  const bestOf = new Map<string, { position: number; week: number }>();
  for (const r of [...before].sort((a, b) => Number(a.week) - Number(b.week))) {
    const b = bestOf.get(String(r.participant_key));
    if (!b || Number(r.position) < b.position) bestOf.set(String(r.participant_key), { position: Number(r.position), week: Number(r.week) });
  }
  for (const r of before) {
    const key = String(r.participant_key), week = Number(r.week), mustKeep = key === "HUMAN" || Number(r.position) <= 8 || fullWeeks.has(week) || bestOf.get(key)!.week === week;
    assert.equal(kept.has(`${week}:${key}`), mustKeep, `week ${week} ${key} at ${r.position}`);
  }
  assert.equal(removed, before.length - afterRows.length);
  assert.ok(afterRows.length < before.length * 0.75, `thinned: ${afterRows.length} of ${before.length}`);
  for (const [key, b] of bestOf) {
    const mine = before.filter(r => r.participant_key === key).map(r => Number(r.position));
    const [summary] = await rows(sql`SELECT best, worst, snapshots FROM career_ranking_season_summaries WHERE career_save_id = ${id} AND list_key = 'pro-world' AND participant_key = ${key} AND season = 1`);
    assert.deepEqual([Number(summary.best), Number(summary.worst), Number(summary.snapshots)], [b.position, Math.max(...mine), mine.length]);
  }
  assert.equal(await archiveRankingSeason(db, id, 1), 0, "a season is archived once");
  assert.equal((await rows(sql`SELECT COUNT(*)::int AS n FROM career_ranking_snapshot_rows WHERE career_save_id = ${id} AND season = 2`))[0].n, WEEKS * PLAYERS, "other seasons untouched");
});

test("long careers already in the database are archived after startup, then the job stays done", async () => {
  await db.execute(sql`UPDATE career_saves SET current_season = ${2 + FULL_RANKING_SEASONS} WHERE id = ${id}`);
  assert.ok(await archiveExistingRankingHistory(db, { pauseMs: 0 }) > 0, "season 2 thinned");
  assert.deepEqual((await rows(sql`SELECT season FROM career_ranking_archives WHERE career_save_id = ${id} ORDER BY season`)).map(r => Number(r.season)), [1, 2]);
  assert.equal(await archiveExistingRankingHistory(db, { pauseMs: 0 }), 0);
});
