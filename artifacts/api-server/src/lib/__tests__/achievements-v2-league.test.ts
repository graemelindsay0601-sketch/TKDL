import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateLeague, type LeagueContext, type LeagueMatch } from "../achievements-v2/league.ts";
import { evaluate, catalogueFor } from "../achievements-v2/evaluate.ts";
import { metalFor } from "../achievements-v2/catalogue.ts";

const ME = 1;
let nextId = 1;
const day = (d: number, h = 19) => new Date(Date.UTC(2026, 0, 5 + d, h)); // 5 Jan 2026 is a Monday
const match = (seasonId: number, winnerId: number, loserId: number, at: Date, extra: Partial<LeagueMatch> = {}): LeagueMatch => ({
  id: nextId++, seasonId, winnerId, loserId, stake: 5, eloChange: 10, gameType: "501", playedAt: at,
  winner180s: null, loser180s: null, winner140s: null, loser140s: null, winner170s: null, loser170s: null, winner100s: null, loser100s: null,
  winnerDarts: null, loserDarts: null, winnerCheckoutAttempts: null, winnerCheckoutHits: null, loserCheckoutAttempts: null, loserCheckoutHits: null, ...extra,
});
const ctx = (matches: LeagueMatch[], extra: Partial<LeagueContext> = {}): LeagueContext => {
  const participants = new Map<number, Set<number>>();
  for (const m of matches) { const s = participants.get(m.seasonId) ?? new Set(); s.add(m.winnerId); s.add(m.loserId); participants.set(m.seasonId, s); }
  return { matches, seasons: [{ id: 1, startDate: day(0, 0), endDate: day(27, 23), isActive: false, championId: 2 }, { id: 2, startDate: day(28, 0), endDate: null, isActive: true, championId: null }],
    standings: [{ seasonId: 1, playerId: 2, position: 1, wins: 9, losses: 1, points: 140, isChampion: true }, { seasonId: 1, playerId: ME, position: 3, wins: 5, losses: 4, points: 90, isChampion: false }],
    participants, player: { id: ME, careerPeakElo: 1120, eliminationsCount: 2, longestWinStreak: 0 }, ...extra };
};

test("results tracks count wins, opponents, runs, stakes and formats", () => {
  const ms = [match(1, ME, 2, day(0)), match(1, ME, 3, day(1), { stake: 12, gameType: "301" }), match(1, ME, 3, day(2), { stake: 20 }), match(1, 4, ME, day(3)), match(1, ME, 4, day(4))];
  const r = evaluateLeague(ctx(ms));
  assert.equal(r.metrics.wins, 4); assert.equal(r.metrics.matches, 5); assert.equal(r.metrics.distinctBeaten, 3);
  assert.equal(r.metrics.bestRun, 3); assert.equal(r.metrics.stakePointsWon, 42); assert.equal(r.metrics.stake10Wins, 2);
  assert.equal(r.metrics.formatsWon, 2); assert.equal(r.metrics.mostBeatenWins, 2); assert.equal(r.metrics.top3Finishes, 1);
  assert.ok(r.feats.allIn); assert.ok(r.feats.doubleOrQuits); assert.ok(r.feats.revenge, "beat 4 after losing to them");
  assert.ok(r.feats.giantKiller, "beat the season's table-topper");
  assert.equal(r.feats.bigNight, undefined);
});

test("track levels, metals and next target", () => {
  const ms = Array.from({ length: 12 }, (_, i) => match(1, ME, 2 + (i % 5), day(i % 20)));
  const state = evaluate(catalogueFor("LEAGUE"), evaluateLeague(ctx(ms))).find(s => s.key === "league-wins");
  assert.ok(state && state.kind === "TRACK");
  assert.equal(state.level, 3); assert.equal(state.metal, "SILVER"); assert.deepEqual(state.next?.target, 25);
  assert.equal(Math.round(state.progress * 100), Math.round((12 - 10) / 15 * 100));
  assert.equal(metalFor(8, 8), "DIAMOND"); assert.equal(metalFor(7, 8), "PLATINUM"); assert.equal(metalFor(1, 8), "BRONZE"); assert.equal(metalFor(0, 8), null);
  assert.deepEqual([1, 2, 3, 4].map(l => metalFor(l, 4)), ["BRONZE", "SILVER", "GOLD", "DIAMOND"]);
});

