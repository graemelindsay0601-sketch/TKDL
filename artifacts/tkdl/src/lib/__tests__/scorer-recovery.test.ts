import test from "node:test";
import assert from "node:assert/strict";
import { isScorerRecoveryState, recoveryMatchesEngine } from "../scorer-recovery.ts";

const miss = { segment: 0, multiplier: 1, value: 0, label: "Miss" };
const emptyStats = { darts: 0, score: 0, s100s: 0, s140s: 0, s170s: 0, s180s: 0, coAttempts: 0, coHits: 0, dartLog: [] };

test("accepts a complete X01 checkpoint and matches only its engine", () => {
  const checkpoint = {
    version: 2,
    starterIdx: 1,
    engine: "X01",
    state: {
      scores: [301, 241], legWins: [1, 0], setWins: [0, 0], legHistory: [0], started: [true, true],
      turn: 1, legStarter: 1, visitDarts: [miss], history: [], p1Stats: emptyStats, p2Stats: emptyStats,
    },
  };
  assert.equal(isScorerRecoveryState(checkpoint), true);
  if (!isScorerRecoveryState(checkpoint)) return;
  assert.equal(recoveryMatchesEngine(checkpoint, "X01"), true);
  assert.equal(recoveryMatchesEngine(checkpoint, "TeamX01"), false);
  // A6.5: a v1 X01 snapshot taken after a P2 bull-up win stored swapped seats; it is refused, never mis-assigned.
  assert.equal(isScorerRecoveryState({ ...checkpoint, version: 1 }), false);
  assert.equal(isScorerRecoveryState({ ...checkpoint, version: 1, starterIdx: 0 }), true);
});

test("accepts team Cricket state with a partial visit", () => {
  const checkpoint = {
    version: 1,
    starterIdx: 0,
    engine: "TeamCricket",
    state: {
      marks: [[3, 2, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0]],
      scores: [20, 0], teamTurn: 0, playerIdx: [1, 0], visitDarts: [miss], lastHit: "Miss",
    },
  };
  assert.equal(isScorerRecoveryState(checkpoint), true);
});

test("accepts Cricket and Team X01 checkpoints emitted by the league scorers", () => {
  const cricket = {
    version: 1, starterIdx: 0, engine: "Cricket",
    state: {
      marks: [[3, 2, 1, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]], scores: [20, 0], turn: 1,
      legWins: [0, 0], setWins: [0, 0], legHistory: [], legStarter: 0,
      visitDarts: [], lastHit: "", snapHistory: [],
    },
  };
  const teamX01 = {
    version: 1, starterIdx: 0, engine: "TeamX01",
    state: {
      scores: [381, 441], teamTurn: 1, playerIdx: [0, 1], visitDarts: [miss],
      history: [{ team: 0, player: 0, score: 120, left: 381 }],
    },
  };
  assert.equal(isScorerRecoveryState(cricket), true);
  assert.equal(isScorerRecoveryState(teamX01), true);
});

test("rejects corrupt, obsolete, and unsupported checkpoints", () => {
  assert.equal(isScorerRecoveryState(null), false);
  assert.equal(isScorerRecoveryState({ version: 0, starterIdx: 0, engine: "X01", state: {} }), false);
  assert.equal(isScorerRecoveryState({ version: 1, starterIdx: 2, engine: "X01", state: {} }), false);
  assert.equal(isScorerRecoveryState({ version: 1, starterIdx: 0, engine: "Killer", state: {} }), false);
  assert.equal(isScorerRecoveryState({
    version: 1, starterIdx: 0, engine: "TeamX01",
    state: { scores: [501], teamTurn: 0, playerIdx: [0, 0], visitDarts: [], history: [] },
  }), false);
  assert.equal(isScorerRecoveryState({
    version: 1, starterIdx: 0, engine: "TeamX01",
    state: {
      scores: [501, 401], teamTurn: 0, playerIdx: [0, 0], visitDarts: [],
      history: [{ team: 9, player: 0, score: 100, left: 401 }],
    },
  }), false);
  assert.equal(isScorerRecoveryState({
    version: 1, starterIdx: 0, engine: "Cricket",
    state: {
      marks: [[0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]], scores: [0, 0], turn: 0,
      legWins: [0, 0], setWins: [0, 0], legHistory: [], legStarter: 0,
      visitDarts: [], lastHit: "", snapHistory: [{ marks: [[0], [0]], scores: [0, 0], turn: 0 }],
    },
  }), false);
});
