import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createMatch, throwDart, replay, validateDart, settledDartCount, starterFor, type Dart, type X01Format, type X01MatchState,
} from "../../shared/darts-rules/x01.ts";
import { resolveBullUp, botBullThrow } from "../../shared/darts-rules/bull-up.ts";
import { planBotX01Visit, perDartDoubleRate } from "../../shared/darts-rules/bot.ts";
import { seededRandom } from "../../shared/darts-rules/random.ts";

const S = (n: number): Dart => ({ segment: n, multiplier: 1, value: n });
const D = (n: number): Dart => n === 25 ? { segment: 25, multiplier: 2, value: 50 } : { segment: n, multiplier: 2, value: n * 2 };
const T = (n: number): Dart => ({ segment: n, multiplier: 3, value: n * 3 });
const BULL25: Dart = { segment: 25, multiplier: 1, value: 25 };
const MISS: Dart = { segment: 0, multiplier: 1, value: 0 };
const legs = (bestOfLegs: number, extra: Partial<X01Format> = {}): X01Format => ({ startingScore: 501, inRule: "STRAIGHT", outRule: "DOUBLE", unit: "LEGS", bestOfLegs, ...extra } as X01Format);
const sets = (bestOfSets: number, bestOfLegsPerSet: number, extra: Partial<X01Format> = {}): X01Format =>
  ({ startingScore: 501, inRule: "STRAIGHT", outRule: "DOUBLE", unit: "SETS", bestOfSets, bestOfLegsPerSet, ...extra } as X01Format);
const play = (s: X01MatchState, darts: Dart[]) => darts.reduce((acc, d) => throwDart(acc, d).state, s);
/** A 9-darter-ish leg for the thrower: 180, 180, then 141 (T20 T19 D12). Opponent visits in between are passed in. */
const legFor = (opp: Dart[][] = [[MISS, MISS, MISS], [MISS, MISS, MISS]]) => [T(20), T(20), T(20), ...opp[0], T(20), T(20), T(20), ...opp[1], T(20), T(19), D(12)];
const short301 = (f: Partial<X01Format> = {}) => legs(1, { startingScore: 301, ...f });

test("1 straight-in 501: first dart scores", () => {
  const s = play(createMatch(legs(1), 0), [S(20)]);
  assert.equal(s.scores[0], 481);
});

test("2/3 double-in: darts before opening do not score; opening double scores (S20 S20 D20 = 461)", () => {
  const f = legs(1, { inRule: "DOUBLE" });
  let s = play(createMatch(f, 0), [S(20), S(20)]);
  assert.equal(s.scores[0], 501); assert.equal(s.opened[0], false);
  s = throwDart(s, D(20)).state;
  assert.equal(s.scores[0], 461); assert.equal(s.opened[0], true);
  // after opening, later darts score normally (next visit)
  s = play(s, [MISS, MISS, MISS, T(20)]);
  assert.equal(s.scores[0], 401);
});

test("2b double-in: dart order matters — D20 then S20 S20 scores 80", () => {
  const s = play(createMatch(legs(1, { inRule: "DOUBLE" }), 0), [D(20), S(20), S(20)]);
  assert.equal(s.scores[0], 421);
});

test("4 double-in: inner bull opens and scores 50", () => {
  const s = play(createMatch(legs(1, { inRule: "DOUBLE" }), 0), [D(25)]);
  assert.equal(s.opened[0], true); assert.equal(s.scores[0], 451);
});

test("5 double-in: opening state is per player", () => {
  const s = play(createMatch(legs(1, { inRule: "DOUBLE" }), 0), [D(20), S(1), S(1), T(20), T(20), T(20)]);
  assert.deepEqual(s.opened, [true, false]);
  assert.deepEqual(s.scores, [459, 501]);
});

test("6 double-in: opening state resets at the next leg and next set", () => {
  const f = sets(3, 3, { inRule: "DOUBLE", startingScore: 101 });
  // P0 opens D20 (61 left), then 61 = T15 D8 (two visits needed since 3 darts used? D20,S1,MISS then T15,D8)
  let s = play(createMatch(f, 0), [D(20), S(1), MISS, MISS, MISS, MISS, T(15), D(4)]);
  assert.equal(s.totalLegs[0], 0, "60-61 path not a finish");
  s = createMatch(f, 0);
  s = play(s, [D(20), D(20), S(1), /*P1*/ MISS, MISS, MISS, /*P0*/ D(10)]); // 101-40-40-1=20 then D10
  assert.equal(s.legs[0], 1);
  assert.deepEqual(s.opened, [false, false], "both unopened for leg 2");
  // win the set (2 legs) -> set 2 starts with both unopened
  s = play(s, [/*P1 starts leg 2*/ MISS, MISS, MISS, D(20), D(20), S(1), MISS, MISS, MISS, D(10)]);
  assert.equal(s.sets[0], 1); assert.equal(s.setNo, 2); assert.deepEqual(s.opened, [false, false]);
});