test("streaky feats: bounce back, big night, perfect week, nemesis, rivalry", () => {
  const ms = [
    match(1, 5, ME, day(0)), match(1, 5, ME, day(1)), match(1, 5, ME, day(2)), // three losses to 5 (nemesis builds)
    match(1, ME, 5, day(7, 18)), match(1, ME, 3, day(7, 19)), match(1, ME, 4, day(7, 20)), // bounce back, big night, nemesis
    match(1, ME, 2, day(8)), match(1, ME, 3, day(9)),
  ];
  const r = evaluateLeague(ctx(ms));
  assert.ok(r.feats.bounceBack); assert.ok(r.feats.bigNight); assert.ok(r.feats.nemesis); assert.ok(r.feats.perfectWeek, "5 wins, no losses in week 2");
  const rivalry = Array.from({ length: 10 }, (_, i) => match(1, i % 2 ? ME : 6, i % 2 ? 6 : ME, day(i)));
  assert.ok(evaluateLeague(ctx(rivalry)).feats.rivalry10);
});

test("season feats only count finished seasons; season goals per season", () => {
  const ms = [2, 3, 4, 5].flatMap(o => [match(1, ME, o, day(o)), match(1, ME, o, day(o + 5))]).concat([match(1, ME, 6, day(20)), match(1, ME, 2, day(21)), match(2, ME, 2, day(30))]);
  const r = evaluateLeague(ctx(ms));
  assert.ok(r.feats.unbeatenSeason, "10 matches, no losses, finished");
  assert.ok(r.feats.cleanSweep, "beat all 5 others");
  assert.equal(r.seasons.get(1)?.seasonWins, 10); assert.equal(r.seasons.get(1)?.seasonTopFive, 1); assert.equal(r.seasons.get(2)?.seasonTopFive, 0, "season 2 still running");
  const goals = evaluate(catalogueFor("LEAGUE"), r).find(s => s.key === "season-wins");
  assert.ok(goals && goals.kind === "SEASON"); assert.equal(goals.perSeason.find(p => p.seasonId === 1)?.completed, 2);
});

test("scoring tracks and feats use only scorer matches; live-only feats are never credited", () => {
  const sc = (w180: number, l180: number, att: number, hits: number) => ({ winnerDarts: 45, loserDarts: 42, winner180s: w180, loser180s: l180, winner100s: 3, winner140s: 1, winner170s: 0, winnerCheckoutAttempts: att, winnerCheckoutHits: hits });
  const ms = [match(1, ME, 2, day(0), sc(3, 2, 6, 3)), match(1, ME, 3, day(1)), ...Array.from({ length: 20 }, (_, i) => match(1, ME, 4, day(2 + (i % 10)), sc(0, 0, 5, 1)))];
  const r = evaluateLeague(ctx(ms));
  assert.equal(r.metrics.scorerMatches, 21); assert.equal(r.metrics.s180, 3); assert.equal(r.metrics.checkouts, 23);
  assert.ok(r.feats.three180s); assert.ok(r.feats.two180s); assert.ok(r.feats.iceCold); assert.ok(r.feats.answerBack);
  assert.equal(r.metrics.checkoutRate, 20, "the most recent 100 darts at a double: 20 hits from the last 20 matches");
  const brink = evaluate(catalogueFor("LEAGUE"), { ...r, feats: { ...r.feats, backFromBrink: day(1) } }).find(s => s.key === "back-from-the-brink");
  assert.ok(brink && brink.kind === "FEAT"); assert.equal(brink.earnedAt, null);
});

test("the fun ones: time of day, dates, debut, marathon night, double take and the full house", () => {
  const at = (iso: string) => new Date(iso);
  const ms = [
    match(1, ME, 2, at("2026-01-13T22:30:00Z")),   // debut win, Tuesday, after 10pm London (GMT)
    match(1, ME, 3, at("2026-02-13T10:00:00Z")),   // Friday 13th, before midday
    match(1, ME, 3, at("2026-02-13T11:00:00Z")),   // same player twice in a day
    match(1, 4, ME, at("2026-02-13T12:00:00Z")), match(1, ME, 4, at("2026-02-13T13:00:00Z")), match(1, ME, 5, at("2026-02-13T14:00:00Z")), // 6 that day
    match(1, ME, 5, at("2025-12-25T15:00:00Z")),   // Christmas Day
  ];
  const r = evaluateLeague(ctx(ms, { seasons: [{ id: 1, startDate: at("2025-12-01T00:00:00Z"), endDate: at("2026-02-28T00:00:00Z"), isActive: false, championId: 2 }] }));
  for (const k of ["nightOwl", "earlyDoors", "friday13", "doubleTake", "marathonNight", "festive", "fullHouse", "foundingMember"]) assert.ok(r.feats[k], k);
  assert.equal(r.feats.debutWin?.toISOString(), "2025-12-25T15:00:00.000Z", "the debut is the earliest match");
  assert.equal(r.feats.sevenDays, undefined);
  // 10pm in summer is 21:00 UTC (BST)
  assert.ok(evaluateLeague(ctx([match(1, ME, 2, at("2026-07-01T21:15:00Z"))])).feats.nightOwl);
  assert.equal(evaluateLeague(ctx([match(1, ME, 2, at("2026-01-01T21:15:00Z"))])).feats.nightOwl, undefined, "9:15pm in winter");
});

