// The shadow coach: after a game against a shadow, where it was won or lost, leg by leg.
// Pure, works from the scorer's leg log (every visit of every leg, both players).
import type { LegLog } from "./stats-types.ts";

export type Side = { darts: number; scored: number; avg: number; dblAtt: number; dblHit: number };
export type CoachLeg = { leg: number; won: boolean; text: string; you: Side; them: Side };
export type CoachReport = { headline: string; legs: CoachLeg[]; you: Side; them: Side };

const finishable = (rem: number) => rem === 50 || (rem >= 2 && rem <= 40 && rem % 2 === 0);
const avg3 = (scored: number, darts: number) => darts ? Math.round((scored / darts) * 30) / 10 : 0;
const pct = (h: number, a: number) => a ? `${Math.round((h / a) * 100)}%` : "-";

export function sideOf(leg: LegLog, p: 0 | 1, doubleOut: boolean): Side {
  let darts = 0, dblAtt = 0, dblHit = 0, lastLeft = leg.start[p];
  for (const v of leg.visits) {
    if (v.p !== p) continue;
    darts += v.darts.length; lastLeft = v.left;
    let rem = v.left + v.score;
    // A typed visit total's darts are made up. Its checkout darts come from the game shot answers, so
    // they count; otherwise only count it if the visit started on a finish (all darts at that double).
    if (v.typed && v.left !== 0 && !finishable(rem)) continue;
    for (const val of v.darts) {
      if (doubleOut && finishable(rem)) { dblAtt++; if (rem - val === 0 && v.left === 0) dblHit++; }
      rem -= val;
    }
  }
  const scored = leg.start[p] - lastLeft;
  return { darts, scored, avg: avg3(scored, darts), dblAtt, dblHit };
}

const add = (a: Side, b: Side): Side => ({ darts: a.darts + b.darts, scored: a.scored + b.scored, avg: 0, dblAtt: a.dblAtt + b.dblAtt, dblHit: a.dblHit + b.dblHit });

export function coachReport(legs: LegLog[], doubleOut = true, shadow = "the shadow"): CoachReport | null {
  if (!legs.length) return null;
  let you: Side = { darts: 0, scored: 0, avg: 0, dblAtt: 0, dblHit: 0 }, them = { ...you };
  let lostOnDoubles = 0, lostOnScoring = 0;
  const out: CoachLeg[] = legs.map((leg, i) => {
    const y = sideOf(leg, 0, doubleOut), t = sideOf(leg, 1, doubleOut);
    you = add(you, y); them = add(them, t);
    const won = leg.winner === 0;
    const yourLeft = leg.start[0] - y.scored;
    let text: string;
    if (won) {
      text = `Won in ${y.darts} darts (${y.avg} avg)` + (doubleOut ? `, ${y.dblAtt} dart${y.dblAtt === 1 ? "" : "s"} at a double.` : ".");
    } else if (doubleOut && y.dblAtt >= 3) {
      lostOnDoubles++;
      text = `Lost on the doubles: ${y.dblAtt} darts at a double, ${y.dblHit ? "only " : ""}${y.dblHit} in. ${cap(shadow)} needed ${t.dblAtt}.`;
    } else if (doubleOut && y.dblAtt > 0) {
      lostOnDoubles++;
      text = `Lost it late: ${y.dblAtt} dart${y.dblAtt === 1 ? "" : "s"} at a double before ${shadow} finished.`;
    } else {
      lostOnScoring++;
      text = `Lost in the scoring: you were still on ${yourLeft} when ${shadow} finished (${y.avg} avg to ${t.avg}).`;
    }
    return { leg: i + 1, won, text, you: y, them: t };
  });
  you.avg = avg3(you.scored, you.darts); them.avg = avg3(them.scored, them.darts);
  const youWon = legs.filter(l => l.winner === 0).length > legs.length / 2;
  const dbl = `${you.dblHit}/${you.dblAtt} at a double (${pct(you.dblHit, you.dblAtt)})`;
  let headline: string;
  if (youWon) {
    headline = you.avg >= them.avg
      ? `You out-scored ${shadow}: ${you.avg} avg to ${them.avg}.`
      : `You won it on the doubles: ${dbl}, even though ${shadow} out-scored you.`;
  } else if (doubleOut && lostOnDoubles >= lostOnScoring && lostOnDoubles > 0) {
    headline = `You lost it on the doubles: ${dbl}. ${cap(shadow)} went ${them.dblHit}/${them.dblAtt}.`;
  } else {
    headline = `You lost it in the scoring: ${you.avg} avg to ${them.avg}.`;
  }
  return { headline, legs: out, you, them };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