test("7 double-out valid checkout and 14 checkout dart ends the leg immediately", () => {
  const f = short301();
  let s = play(createMatch(f, 0), [T(20), T(20), T(20), MISS, MISS, MISS, T(20), T(20)]); // 301-180=121, then 121-120=1? use different
  s = play(createMatch(legs(3, { startingScore: 40 }), 0), [D(20)]);
  assert.equal(s.legs[0], 1, "D20 from 40 wins on dart 1");
  assert.equal(s.turn, 1, "leg 2 is thrown first by the other player");
  assert.equal(s.visits.at(-1)!.darts.length, 1);
});

test("8 reaching zero without a double is a bust", () => {
  const s = play(createMatch(legs(1, { startingScore: 40 }), 0), [S(20), S(20)]);
  assert.equal(s.scores[0], 40); assert.equal(s.turn, 1); assert.equal(s.visits.at(-1)!.bust, true);
});

test("9 leaving 1 is a bust in double-out", () => {
  const s = play(createMatch(legs(1, { startingScore: 41 }), 0), [S(20), S(20)]);
  assert.equal(s.scores[0], 41); assert.equal(s.visits.at(-1)!.bust, true);
});

test("10 going below zero is a bust", () => {
  const s = play(createMatch(legs(1, { startingScore: 32 }), 0), [S(20), T(20)]);
  assert.equal(s.scores[0], 32);
});

test("11 inner bull finishes 50; 12 outer bull cannot finish double-out", () => {
  assert.equal(play(createMatch(legs(1, { startingScore: 50 }), 0), [D(25)]).complete, true);
  const s = play(createMatch(legs(1, { startingScore: 25 }), 0), [BULL25]);
  assert.equal(s.complete, false); assert.equal(s.scores[0], 25); assert.equal(s.visits.at(-1)!.bust, true);
});

test("13 bust restores the start-of-visit score and remaining darts do not score", () => {
  let s = play(createMatch(legs(1, { startingScore: 60 }), 0), [S(20), T(20)]);
  assert.equal(s.scores[0], 60); assert.equal(s.turn, 1, "visit ended at the bust dart");
  assert.equal(s.visits.at(-1)!.darts.length, 2);
  // double-in: opening inside a visit that busts reverts the opening too
  s = play(createMatch(legs(1, { startingScore: 50, inRule: "DOUBLE" }), 0), [D(20), T(20)]);
  assert.equal(s.scores[0], 50); assert.equal(s.opened[0], false);
});

test("straight-out finishes on any dart; master-out accepts trebles", () => {
  assert.equal(play(createMatch(legs(1, { startingScore: 20, outRule: "STRAIGHT" }), 0), [S(20)]).complete, true);
  assert.equal(play(createMatch(legs(1, { startingScore: 60, outRule: "MASTER" }), 0), [T(20)]).complete, true);
  assert.equal(play(createMatch(legs(1, { startingScore: 60, outRule: "DOUBLE" }), 0), [T(20)]).complete, false);
});

test("15 best-of legs completion: best of 5 = first to 3", () => {
  const f = legs(5, { startingScore: 40 });
  let s = createMatch(f, 0);
  s = play(s, [D(20), /*leg2 P1 starts*/ MISS, MISS, MISS, D(20), /*leg3 P0*/ D(20)]);
  assert.equal(s.complete, true); assert.equal(s.winner, 0); assert.deepEqual(s.legs, [3, 0]);
  assert.throws(() => throwDart(s, D(20)), /complete/);
});

