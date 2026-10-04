/**
 * A6.5 Career live-match glue (pure, no React): maps a server session onto the
 * existing GameScorer/X01Scorer props and rebuilds scorer recovery state from the
 * server's dart log with the SAME shared rules the server uses. The browser holds
 * no authoritative state: reload = replay the server log.
 */
import { replay, opensLeg, planBotX01Visit, seededRandom, type X01Format, type X01MatchState, type Dart } from "../../lib/darts-rules.ts";
import type { X01RecoveryState, ScorerRecoveryState } from "@/lib/scorer-recovery";
import type { Dart as UiDart } from "@/lib/dartboard";
import type { LiveSession } from "./types";

export type CareerGameType = { id: number; key: string; name: string; engine: string; category: string; description: string; config: string; enabled: boolean };

/** X01 game definition for GameScorer from the session's authored format. */
export function careerGameType(format: LiveSession["format"]): CareerGameType {
  return {
    id: -1, key: "career_x01", engine: "X01", category: "x01", enabled: true,
    name: `${format.startingScore} ${format.inRule === "DOUBLE" ? "Double In " : ""}Double Out`,
    description: "Career match — scored with the TKDL X01 scorer",
    config: JSON.stringify({ startingScore: format.startingScore, doubleIn: format.inRule === "DOUBLE", doubleOut: format.outRule === "DOUBLE" }),
  };
}

/**
 * GameScorer's `setsToWin`/`legsToWinSet` are BEST-OF values (it computes
 * ceil(n/2) internally). A3 authors best-of too, so they pass straight through.
 */
export function scorerLength(format: LiveSession["format"]): { legs?: number; setsToWin?: number; legsToWinSet?: number } {
  return format.unit === "SETS" ? { setsToWin: format.bestOfSets, legsToWinSet: format.bestOfLegsPerSet } : { legs: format.bestOfLegs };
}

/** Shared-rules dart → scorer UI dart (label always present). */
export const toUiDart = (d: Dart): UiDart => ({ segment: d.segment, multiplier: d.multiplier, value: d.value, label: d.label ?? (d.segment === 0 ? "Miss" : d.segment === 25 ? (d.multiplier === 2 ? "DB" : "Bull") : `${d.multiplier === 3 ? "T" : d.multiplier === 2 ? "D" : ""}${d.segment}`) });

/** Display darts for a visit: darts thrown before the opening double count 0, as the scorer shows them. */
function displayDarts(darts: Dart[], startOpened: boolean, inRule: X01Format["inRule"]): UiDart[] {
  let open = startOpened;
  return darts.map(d => {
    if (!open && !opensLeg(d, inRule)) return { ...toUiDart(d), value: 0 };
    open = true;
    return toUiDart(d);
  });
}

const emptyStats = () => ({ darts: 0, score: 0, s100s: 0, s140s: 0, s170s: 0, s180s: 0, coAttempts: 0, coHits: 0, dartLog: [] });

/** Scorer recovery snapshot equivalent to replaying `darts` (players never swapped: 0 = you, 1 = opponent). */
export function recoveryFromLog(format: X01Format, firstThrower: 0 | 1, darts: Dart[]): ScorerRecoveryState {
  const s: X01MatchState = replay(format, firstThrower, darts);
  const visit = s.visit;
  const state: X01RecoveryState = {
    scores: [...s.scores] as [number, number], legWins: [...s.legs] as [number, number], setWins: [...s.sets] as [number, number],
    legHistory: s.legsLog.map(l => l.winner), started: [...s.opened] as [boolean, boolean], turn: s.turn, legStarter: s.legStarter,
    visitDarts: visit ? displayDarts(visit.darts, visit.startOpened, format.inRule) : [],
    history: s.visits.map(v => ({ turn: v.thrower as 0 | 1, score: v.points, left: v.endScore, darts: displayDarts(v.darts, v.startOpened, format.inRule), leg: v.legNo, openedBefore: v.startOpened })),
    p1Stats: emptyStats(), p2Stats: emptyStats(),
    legNo: s.legNo, legInSet: s.legInSet, dartLog: darts.map(toUiDart),
  };
  // Mid-visit restore (normally logs are checkpointed at visit boundaries): the scorer keeps the
  // start-of-visit score and re-adds the in-progress darts itself; opening state stays as replayed.
  if (visit) state.scores[visit.thrower] = visit.startScore;
  return { version: 2, starterIdx: firstThrower, engine: "X01", state };
}

/** Index of the bot's next visit in this match (server regenerates the same visit from it). */
export const nextBotVisitIndex = (format: X01Format, firstThrower: 0 | 1, darts: Dart[]) =>
  replay(format, firstThrower, darts).visits.filter(v => v.thrower === 1).length;

/** Seeded bot visit identical to the server's verifier. */
export function careerBotVisit(session: Pick<LiveSession, "bot" | "format">, firstThrower: 0 | 1, darts: Dart[], ctx: { remaining: number; opened: boolean }): UiDart[] {
  return planBotX01Visit(ctx.remaining, session.bot.config, { doubleOut: session.format.outRule === "DOUBLE", opened: ctx.opened,
    rng: seededRandom(session.bot.seed, "bot-visit", nextBotVisitIndex(session.format as X01Format, firstThrower, darts)) }).map(toUiDart);
}

/**
 * Checkpoint after every HUMAN dart (so a refresh mid-visit loses nothing) and when a
 * visit closes; never in the middle of a BOT visit — the server regenerates and
 * verifies bot visits whole. Darts of the unfinished leg stay editable (undo);
 * completed legs are immutable server-side.
 */
export function shouldCheckpoint(format: X01Format, firstThrower: 0 | 1, darts: Dart[]): boolean {
  try { const s = replay(format, firstThrower, darts); return s.complete || s.visit === null || s.visit.thrower === 0; } catch { return false; }
}

export function scoreLine(session: Pick<LiveSession, "format" | "result">): string {
  const r = session.result;
  if (!r) return "";
  return session.format.unit === "SETS" && r.sets ? `${r.sets[0]}–${r.sets[1]} sets (${r.legs[0]}–${r.legs[1]} legs)` : `${r.legs[0]}–${r.legs[1]}`;
}