test("Untouchable and Ever-present count seasons in a row (and an eliminated season breaks Untouchable)", () => {
  const seasons = [1, 2, 3, 4].map(id => ({ id, startDate: new Date(Date.UTC(2026, id - 1, 1)), endDate: new Date(Date.UTC(2026, id - 1, 27)), isActive: false, championId: 9 }));
  const ms = [1, 2, 3, 4].map(id => match(id, ME, 2, new Date(Date.UTC(2026, id - 1, 10))));
  const standings = [{ seasonId: 1, points: 50 }, { seasonId: 2, points: 0 }, { seasonId: 3, points: 30 }, { seasonId: 4, points: 20 }].map(s => ({ ...s, playerId: ME, position: 2, wins: 1, losses: 0, isChampion: false }));
  const r = evaluateLeague(ctx(ms, { seasons, standings }));
  assert.equal(r.metrics.presentStreak, 4); assert.equal(r.metrics.survivedStreak, 2, "seasons 3 and 4, after being eliminated in 2");
  assert.ok(r.feats.foundingMember);
});

test("a season entered as a final table only (no match rows) still counts: founding member, seasons played, seasons in a row", () => {
  // Season 1 has no match rows at all, just the final table; ME is on it with games played.
  const ms = [match(2, ME, 3, day(30)), match(2, 4, ME, day(31))];
  const base = ctx(ms);
  const seasons = [
    { id: 1, startDate: day(0, 0), endDate: day(27, 23), isActive: false, championId: 2 },
    { id: 2, startDate: day(28, 0), endDate: day(55, 23), isActive: false, championId: 3 },
    // a Doubles event that started earlier must not count as "the league's first season"
    { id: 9, startDate: day(-40, 0), endDate: day(-10, 0), isActive: false, championId: null, leagueType: "doubles" },
  ];
  const r = evaluateLeague({ ...base, seasons });
  assert.ok(r.feats.foundingMember, "played season 1 per the final table");
  assert.equal(r.metrics.seasonsPlayed, 2);
  assert.equal(r.metrics.presentStreak, 2, "doubles season doesn't break the run");
  // someone not on season 1's table doesn't get it
  const other = evaluateLeague({ ...base, seasons, player: { id: 3, careerPeakElo: 1000, eliminationsCount: 0, longestWinStreak: 0 } });
  assert.equal(other.feats.foundingMember, undefined);
});

test("Nov 2026 additions: format wins, darts, 170s, dates and three-peat", () => {
  const d = (iso: string) => new Date(iso);
  const ms = [match(1, ME, 2, d("2026-01-25T19:00:00Z"), { gameType: "Cricket" }), match(1, ME, 2, d("2026-01-31T12:30:00Z"), { winnerDarts: 45, winner170s: 1 }),
    match(1, ME, 2, d("2026-02-01T20:00:00Z")), match(1, 3, ME, d("2026-02-14T20:00:00Z")), match(2, ME, 3, d("2026-11-30T20:00:00Z"))];
  const r = evaluateLeague(ctx(ms));
  assert.equal(r.metrics.cricketWins, 1); assert.equal(r.metrics.x01Wins, 3); assert.equal(r.metrics.leagueDarts, 45); assert.equal(r.metrics.s170plus, 1);
  assert.ok(r.feats.burnsNight); assert.ok(r.feats.stAndrews); assert.ok(r.feats.lunchBreak); assert.ok(r.feats.weekendWarrior, "Sat 31 Jan and Sun 1 Feb");
  assert.ok(r.feats.threePeat, "three straight wins over player 2"); assert.equal(r.feats.valentines, undefined, "lost on the 14th");
  assert.equal(r.seasons.get(1)?.seasonMatches, 4);
});