test("16/17/18 set completion, multi-set completion, leg counters reset per set", () => {
  const f = sets(3, 3, { startingScore: 40 }); // first to 2 sets, each first to 2 legs
  let s = createMatch(f, 0);
  s = play(s, [D(20)]); assert.deepEqual(s.legs, [1, 0]);
  s = play(s, [MISS, MISS, MISS, D(20)]); // leg 2: P1 starts, P0 wins
  assert.deepEqual(s.sets, [1, 0]); assert.deepEqual(s.legs, [0, 0]); assert.equal(s.setNo, 2);
  assert.equal(s.turn, 1, "set 2 is started by the player who did not start set 1");
  s = play(s, [D(20)]); // P1 wins leg 1 of set 2
  s = play(s, [D(20)]); // P0 starts leg 2, wins
  s = play(s, [D(20)]); // leg 3: P1 starts, wins -> set to P1
  assert.deepEqual(s.sets, [1, 1]); assert.equal(s.setNo, 3);
  assert.equal(s.turn, 0, "set 3 started by set-1 starter");
  s = play(s, [D(20), D(20)]); // set 3: P0 leg1, P1 starts leg2 & wins? P1 throws D20
  assert.deepEqual(s.legs, [1, 1]);
  s = play(s, [D(20)]); // leg 3 of set 3 started by P0
  assert.equal(s.complete, true); assert.equal(s.winner, 0); assert.deepEqual(s.sets, [2, 1]); assert.deepEqual(s.totalLegs, [5, 3]);
});

test("set starter alternates by set even when a set ends after an even number of legs", () => {
  const f = sets(5, 5, { startingScore: 40 });
  // set 1: P0 starts; legs: P0 wins L1, P1 wins L2, P0 wins L3, P1 wins L4, P0 wins L5 -> 5 legs
  let s = createMatch(f, 0);
  s = play(s, [D(20), D(20), D(20), D(20), D(20)]);
  assert.equal(s.sets[0], 1); assert.equal(s.turn, 1);
  // set 2: P1 starts; P1 wins legs 1..3 (needs P1 starting then P0 starting leg 2)
  s = play(s, [D(20), MISS, MISS, MISS, D(20), D(20)]);
  assert.deepEqual(s.sets, [1, 1], "set 2 to P1 after 3 legs");
  assert.equal(s.turn, 0, "set 3 started by P0 (set starters alternate)");
  // set 4 after an even-length set 3
  s = play(s, [D(20), D(20), D(20), D(20), D(20)]); // P0 L1, P1 L2, P0 L3, P1 L4, P0 L5 -> P0 wins set 3 3-2
  assert.equal(s.turn, 1, "set 4 started by P1");
  assert.deepEqual(starterFor(f, 0, 4, 1), { setStarter: 1, legStarter: 1 });
  assert.deepEqual(starterFor(f, 0, 4, 2), { setStarter: 1, legStarter: 0 });
});

test("19 starter alternates each leg in legs play", () => {
  let s = createMatch(legs(7, { startingScore: 40 }), 1);
  const starters: number[] = [];
  for (let i = 0; i < 4; i++) { starters.push(s.turn); s = throwDart(s, D(20)).state; }
  assert.deepEqual(starters, [1, 0, 1, 0]);
});

test("20/21 bull-up: winner starts; tied ring re-throws in reverse order; misses re-throw", () => {
  let b = resolveBullUp(0, ["OUTER", "INNER"]);
  assert.equal(b.winner, 1);
  b = resolveBullUp(0, ["OUTER", "OUTER"]);
  assert.equal(b.winner, null); assert.equal(b.nextThrower, 1, "re-throw is taken in reverse order");
  b = resolveBullUp(0, ["OUTER", "OUTER", "INNER", "MISS"]);
  assert.equal(b.winner, 1, "player 1 threw first in round 2 and won it");
  assert.deepEqual(b.rounds.map(r => r.order), [[0, 1], [1, 0]]);
  b = resolveBullUp(0, ["MISS", "MISS", "MISS", "MISS", "INNER", "OUTER"]);
  assert.equal(b.winner, 0); assert.deepEqual(b.rounds.map(r => r.order), [[0, 1], [1, 0], [0, 1]]);
  assert.throws(() => resolveBullUp(0, ["INNER", "MISS", "MISS"]), /decided/);
});

test("bot bull throws come from ability, not a coin flip", () => {
  const count = (acc: number) => { const r = seededRandom("bull", acc); let inner = 0; for (let i = 0; i < 4000; i++) if (botBullThrow(acc, r) === "INNER") inner++; return inner / 4000; };
  assert.ok(count(0.9) > count(0.2) + 0.12);
});

test("22 bot double-in: bot obeys opening and its plan is legal when replayed", () => {
  const f = legs(1, { inRule: "DOUBLE" });
  const cfg = { avg: 80, sd: 10, checkoutPct: 0.5, hitAcc: 0.6 };
  const rng = seededRandom("bot-di");
  let opens = 0;
  for (let i = 0; i < 300; i++) {
    const plan = planBotX01Visit(501, cfg, { doubleOut: true, opened: false, rng });
    let s = createMatch(f, 1);
    s = play(s, plan);
    if (s.opened[1]) { opens++; const first = plan.findIndex(d => d.multiplier === 2); assert.equal(s.scores[1], 501 - plan.slice(first).reduce((a, d) => a + d.value, 0)); }
    else assert.equal(s.scores[1], 501, "unopened bot scores nothing");
  }
  const expected = 1 - Math.pow(1 - perDartDoubleRate(cfg), 3);
  assert.ok(Math.abs(opens / 300 - expected) < 0.1, `open rate ${opens / 300} vs ${expected}`);
});

