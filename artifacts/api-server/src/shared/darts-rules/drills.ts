/**
 * Solo darts drills, shared by the web scorer and the Career server (stream formats). Like X01, a drill is fully described
 * by its spec and the darts thrown: visits, hits, busts and the result are all derived by replaying the darts.
 *
 *  - BOBS_27: start on 27, three darts at each double from D1 to D20 then the bull. Each hit adds the double's value; a
 *    visit with no hits takes it away. Drop to zero or below and you're out; survive all 21 rounds to win.
 *  - CHECKOUTS: a list of finishes, up to three visits at each (double out; a bust ends the visit and puts the score back).
 *    Hit at least half of them to win.
 *  - SCORING: so many visits of pure scoring; beat the target three-dart average to win.
 */
import { validateDart, isDouble, type Dart } from "./x01.ts";

export type DrillSpec =
  | { kind: "BOBS_27" }
  | { kind: "CHECKOUTS"; targets: number[]; visitsEach: number }
  | { kind: "SCORING"; visits: number; targetAverage: number };
export type DrillKind = DrillSpec["kind"];
export type DrillVisitNote = "HIT" | "MISS" | "OUT" | "CHECKOUT" | "BUST" | "FAILED" | "SCORE";
export type DrillVisit = { index: number; darts: Dart[]; points: number; note: DrillVisitNote; target: string };
export type DrillState = {
  spec: DrillSpec; visits: DrillVisit[]; complete: boolean; result: "WON" | "LOST" | null;
  /** Bob's 27: the running score. Checkouts: finishes hit. Scoring: total points. */
  score: number;
  /** What you're aiming at now (D7, 121, "Visit 12 of 33"), and how the current visit stands. */
  target: string; dartsInVisit: number; remaining: number | null;
  /** Checkouts: the attempt and visit now; Scoring: the average so far. */
  attempt: number; visitInAttempt: number; average: number;
};

const BOBS_ROUNDS = 21;
const bobsTarget = (round: number) => round <= 20 ? round : 25;
const bobsLabel = (round: number) => round <= 20 ? `D${round}` : "Bull";

export function validateDrill(spec: DrillSpec): DrillSpec {
  if (spec.kind === "CHECKOUTS" && (!spec.targets.length || spec.targets.some(t => !Number.isInteger(t) || t < 2 || t > 170) || spec.visitsEach < 1)) throw new Error("Invalid checkout drill");
  if (spec.kind === "SCORING" && (!Number.isInteger(spec.visits) || spec.visits < 1)) throw new Error("Invalid scoring drill");
  return spec;
}

/** Replay a drill from its darts. Throws on an invalid dart or a dart after the drill is over. */
export function replayDrill(spec: DrillSpec, input: readonly unknown[]): DrillState {
  validateDrill(spec);
  const darts = input.map((d, i) => { const v = validateDart(d); if (!v) throw new Error(`Invalid dart at ${i}`); return v; });
  const visits: DrillVisit[] = [];
  let i = 0;
  if (spec.kind === "BOBS_27") {
    let score = 27, round = 1, out = false;
    for (; i + 3 <= darts.length && round <= BOBS_ROUNDS && !out; round++) {
      const visit = darts.slice(i, i + 3), t = bobsTarget(round);
      const hits = visit.filter(d => d.segment === t && isDouble(d)).length;
      const points = hits ? hits * t * 2 : -t * 2;
      score += points; i += 3;
      out = score <= 0;
      visits.push({ index: visits.length, darts: visit, points, note: out ? "OUT" : hits ? "HIT" : "MISS", target: bobsLabel(round) });
    }
    if (i < darts.length && (out || round > BOBS_ROUNDS)) throw new Error("Darts after the drill was over");
    const complete = out || round > BOBS_ROUNDS;
    return { spec, visits, complete, result: complete ? (out ? "LOST" : "WON") : null, score, target: complete ? "" : bobsLabel(round),
      dartsInVisit: darts.length - i, remaining: null, attempt: round, visitInAttempt: 1, average: 0 };
  }
  if (spec.kind === "CHECKOUTS") {
    let attempt = 0, visitNo = 0, start = spec.targets[0], remaining = start, inVisit: Dart[] = [], hit = 0;
    const closeVisit = (note: DrillVisitNote, points: number) => {
      visits.push({ index: visits.length, darts: inVisit, points, note, target: String(spec.targets[attempt]) });
      inVisit = []; visitNo++;
      if (note === "CHECKOUT" || visitNo >= spec.visitsEach) { attempt++; visitNo = 0; remaining = spec.targets[attempt] ?? 0; }
    };
    for (; i < darts.length; i++) {
      if (attempt >= spec.targets.length) throw new Error("Darts after the drill was over");
      const d = darts[i];
      if (!inVisit.length) start = remaining;
      inVisit.push(d);
      const left = remaining - d.value;
      if (left === 0 && isDouble(d)) { hit++; remaining = 0; closeVisit("CHECKOUT", start); continue; }
      if (left < 2) { remaining = start; const last = visitNo + 1 >= spec.visitsEach; closeVisit(last ? "FAILED" : "BUST", 0); continue; }
      remaining = left;
      if (inVisit.length === 3) { const last = visitNo + 1 >= spec.visitsEach; closeVisit(last ? "FAILED" : "SCORE", start - remaining); }
    }
    const complete = attempt >= spec.targets.length;
    return { spec, visits, complete, result: complete ? (hit * 2 >= spec.targets.length ? "WON" : "LOST") : null, score: hit,
      target: complete ? "" : String(spec.targets[attempt]), dartsInVisit: inVisit.length, remaining: complete ? null : remaining,
      attempt: attempt + 1, visitInAttempt: visitNo + 1, average: 0 };
  }
  let total = 0;
  for (; i + 3 <= darts.length && visits.length < spec.visits; i += 3) {
    const visit = darts.slice(i, i + 3), points = visit.reduce((n, d) => n + d.value, 0);
    total += points; visits.push({ index: visits.length, darts: visit, points, note: "SCORE", target: `Visit ${visits.length + 1} of ${spec.visits}` });
  }
  if (i < darts.length && visits.length >= spec.visits) throw new Error("Darts after the drill was over");
  const complete = visits.length >= spec.visits, average = visits.length ? Math.round(total / visits.length * 100) / 100 : 0;
  return { spec, visits, complete, result: complete ? (average >= spec.targetAverage ? "WON" : "LOST") : null, score: total,
    target: complete ? "" : `Visit ${visits.length + 1} of ${spec.visits}`, dartsInVisit: darts.length - i, remaining: null,
    attempt: visits.length + 1, visitInAttempt: 1, average };
}
