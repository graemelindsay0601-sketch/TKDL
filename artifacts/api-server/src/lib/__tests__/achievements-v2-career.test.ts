import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { evaluateCareer, type CareerData, type CareerMatch } from "../achievements-v2/career.ts";
import { evaluate, catalogueFor } from "../achievements-v2/evaluate.ts";
import { loadCareer } from "../achievements-v2/report.ts";
import { toView } from "../achievements-v2/view.ts";

const at = (d: number) => new Date(Date.UTC(2026, 9, d));
const match = (i: number, won: boolean, live: CareerMatch["live"] = null, saveId = "s1"): CareerMatch =>
  ({ saveId, id: `m${i}`, season: 1, day: i, eventId: `e${i}`, round: 1, slot: 0, won, completedAt: at(i), live });
const empty = (): CareerData => ({ saves: [{ id: "s1", status: "ACTIVE", retiredAt: null }], matches: [], results: [], cards: [], bestRank: null, inducted: [] });

test("career: wins, titles, majors, live 180s and feats with their real dates", () => {
  const d = empty();
  d.matches = [...Array.from({ length: 10 }, (_, i) => match(i + 1, true)), match(11, false, { average: 101.2, maximums: 4, highestCheckout: 170, nineDarters: 1 })];
  d.results = [
    { saveId: "s1", eventId: "f1", season: 1, endDay: 1, champion: false, final: true, qualifier: false, tier: "STANDARD", circuit: "PRO_TOUR", recordedAt: at(1) },
    { saveId: "s1", eventId: "f2", season: 1, endDay: 2, champion: false, final: true, qualifier: false, tier: "STANDARD", circuit: "PRO_TOUR", recordedAt: at(2) },
    { saveId: "s1", eventId: "f3", season: 1, endDay: 3, champion: false, final: true, qualifier: false, tier: "STANDARD", circuit: "PRO_TOUR", recordedAt: at(3) },
    { saveId: "s1", eventId: "q", season: 1, endDay: 4, champion: true, final: false, qualifier: true, tier: "LOCAL", circuit: "PRO_TOUR", recordedAt: at(4) },
    { saveId: "s1", eventId: "w", season: 2, endDay: 5, champion: true, final: false, qualifier: false, tier: "WORLD", circuit: "WORLD_CHAMPIONSHIP", recordedAt: at(5) },
  ];
  d.cards = [
    { saveId: "s1", status: "LOST", source: "Q_SCHOOL", awardedSeason: 1, awardedWeek: 1, endedSeason: 2, endedWeek: 50, createdAt: at(1) },
    { saveId: "s1", status: "ACTIVE", source: "Q_SCHOOL", awardedSeason: 3, awardedWeek: 2, endedSeason: null, endedWeek: null, createdAt: at(9) },
  ];
  d.bestRank = 12;
  const f = evaluateCareer(d);
  assert.deepEqual(f.metrics, { careerWins: 10, careerTitles: 1, careerMajors: 1, career180s: 4, careerBestRank: 12, careerSeasons: 2 });
  assert.deepEqual(f.feats.hotStreak, at(10));
  assert.deepEqual(f.feats.bigFish, at(11)); assert.deepEqual(f.feats.onFire, at(11)); assert.deepEqual(f.feats.perfection, at(11));
  assert.deepEqual(f.feats.maidenTitle, at(5), "a qualifier is not a title");
  assert.deepEqual(f.feats.bridesmaid, at(5)); assert.deepEqual(f.feats.worldChampion, at(5));
  assert.deepEqual(f.feats.turningPro, at(1)); assert.deepEqual(f.feats.secondChance, at(9));
  assert.equal(f.feats.goldWatch, undefined);

  const states = evaluate(catalogueFor("CAREER"), f);
  const climb = states.find(s => s.key === "career-ranking"); assert.ok(climb?.kind === "TRACK");
  assert.equal(climb.level, 3, "#12 is inside the top 64, 32 and 16"); assert.equal(climb.next?.text, "Reach world ranking top 8");
  const view = toView(states, null).areas.find(a => a.area === "CAREER")!;
  assert.equal(view.feats.find(f => f.key === "world-champion")?.showpiece, true);
});

test("career: streaks don't run across saves, live darts only, retirement feats", () => {
  const d = empty();
  d.saves.push({ id: "s2", status: "RETIRED", retiredAt: at(20) });
  d.matches = [...Array.from({ length: 5 }, (_, i) => match(i, true)), ...Array.from({ length: 5 }, (_, i) => match(i + 10, true, null, "s2"))];
  d.results = [{ saveId: "s2", eventId: "t", season: 1, endDay: 1, champion: true, final: false, qualifier: false, tier: "STANDARD", circuit: "PRO_TOUR", recordedAt: at(3) }];
  d.inducted = ["s2"];
  const f = evaluateCareer(d);
  assert.equal(f.feats.hotStreak, undefined); assert.equal(f.metrics.career180s, 0);
  assert.deepEqual(f.feats.goldWatch, at(20)); assert.deepEqual(f.feats.hallOfFamer, at(20));
  const climb = evaluate(catalogueFor("CAREER"), f).find(s => s.key === "career-ranking"); assert.ok(climb?.kind === "TRACK");
  assert.equal(climb.level, 0); assert.equal(climb.progress, 0, "no ranking yet");
});

