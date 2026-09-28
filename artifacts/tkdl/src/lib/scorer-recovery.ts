import type { Dart } from "./dartboard";
import type { DartThrow } from "./stats-types";

export type X01StatsAccumulator = {
  darts: number; score: number; s100s: number; s140s: number; s170s: number; s180s: number;
  coAttempts: number; coHits: number; dartLog: DartThrow[];
};

export type X01RecoveryState = {
  scores: [number, number]; legWins: [number, number]; setWins: [number, number];
  legHistory: (0 | 1)[]; started: [boolean, boolean]; turn: 0 | 1; legStarter: 0 | 1;
  visitDarts: Dart[];
  history: { turn: 0 | 1; score: number; left: number; darts: Dart[]; boardMarkNotes?: { icon: string; color: string; text: string }[] }[];
  p1Stats: X01StatsAccumulator; p2Stats: X01StatsAccumulator;
};

export type CricketMarks = [[number, number, number, number, number, number, number], [number, number, number, number, number, number, number]];
export type CricketUndoSnapshot = { marks: CricketMarks; scores: [number, number]; turn: 0 | 1; visitDarts: Dart[] };

export type CricketRecoveryState = {
  marks: CricketMarks; scores: [number, number]; turn: 0 | 1;
  legWins: [number, number]; setWins: [number, number]; legHistory: (0 | 1)[]; legStarter: 0 | 1;
  visitDarts: Dart[]; lastHit: string; snapHistory: CricketUndoSnapshot[];
};

export type TeamX01RecoveryState = {
  scores: [number, number]; teamTurn: 0 | 1; playerIdx: [number, number]; visitDarts: Dart[];
  history: { team: 0 | 1; player: number; score: number; left: number }[];
};

export type TeamCricketRecoveryState = {
  marks: CricketMarks; scores: [number, number]; teamTurn: 0 | 1;
  playerIdx: [number, number]; visitDarts: Dart[]; lastHit: string;
};

export type ScorerRecoveryState =
  | { version: 1; starterIdx: 0 | 1; engine: "X01"; state: X01RecoveryState }
  | { version: 1; starterIdx: 0 | 1; engine: "Cricket"; state: CricketRecoveryState }
  | { version: 1; starterIdx: 0 | 1; engine: "TeamX01"; state: TeamX01RecoveryState }
  | { version: 1; starterIdx: 0 | 1; engine: "TeamCricket"; state: TeamCricketRecoveryState };

const pair = (value: unknown): value is [unknown, unknown] => Array.isArray(value) && value.length === 2;
const numericPair = (value: unknown): value is [number, number] => pair(value) && value.every(Number.isFinite);
const indexPair = (value: unknown): value is [number, number] => pair(value)
  && value.every(item => Number.isInteger(item) && Number(item) >= 0);
const turn = (value: unknown): value is 0 | 1 => value === 0 || value === 1;
const darts = (value: unknown): value is Dart[] => Array.isArray(value) && value.every(item => {
  if (!item || typeof item !== "object") return false;
  const dart = item as Partial<Dart>;
  return Number.isFinite(dart.segment) && (dart.multiplier === 1 || dart.multiplier === 2 || dart.multiplier === 3)
    && Number.isFinite(dart.value) && typeof dart.label === "string";
});
const cricketMarks = (value: unknown): value is CricketMarks => pair(value)
  && value.every(side => Array.isArray(side) && side.length === 7 && side.every(Number.isFinite));
const stats = (value: unknown): value is X01StatsAccumulator => {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<X01StatsAccumulator>;
  return [item.darts, item.score, item.s100s, item.s140s, item.s170s, item.s180s, item.coAttempts, item.coHits].every(Number.isFinite)
    && Array.isArray(item.dartLog) && item.dartLog.every(entry => entry && typeof entry === "object"
      && Number.isFinite(entry.seg) && Number.isFinite(entry.mult) && Number.isFinite(entry.val)
      && (entry.phase === "scoring" || entry.phase === "checkout"));
};
const x01History = (value: unknown) => Array.isArray(value) && value.every(entry => entry && typeof entry === "object"
  && turn(entry.turn) && Number.isFinite(entry.score) && Number.isFinite(entry.left) && darts(entry.darts));
const teamX01History = (value: unknown) => Array.isArray(value) && value.every(entry => entry && typeof entry === "object"
  && turn(entry.team) && Number.isInteger(entry.player) && entry.player >= 0 && Number.isFinite(entry.score) && Number.isFinite(entry.left));
const cricketUndoHistory = (value: unknown) => Array.isArray(value) && value.every(entry => entry && typeof entry === "object"
  && cricketMarks(entry.marks) && numericPair(entry.scores) && turn(entry.turn) && darts(entry.visitDarts));

/** Rejects stale/corrupt browser storage before it can initialize a scorer. */
export function isScorerRecoveryState(value: unknown): value is ScorerRecoveryState {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as { version?: unknown; starterIdx?: unknown; engine?: unknown; state?: any };
  if (snapshot.version !== 1 || !turn(snapshot.starterIdx) || !snapshot.state || typeof snapshot.state !== "object") return false;
  const state = snapshot.state;
  if (snapshot.engine === "X01") {
    return numericPair(state.scores) && numericPair(state.legWins) && numericPair(state.setWins)
      && Array.isArray(state.legHistory) && state.legHistory.every(turn) && pair(state.started) && state.started.every((v: unknown) => typeof v === "boolean")
      && turn(state.turn) && turn(state.legStarter) && darts(state.visitDarts) && x01History(state.history)
      && stats(state.p1Stats) && stats(state.p2Stats);
  }
  if (snapshot.engine === "Cricket") {
    return cricketMarks(state.marks) && numericPair(state.scores) && turn(state.turn)
      && numericPair(state.legWins) && numericPair(state.setWins) && Array.isArray(state.legHistory) && state.legHistory.every(turn)
      && turn(state.legStarter) && darts(state.visitDarts) && typeof state.lastHit === "string" && cricketUndoHistory(state.snapHistory);
  }
  if (snapshot.engine === "TeamX01") {
    return numericPair(state.scores) && turn(state.teamTurn) && indexPair(state.playerIdx)
      && darts(state.visitDarts) && teamX01History(state.history);
  }
  if (snapshot.engine === "TeamCricket") {
    return cricketMarks(state.marks) && numericPair(state.scores) && turn(state.teamTurn)
      && indexPair(state.playerIdx) && darts(state.visitDarts) && typeof state.lastHit === "string";
  }
  return false;
}

export function recoveryMatchesEngine(snapshot: ScorerRecoveryState, engine: string): boolean {
  return snapshot.engine === engine;
}
