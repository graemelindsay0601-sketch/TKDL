import { useState } from "react";
import { Link } from "wouter";
import { Sparkles } from "lucide-react";
import { useHistory } from "./api";
import { formatPence } from "./model";
import type { CareerSave } from "./types";

const dismissedKey = (saveId: string) => `tkdl-career-welcome-${saveId}`;
const wasDismissed = (saveId: string) => { try { return localStorage.getItem(dismissedKey(saveId)) === "1"; } catch { return false; } };

/**
 * A brand-new Career's first screen: how a week works, in three steps. Shown until the first event result (or until
 * dismissed); everything it says is also in the Career Guide.
 */
export function CareerWelcome({ save }: { save: CareerSave }) {
  const history = useHistory(save.id, { participant: "HUMAN" });
  const [hidden, setHidden] = useState(() => wasDismissed(save.id));
  if (hidden || save.currentSeason !== 1 || !history.data || history.data.length > 0 || save.retiredAt) return null;
  const dismiss = () => { try { localStorage.setItem(dismissedKey(save.id), "1"); } catch { /* per-device convenience only */ } setHidden(true); };
  return <section className="career-welcome" aria-labelledby="career-welcome-title">
    <h3 id="career-welcome-title"><Sparkles aria-hidden /> Welcome to your Career</h3>
    <p>You start as an amateur at your local club with {formatPence(save.balancePence)}. A week goes like this:</p>
    <ol>
      <li><b>Pick an event below.</b> Start local and cheap: the best value is listed first, and anything where even a win loses money is last.</li>
      <li><b>Play on to your match.</b> Throw it on the scorer, or quick-sim it if you're short of time.</li>
      <li><b>Use your free nights.</b> Nights Out has your club, money matches, road trips, Pro-Am nights, a webcam league and DartCast.</li>
    </ol>
    <p>Results earn ranking points, prize money and fans; a Tour Card and the big stages come from there.</p>
    <div className="career-welcome__actions">
      <button type="button" className="career-btn career-btn-primary" onClick={dismiss}>Got it</button>
      <Link className="career-btn career-btn-ghost" href={`/career/${save.id}/guide`}>Career Guide</Link>
    </div>
  </section>;
}
