// After a game against a shadow: where it was won or lost, leg by leg.
import { GraduationCap } from "lucide-react";
import { coachReport } from "@/lib/shadow-coach";
import type { LegLog } from "@/lib/stats-types";
import "./shadow-cup.css";

export function ShadowCoach({ legs, shadow, doubleOut }: { legs: LegLog[]; shadow: string; doubleOut: boolean }) {
  const r = coachReport(legs, doubleOut, shadow);
  if (!r) return null;
  const pct = (h: number, a: number) => (a ? `${Math.round((h / a) * 100)}%` : "-");
  return (
    <div className="sc-card text-left">
      <div className="sc-top"><span className="sc-tag"><GraduationCap size={13} /> Shadow coach</span><span className="sc-dim">vs {shadow}</span></div>
      <p className="sc-coach-head">{r.headline}</p>
      <div className="sc-coach-grid">
        <span />
        <b>You</b><b>{shadow.replace(/^(Shadow|Legend) /, "")}</b>
        <span className="sc-dim">Average</span><span>{r.you.avg}</span><span>{r.them.avg}</span>
        {doubleOut && <>
          <span className="sc-dim">At a double</span><span>{r.you.dblHit}/{r.you.dblAtt} <small>{pct(r.you.dblHit, r.you.dblAtt)}</small></span>
          <span>{r.them.dblHit}/{r.them.dblAtt} <small>{pct(r.them.dblHit, r.them.dblAtt)}</small></span>
        </>}
        <span className="sc-dim">Darts thrown</span><span>{r.you.darts}</span><span>{r.them.darts}</span>
      </div>
      <div className="sc-coach-legs">
        {r.legs.map(l => (
          <div key={l.leg} className={`sc-coach-leg ${l.won ? "w" : "l"}`}>
            <span className="sc-coach-n">Leg {l.leg}</span>
            <span>{l.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
