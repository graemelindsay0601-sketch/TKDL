import { useState } from "react";
import { Flame, Snowflake, TrendingUp } from "lucide-react";
import { useHumanForm, type HumanForm } from "./api";
import "./quick-sim.css";

const tone = (f: HumanForm) => f.form >= 0.2 ? "hot" : f.form <= -0.2 ? "cold" : "steady";

/** Your form and confidence: a pill for headers, or a fuller card with your recent averages and results. */
export function FormBadge({ saveId, variant = "pill" }: { saveId: string; variant?: "pill" | "card" }) {
  const q = useHumanForm(saveId);
  const f = q.data;
  if (!f) return null;
  const Icon = tone(f) === "hot" ? Flame : tone(f) === "cold" ? Snowflake : TrendingUp;
  if (variant === "pill") return <span className={`career-form-pill career-form-pill--${tone(f)}`} title={`Confidence ${f.confidence} (${f.confidenceLabel})`}>
    <Icon aria-hidden /> {f.formLabel}<i>{f.confidence}</i></span>;
  return <section className={`career-form-card career-form-card--${tone(f)}`} aria-label="Form and confidence">
    <div className="career-form-card__head"><Icon aria-hidden /><div><span>Form</span><strong>{f.formLabel}</strong></div>
      <div><span>Confidence</span><strong>{f.confidence}<small> · {f.confidenceLabel}</small></strong></div>
      <div><span>Average</span><strong>{f.average === null ? "—" : f.average.toFixed(1)}{f.average === null && <small> {Math.min(f.averageDarts.thrown, f.averageDarts.needed)}/{f.averageDarts.needed} darts</small>}</strong></div></div>
    {f.recentResults.length > 0 && <p className="career-form-card__results" aria-label="Recent results">{f.recentResults.map((r, i) => <b key={i} className={r === "W" ? "is-win" : "is-loss"}>{r}</b>)}</p>}
    <p className="career-form-card__note">{f.average === null ? `Your average appears once you've thrown ${f.averageDarts.needed} darts in live Career matches. ` : `Recent live averages: ${f.recentAverages.slice(-5).map(a => a.toFixed(1)).join(" · ")}. `}
      {f.practice.sessions > 0 ? `${f.practice.sessions} practice session${f.practice.sessions === 1 ? "" : "s"} this week is keeping you sharp.` : "Practice this week sharpens your form."}</p>
  </section>;
}
