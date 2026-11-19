import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { syncAll, WELCOME_COINS, LAUNCHED_KEY, type Setting } from "../achievements-v2/store.ts";

const SCHEMA = `
    CREATE TABLE players (id int primary key, name text, career_peak_elo int, eliminations_count int, longest_win_streak int, shift_wars_team_id int);
    CREATE TABLE seasons (id int primary key, start_date timestamptz, end_date timestamptz, is_active boolean, champion_id int);
    CREATE TABLE season_standings (season_id int, player_id int, position int, wins int, losses int, points int, is_champion boolean);
    CREATE TABLE matches (id serial primary key, season_id int, winner_id int, loser_id int, stake int, elo_change int, game_type text, played_at timestamptz,
      winner_darts int, winner_100s int, winner_140s int, winner_170s int, winner_180s int, winner_checkout_attempts int, winner_checkout_hits int,
      loser_darts int, loser_100s int, loser_140s int, loser_170s int, loser_180s int, loser_checkout_attempts int, loser_checkout_hits int);
    CREATE TABLE doubles_teams (id int primary key, season_id int, player1_id int, player2_id int, player3_id int, team_name text, points int, peak_points int, elo int, wins int, losses int, is_eliminated boolean);
    CREATE TABLE doubles_matches (id serial primary key, season_id int, winner_team_id int, loser_team_id int, stake int, elo_change int, game_type text, played_at timestamptz);
    CREATE TABLE doubles_combined_matches (id serial primary key, season_id int, played_at timestamp, solo_team_id int, solo_won boolean, stake int);
    CREATE TABLE doubles_combined_match_sides (id serial primary key, match_id int, team_id int);
    CREATE TABLE doubles_multi_matches (id serial primary key, season_id int, played_at timestamp, winner_team_id int, stake int);
    CREATE TABLE doubles_multi_match_participants (id serial primary key, match_id int, team_id int, is_winner boolean);
    CREATE TABLE shift_wars_matches (id serial primary key, winner_team_id int, loser_team_id int, stake int, played_at timestamptz);
    CREATE TABLE shift_wars_multi_matches (id serial primary key, season_id int, played_at timestamp, winner_team_id int, stake int);
    CREATE TABLE shift_wars_multi_match_participants (id serial primary key, match_id int, team_id int, is_winner boolean);
    CREATE TABLE shift_wars_combined_matches (id serial primary key, played_at timestamp, solo_team_id int, solo_won boolean, stake int);
    CREATE TABLE shift_wars_combined_match_sides (id serial primary key, match_id int, team_id int);
    CREATE TABLE shift_wars_season_history (id serial primary key, season_id int, team_id int, is_champion boolean, recorded_at timestamptz);
    CREATE TABLE practice_sessions (id serial primary key, player1_id int, game_type_key text, p1_darts int, p1_score int, p1_180s int, p1_checkout_attempts int, p1_checkout_hits int, winner_idx int, created_at timestamptz);
    CREATE TABLE master501_runs (id serial primary key, player_id int, tier int, round int, dart_limit int, legs_format int, legs_won int, legs_lost int, result text, completed_at timestamptz);
    CREATE TABLE board_curse_records (player_id int, format text, wins int, losses int);
    CREATE TABLE board_curse_best (player_id int, game_type text, best_visits int, best_streak int);
    CREATE TABLE boss_battle_stats (player_id int, boss_id text, attempts int, wins int, best_seconds int, clean_sweep boolean, highest_ascension int);`;

async function setup() {
  const pg = new PGlite(); const db = drizzle(pg);
  await pg.exec(SCHEMA);
  await pg.exec(`
    INSERT INTO players VALUES (1,'Alice',1100,0,2,null),(2,'Bob',1000,0,0,null),(3,'Cara',1000,0,0,null);
    INSERT INTO seasons VALUES (1,'2026-01-01',null,true,null);
    INSERT INTO matches (season_id,winner_id,loser_id,stake,elo_change,game_type,played_at) VALUES (1,1,2,5,8,'501','2026-01-05');`);
  const store = new Map<string, string>();
  const setting: Setting = { get: async k => store.get(k) ?? null, set: async (k, v) => { store.set(k, v); } };
  const paid: { pid: number; coins: number; detail: string }[] = [];
  const pay = async (pid: number, coins: number, detail: string) => { paid.push({ pid, coins, detail }); };
  return { pg, db, setting, store, paid, pay };
}
const q = async (pg: PGlite, s: string) => (await pg.query<Record<string, unknown>>(s)).rows;

