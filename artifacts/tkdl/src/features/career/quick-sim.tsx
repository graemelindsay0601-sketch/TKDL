import { useState } from "react";
import { Link } from "wouter";
import { FastForward, Flame, Loader2, Snowflake, TrendingUp } from "lucide-react";
import { useHumanForm, useQuickSim, errorMessage, type HumanForm, type QuickSimResult } from "./api";
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

/**
 * Quick-sim your waiting match: the simulator plays it at your level (your live average, form and confidence).
 * The result is final and counts like a played match, but never towards your live average.
 */
export function QuickSim({ saveId, eventId, matchId, nextHref, onDone, compact }: {
  saveId: string; eventId: string; matchId: string; nextHref?: (r: QuickSimResult) => string; onDone?: (r: QuickSimResult) => void; compact?: boolean;
}) {
  const form = useHumanForm(saveId).data;
  const sim = useQuickSim(saveId);
  const [result, setResult] = useState<QuickSimResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const run = async () => {
    setError(null); setConfirming(false);
    try { const r = await sim.mutateAsync({ eventId, matchId }); setResult(r); onDone?.(r); }
    catch (e) { setError(errorMessage(e)); }
  };
  if (result) {
    const q = result.quickSim, score = q.sets ? `${q.sets[0]}–${q.sets[1]} sets` : `${q.legs[0]}–${q.legs[1]}`;
    const href = nextHref?.(result) ?? (result.nextHumanMatchIds[0] ? `/career/${saveId}/matches/${result.nextHumanMatchIds[0]}/play` : `/career/${saveId}/tournaments/${eventId}`);
    return <div className={`career-quicksim-result ${q.won ? "is-win" : "is-loss"}`} role="status">
      <span>Quick-sim</span>
      <strong>{q.won ? "You won" : "You lost"} {score}</strong>
      <p>v {q.opponent} · your average {q.yourAverage.toFixed(1)} ({q.opponentAverage.toFixed(1)}){q.maximums ? ` · ${q.maximums}×180` : ""}{q.highestCheckout ? ` · best checkout ${q.highestCheckout}` : ""}</p>
      <Link className="career-btn career-btn-primary" href={href}>{result.nextHumanMatchIds.length ? "Next match" : "Continue"}</Link>
    </div>;
  }
  const level = form ? `${form.average === null ? "no average yet" : `${form.average.toFixed(1)} average`}, ${form.formLabel.toLowerCase()}` : "your level";
  return <div className={`career-quicksim ${compact ? "career-quicksim--compact" : ""}`}>
    {!confirming ? <button type="button" className="career-btn career-btn-ghost" disabled={sim.isPending} onClick={() => setConfirming(true)}>
      {sim.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <FastForward aria-hidden />} Quick-sim match</button>
      : <div className="career-quicksim__confirm" role="alertdialog" aria-label="Quick-sim this match">
        <p>The match is simulated at your level ({level}). The result is final and counts like a played match; it never counts towards your live average.</p>
        <div><button type="button" className="career-btn career-btn-primary" onClick={() => { void run(); }} autoFocus>Simulate it</button>
          <button type="button" className="career-btn career-btn-ghost" onClick={() => setConfirming(false)}>Cancel</button></div>
      </div>}
    {error && <p role="alert" className="career-quicksim__error">{error}</p>}
  </div>;
}
