import { useState } from "react";
import { Link } from "wouter";
import { Check, Sparkles } from "lucide-react";
import { useFinance, useHistory } from "./api";
import { formatPence } from "./model";
import type { CareerSave } from "./types";

const dismissedKey = (saveId: string) => `tkdl-career-welcome-${saveId}`;
const visitedKey = (saveId: string, place: string) => `tkdl-career-visited-${place}-${saveId}`;
const read = (key: string) => { try { return localStorage.getItem(key) === "1"; } catch { return false; } };
/** Remember (on this device) that a player has opened a page the first-season checklist points to. */
export function markVisited(saveId: string, place: "nights" | "road") { try { localStorage.setItem(visitedKey(saveId, place), "1"); } catch { /* convenience only */ } }

type Step = { key: string; title: string; text: string; done: boolean; href?: string; action?: string };

/**
 * Your first season, one step at a time: a short checklist at the top of Play that ticks itself off from what you've
 * actually done (entries, results, weeks played, prize money, pages opened). Shown in season 1 until every step is done
 * or you hide it; everything it says is also in the Career Guide.
 */
export function CareerWelcome({ save, entered }: { save: CareerSave; entered: boolean }) {
  const history = useHistory(save.id, { participant: "HUMAN" });
  const finance = useFinance(save.id);
  const [hidden, setHidden] = useState(() => read(dismissedKey(save.id)));
  if (hidden || save.currentSeason !== 1 || save.retiredAt || !history.data) return null;
  const base = `/career/${save.id}`;
  const played = history.data.length > 0;
  const steps: Step[] = [
    { key: "enter", title: "Pick your first event", text: "Choose one below and enter it. Local events near home are cheap and a good place to start.", done: entered || played },
    { key: "play", title: "Play your first event", text: "Press Continue to move to your match, then throw it on the scorer or quick-sim it.", done: played },
    { key: "week", title: "Finish your first week", text: "Continue moves the calendar on. Results, rankings and money update as you go.", done: save.currentWeek > 1 },
    { key: "money", title: "Win some prize money", text: "Even a quarter-final at a club night pays something. Your balance is at the top.", done: (finance.data?.careerEarningsPence ?? 0) > 0 },
    { key: "nights", title: "Try a night out", text: "Free weeknights can go on your club, money matches and more.", done: read(visitedKey(save.id, "nights")), href: `${base}/nights`, action: "Nights Out" },
    { key: "road", title: "See your routes to a Tour Card", text: "When you're ready to aim higher, this shows every way in.", done: read(visitedKey(save.id, "road")), href: `${base}/road-to-the-tour`, action: "Road to the Tour" },
  ];
  const done = steps.filter(s => s.done).length;
  const next = steps.find(s => !s.done);
  const hide = () => { try { localStorage.setItem(dismissedKey(save.id), "1"); } catch { /* per-device convenience only */ } setHidden(true); };
  return <section className="career-welcome" aria-labelledby="career-welcome-title">
    <h3 id="career-welcome-title"><Sparkles aria-hidden /> {next ? "Your first season" : "You're up and running"}<span className="career-welcome__count">{done} of {steps.length}</span></h3>
    {done === 0 && <p>You start as an amateur at your local club with {formatPence(save.balancePence)}. Here's how to get going.</p>}
    <ol className="career-welcome__steps">
      {steps.map(s => <li key={s.key} data-done={s.done || undefined} data-next={s === next || undefined}>
        <span className="career-welcome__tick" aria-hidden>{s.done ? <Check /> : null}</span>
        <span><b>{s.title}</b>{s === next && <small>{s.text}</small>}</span>
        {s === next && s.href && <Link className="career-btn career-btn-primary career-welcome__go" href={s.href}>{s.action}</Link>}
        <span className="sr-only">{s.done ? "done" : "to do"}</span>
      </li>)}
    </ol>
    <div className="career-welcome__actions">
      <button type="button" className="career-btn career-btn-ghost" onClick={hide}>{next ? "Hide this" : "Done"}</button>
      <Link className="career-btn career-btn-ghost" href={`${base}/guide`}>Career Guide</Link>
    </div>
  </section>;
}