test("career loader reads only the human's rows and is empty without Career tables", async () => {
  const pg = new PGlite(); const db = drizzle(pg);
  assert.equal((await loadCareer(db as never)).size, 0);
  await pg.exec(`
    CREATE TABLE career_saves (id text, player_id int, status text, retired_at timestamptz);
    CREATE TABLE career_event_instances (career_save_id text, id text, season int, end_day int, classification text, presentation_tier text, circuit text, status text);
    CREATE TABLE career_tournament_matches (career_save_id text, id text, event_id text, round int, slot int, scheduled_day int, a_key text, b_key text, winner_key text,
      status text, result_source text, completed_at timestamptz, summary jsonb);
    CREATE TABLE career_event_results (career_save_id text, event_id text, participant_key text, season int, is_champion boolean, stage_reached text, recorded_at timestamptz);
    CREATE TABLE career_tour_cards (career_save_id text, participant_key text, status text, source text, awarded_season int, awarded_week int, ended_season int, ended_week int, created_at timestamptz);
    CREATE TABLE career_ranking_snapshot_rows (career_save_id text, participant_key text, list_key text, position int);
    CREATE TABLE career_legacy_inductions (career_save_id text, participant_key text, evidence jsonb);
    INSERT INTO career_saves VALUES ('s1', 7, 'ACTIVE', null);
    INSERT INTO career_event_instances VALUES ('s1','e1',1,10,'RANKING','MAJOR','PRO_TOUR','COMPLETED');
    INSERT INTO career_tournament_matches VALUES
      ('s1','m1','e1',1,0,5,'HUMAN','NPC','HUMAN','COMPLETED','HUMAN_LIVE','2026-10-01','{"live":{"facts":{"human":{"average":88.5,"maximums":3,"highestCheckout":121,"nineDarters":0}}}}'),
      ('s1','m2','e1',2,0,6,'HUMAN','NPC','HUMAN','COMPLETED','BYE','2026-10-02','{}'),
      ('s1','m3','e1',1,1,5,'NPC','NPC','NPC','COMPLETED','A2_SIMULATION','2026-10-01','{}');
    INSERT INTO career_event_results VALUES ('s1','e1','HUMAN',1,true,'FINAL','2026-10-03'),('s1','e1','NPC',1,false,'FINAL','2026-10-03');
    INSERT INTO career_tour_cards VALUES ('s1','HUMAN','ACTIVE','Q_SCHOOL',1,1,null,null,'2026-09-01'),('s1','NPC','ACTIVE','Q_SCHOOL',1,1,null,null,'2026-09-01');
    INSERT INTO career_ranking_snapshot_rows VALUES ('s1','HUMAN','pro-world',40),('s1','HUMAN','pro-world',22),('s1','NPC','pro-world',1);`);
  const d = (await loadCareer(db as never)).get(7)!;
  assert.equal(d.matches.length, 1, "byes and other players' matches don't count");
  assert.deepEqual(d.matches[0].live, { average: 88.5, maximums: 3, highestCheckout: 121, nineDarters: 0 });
  assert.equal(d.results.length, 1); assert.equal(d.cards.length, 1); assert.equal(d.bestRank, 22);
  const f = evaluateCareer(d);
  assert.equal(f.metrics.careerMajors, 1); assert.ok(f.feats.tonPlusFinish);
});

test("achievement cosmetics: granted once from current states, seeded as award-only, never duplicated", async () => {
  const { grantRewards, REWARDS, EARNED_BY } = await import("../achievements-v2/rewards.ts");
  const pg = new PGlite(); const db = drizzle(pg);
  await pg.exec(`CREATE TABLE cosmetic_definitions (id text primary key, category text, name text, rarity text, price int, color text, gradient text, glow text, icon_key text,
      enabled boolean, purchasable boolean, sort_order int);
    CREATE TABLE player_cosmetics (id serial primary key, player_id int, cosmetic_id text references cosmetic_definitions(id));`);
  const d = empty(); d.results = [{ saveId: "s1", eventId: "w", season: 1, endDay: 1, champion: true, final: false, qualifier: false, tier: "WORLD", circuit: "WORLD_CHAMPIONSHIP", recordedAt: at(1) }];
  d.matches = Array.from({ length: 1000 }, (_, i) => match(i, true));
  const states = evaluate(catalogueFor("CAREER"), evaluateCareer(d));
  const first = await grantRewards(db as never, new Map([[7, states]]));
  assert.deepEqual(first.map(g => g.cosmeticId).sort(), ["frame-av2-career", "name-av2-world-champion"]);
  assert.equal((await grantRewards(db as never, new Map([[7, states]]))).length, 0, "already owned");
  assert.equal((await pg.query<{ n: number }>(`SELECT count(*)::int n FROM player_cosmetics`)).rows[0].n, 2);
  const defs = (await pg.query<{ n: number }>(`SELECT count(*)::int n FROM cosmetic_definitions WHERE purchasable = false AND price = 0`)).rows[0].n;
  assert.equal(defs, REWARDS.length); assert.equal(Object.keys(EARNED_BY).length, REWARDS.length);
});
