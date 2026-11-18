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