test("23 bot checkout plans never bust or finish illegally", () => {
  const rng = seededRandom("bot-co");
  const cfg = { avg: 95, sd: 7, checkoutPct: 0.7, hitAcc: 0.8 };
  for (let remaining = 2; remaining <= 501; remaining += 1) {
    const plan = planBotX01Visit(remaining, cfg, { doubleOut: true, rng });
    let left = remaining;
    for (const d of plan) {
      assert.ok(validateDart(d), `invalid dart ${JSON.stringify(d)}`);
      const next = left - d.value;
      if (next === 0) { assert.equal(d.multiplier, 2, `illegal finish from ${remaining}`); break; }
      assert.ok(next >= 2, `plan from ${remaining} leaves ${next}`);
      left = next;
    }
  }
});

test("bot plans are reproducible from the same seed (server regeneration)", () => {
  const cfg = { avg: 60, sd: 12, checkoutPct: 0.3, hitAcc: 0.45 };
  const a = planBotX01Visit(301, cfg, { doubleOut: true, rng: seededRandom("s", "bot", 4) });
  const b = planBotX01Visit(301, cfg, { doubleOut: true, rng: seededRandom("s", "bot", 4) });
  assert.deepEqual(a, b);
});

test("24/25/26 recovery: replaying a dart log reproduces mid-leg, between-leg and mid-set state exactly", () => {
  const f = sets(3, 3, { inRule: "DOUBLE" });
  const log: Dart[] = [D(20), T(20), T(20), MISS, S(5), D(1), T(20), T(20), T(20), S(19), S(7), MISS];
  let live = createMatch(f, 1);
  for (const d of log) live = throwDart(live, d).state;
  assert.deepEqual(replay(f, 1, log), live);
  // between legs (a whole leg played)
  const f2 = legs(3, { startingScore: 40 });
  const log2 = [S(20), S(10), D(5)];
  const mid = replay(f2, 0, log2);
  assert.equal(mid.legNo, 2); assert.deepEqual(mid.scores, [40, 40]); assert.equal(mid.turn, 1);
});

test("27/28 undo is a replay of a shorter log, including across an opening double and a bust", () => {
  const f = legs(1, { inRule: "DOUBLE", startingScore: 101 });
  const log = [D(20), T(20), MISS];
  const s = replay(f, 0, log);
  assert.equal(s.scores[0], 101, "bust (101-40-60=1)");
  const undone = replay(f, 0, log.slice(0, -2));
  assert.equal(undone.scores[0], 61); assert.equal(undone.opened[0], true); assert.equal(undone.turn, 0);
  const beforeOpen = replay(f, 0, []);
  assert.equal(beforeOpen.opened[0], false);
});

test("29 completion happens exactly once; settled darts mark completed legs", () => {
  const f = legs(3, { startingScore: 40 });
  let s = createMatch(f, 0);
  const outcomes: string[] = [];
  for (const d of [D(20), D(20), MISS, MISS, MISS, D(20)]) { const r = throwDart(s, d); outcomes.push(r.outcome); s = r.state; if (s.complete) break; }
  assert.equal(outcomes.filter(o => o === "MATCH_WON").length, 1);
  const partial = replay(f, 0, [D(20), S(10)]);
  assert.equal(settledDartCount(partial), 1);
});

test("30 winner mapping when player 1 won the bull-up", () => {
  const f = legs(3, { startingScore: 40 });
  const s = replay(f, 1, [D(20), MISS, MISS, MISS, D(20)]);
  assert.equal(s.winner, 1);
  assert.equal(s.legsLog[0].starter, 1);
});

test("validateDart rejects impossible darts", () => {
  for (const bad of [{ segment: 21, multiplier: 1, value: 21 }, { segment: 20, multiplier: 3, value: 61 }, { segment: 25, multiplier: 3, value: 75 }, { segment: 0, multiplier: 2, value: 0 }, null, "T20"]) {
    assert.equal(validateDart(bad), null);
  }
  assert.throws(() => replay(legs(1), 0, [{ segment: 20, multiplier: 3, value: 600 }]), /Dart 1/);
});
