import { test } from "node:test";
import assert from "node:assert/strict";
import { careerBotVisit, careerGameType, recoveryFromLog, scorerLength, scoreLine, shouldCheckpoint, nextBotVisitIndex } from "../../features/career/live-model.ts";
import { replay, planBotX01Visit, seededRandom, type Dart, type X01Format } from "../darts-rules.ts";
import { isScorerRecoveryState } from "../scorer-recovery.ts";
import { ageOnDate, MATCH_PLAY_STATUS, isJuniorEvent, ageReason } from "../../features/career/model.ts";

const d = (segment: number, multiplier: 1 | 2 | 3 = 1): Dart => ({ segment, multiplier, value: segment * multiplier });
const LEGS: X01Format = { startingScore: 501, inRule: "STRAIGHT", outRule: "DOUBLE", unit: "LEGS", bestOfLegs: 3 } as X01Format;
const DIDO_SETS = { startingScore: 501, inRule: "DOUBLE", outRule: "DOUBLE", unit: "SETS", bestOfSets: 3, bestOfLegsPerSet: 3 } as X01Format;

test("GameScorer mapping: X01 config, best-of lengths pass straight through", () => {
  const gt = careerGameType(DIDO_SETS as never);
  assert.equal(gt.engine, "X01");
  assert.deepEqual(JSON.parse(gt.config), { startingScore: 501, doubleIn: true, doubleOut: true });
  assert.deepEqual(scorerLength(LEGS as never), { legs: 3 });
  assert.deepEqual(scorerLength(DIDO_SETS as never), { setsToWin: 3, legsToWinSet: 3 });
  assert.equal(MATCH_PLAY_STATUS.connected, true);
});

test("recovery is rebuilt from the server dart log with the shared rules (resume after refresh)", () => {
  const darts = [d(20, 3), d(20, 3), d(20, 3), d(19, 3), d(19, 3), d(19, 3), d(20, 3)];
  const r = recoveryFromLog(LEGS, 0, darts);
  assert.ok(isScorerRecoveryState(r));
  assert.equal(r.version, 2);
  const st = r.state as { scores: number[]; turn: number; history: unknown[]; dartLog: Dart[]; visitDarts: Dart[] };
  assert.equal(st.history.length, 2);
  assert.equal(st.turn, 0);
  assert.equal(st.scores[0], 321, "mid-visit: start-of-visit score, in-progress darts re-added by the scorer");
  assert.equal(st.visitDarts.length, 1);
  assert.equal(st.dartLog.length, 7);
  assert.ok(st.dartLog.every(x => typeof x.label === "string"));
});

test("double-in: darts before the opening double display as 0 in history", () => {
  const r = recoveryFromLog(DIDO_SETS, 0, [d(20, 3), d(20, 2), d(20)]);
  const h = (r.state as { history: { darts: Dart[]; score: number }[] }).history[0];
  assert.deepEqual(h.darts.map(x => x.value), [0, 40, 20]);
  assert.equal(h.score, 60);
});

test("checkpoints after human darts and closed visits only; bot visit is seeded exactly like the server verifier", () => {
  assert.equal(shouldCheckpoint(LEGS, 0, [d(20)]), true, "human mid-visit darts are checkpointed (refresh-safe)");
  assert.equal(shouldCheckpoint(LEGS, 1, [d(20)]), false, "never mid bot visit");
  assert.equal(shouldCheckpoint(LEGS, 0, [d(20), d(20), d(20)]), true);
  const session = { bot: { seed: "abc123", config: { avg: 70, checkoutPct: 30 } as never }, format: LEGS as never };
  const log = [d(20), d(20), d(20)];
  const idx = nextBotVisitIndex(LEGS, 0, log);
  assert.equal(idx, 0);
  const remaining = replay(LEGS, 0, log).scores[1];
  const ours = careerBotVisit(session, 0, log, { remaining, opened: true });
  const server = planBotX01Visit(remaining, session.bot.config, { doubleOut: true, opened: true, rng: seededRandom("abc123", "bot-visit", 0) });
  assert.deepEqual(ours.map(x => [x.segment, x.multiplier, x.value]), server.map(x => [x.segment, x.multiplier, x.value]));
});

test("score line and age helpers", () => {
  assert.equal(scoreLine({ format: LEGS as never, result: { legs: [2, 1] } as never }), "2–1");
  assert.equal(scoreLine({ format: DIDO_SETS as never, result: { legs: [7, 5], sets: [2, 1] } as never }), "2–1 sets (7–5 legs)");
  assert.equal(ageOnDate("2010-03-20", "2026-01-01"), 15);
  assert.equal(ageOnDate("2010-03-20", "2026-03-20"), 16);
  assert.equal(isJuniorEvent({ family: "junior-development-circuit", human: null }), true);
  const below = { human: { eligibilityReasons: ["BELOW_MINIMUM_AGE"], denials: [], age: { minAge: 16, maxAgeExclusive: null, eligibleFrom: { season: 2, week: 12, date: "2026-03-20" } } } };
  assert.match(ageReason(below as never)!, /Minimum age 16 · eligible from Season 2, wk 12/);
});