test("launch sync credits history with no coins, pays the welcome bonus once, then live unlocks pay their points", async () => {
  const { pg, db, setting, store, paid, pay } = await setup();
  const first = await syncAll(db as never, setting, pay);
  assert.equal(first.mode, "history"); assert.ok(store.get(LAUNCHED_KEY));
  assert.ok(first.unlocks > 0);
  assert.deepEqual(paid.map(p => p.detail), ["v2:welcome", "v2:welcome"], "Alice (a win) and Bob (a match) get the welcome bonus; Cara has nothing");
  assert.ok(paid.every(p => p.coins === WELCOME_COINS));
  const aliceWins = await q(pg, "SELECT level, value FROM achievement_v2_items WHERE player_id = 1 AND key = 'league-wins'");
  assert.deepEqual(aliceWins, [{ level: 1, value: 1 }]);
  assert.equal((await q(pg, "SELECT count(*)::int AS n FROM achievement_v2_unlocks WHERE source <> 'history' OR coins <> 0 OR seen = false"))[0].n, 0);

  // Nothing new: nothing written, nothing paid
  const again = await syncAll(db as never, setting, pay);
  assert.equal(again.mode, "live"); assert.equal(again.unlocks, 0); assert.equal(again.itemsWritten, 0); assert.equal(paid.length, 2);

  // Alice wins 4 more: league wins reaches level 2 (5 wins) live, paying 20 coins, unseen
  await pg.exec("INSERT INTO matches (season_id,winner_id,loser_id,stake,elo_change,game_type,played_at) SELECT 1,1,3,5,8,'501','2026-01-06'::timestamptz + (g || ' hours')::interval FROM generate_series(1,4) g");
  const live = await syncAll(db as never, setting, pay);
  assert.equal(live.mode, "live");
  const winsUnlock = await q(pg, "SELECT level, coins, source, seen FROM achievement_v2_unlocks WHERE player_id = 1 AND key = 'league-wins' ORDER BY level");
  assert.deepEqual(winsUnlock, [{ level: 1, coins: 0, source: "history", seen: true }, { level: 2, coins: 20, source: "live", seen: false }]);
  assert.ok(paid.some(p => p.pid === 1 && p.detail === "v2:league-wins:2" && p.coins === 20));
  const bigNight = paid.find(p => p.pid === 1 && p.detail === "v2:big-night:1");
  assert.equal(bigNight?.coins, 30, "a feat pays its points");
  assert.equal(new Set(paid.map(p => p.detail + p.pid)).size, paid.length, "nothing paid twice");
});

test("levels are never taken away and a deleted match never claws anything back", async () => {
  const { pg, db, setting, pay, paid } = await setup();
  await syncAll(db as never, setting, pay);
  await pg.exec("DELETE FROM matches; INSERT INTO matches (season_id,winner_id,loser_id,stake,elo_change,game_type,played_at) VALUES (1,2,1,5,8,'501','2026-01-07')");
  await syncAll(db as never, setting, pay);
  assert.equal((await q(pg, "SELECT count(*)::int AS n FROM achievement_v2_unlocks WHERE player_id = 1 AND source = 'live'"))[0].n, 0, "Alice gains nothing");
  assert.deepEqual(await q(pg, "SELECT level, value FROM achievement_v2_items WHERE player_id = 1 AND key = 'league-wins'"), [{ level: 1, value: 0 }], "value follows the data, level stays");
  assert.ok(paid.slice(2).every(p => p.pid === 2), "only Bob, for his new win");
});

test("two syncs at once cannot pay the same unlock twice", async () => {
  const { pg, db, setting, pay, paid } = await setup();
  await syncAll(db as never, setting, pay);
  await pg.exec("INSERT INTO matches (season_id,winner_id,loser_id,stake,elo_change,game_type,played_at) SELECT 1,1,3,5,8,'501','2026-01-06'::timestamptz + (g || ' hours')::interval FROM generate_series(1,4) g");
  await Promise.all([syncAll(db as never, setting, pay), syncAll(db as never, setting, pay)]);
  assert.equal(paid.filter(p => p.detail === "v2:league-wins:2").length, 1);
});

test("the page reads the same from saved rows as from a live preview, and hides secrets until earned", async () => {
  const { pg, db, setting, pay } = await setup();
  const { toView, storedStates, liveStates } = await import("../achievements-v2/view.ts");
  await pg.exec("INSERT INTO matches (season_id,winner_id,loser_id,stake,elo_change,game_type,played_at) SELECT 1,1,3,5,8,'501','2026-01-06'::timestamptz + (g || ' hours')::interval FROM generate_series(1,4) g");
  await syncAll(db as never, setting, pay);
  const saved = toView(await storedStates(db as never, 1), 1), live = toView(await liveStates(db as never, 1), 1);
  const strip = (v: typeof saved) => v.areas.map(a => [a.area, a.score, a.tracks.map(t => [t.key, t.value, t.level, t.metal, t.next]), a.feats.map(f => [f.key, !!f.earnedAt]), a.seasonGoals.map(g => [g.key, g.value, g.completed])]);
  assert.deepEqual(strip(saved), strip(live));
  const league = saved.areas.find(a => a.area === "LEAGUE")!;
  const wins = league.tracks.find(t => t.key === "league-wins")!;
  assert.deepEqual([wins.value, wins.level, wins.metal, wins.next], [5, 2, "BRONZE", "Win 10 league matches"]);
  assert.equal(league.feats.find(f => f.key === "back-from-the-brink")?.title, "Secret");
  assert.equal(league.seasonGoals.find(g => g.key === "season-wins")?.value, 5);
  assert.ok(saved.nearly.length > 0 && saved.nearly.every(t => t.progress > 0 && t.progress < 1));
  assert.equal(saved.areas.length, 5);
});

test("a live feat recorded as it happens is awarded, shows as unseen and can be marked seen", async () => {
  const { pg, db, setting, pay, paid } = await setup();
  const { recordLiveFeat } = await import("../achievements-v2/store.ts");
  const { unseenUnlocks, markSeen } = await import("../achievements-v2/view.ts");
  await syncAll(db as never, setting, pay);                    // launch
  await recordLiveFeat(db as never, 1, "backFromBrink", new Date("2026-01-08T20:00:00Z"));
  await recordLiveFeat(db as never, 1, "backFromBrink", new Date("2026-01-09T20:00:00Z"));   // once only
  await syncAll(db as never, setting, pay);
  assert.ok(paid.some(p => p.pid === 1 && p.detail === "v2:back-from-the-brink:1" && p.coins === 80));
  const unseen = await unseenUnlocks(db as never, 1);
  assert.ok(unseen.some(u => u.key === "back-from-the-brink" && u.coins === 80));
  await markSeen(db as never, 1, unseen.map(u => u.id));
  assert.equal((await unseenUnlocks(db as never, 1)).length, 0);
  assert.equal((await q(pg, "SELECT count(*)::int AS n FROM achievement_v2_live"))[0].n, 1);
});
