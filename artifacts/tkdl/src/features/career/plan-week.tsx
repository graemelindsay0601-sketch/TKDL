import { useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { useEnterEvents, errorMessage } from "./api";
import type { CareerEvent } from "./types";
import { dayLabel, denialLabel, formatPence, planWeek, worthIt } from "./model";

/**
 * "Plan my week": one tap suggests the worth-it events for the week shown in the planner, within your free money and around
 * what you have booked. You untick anything you do not want; nothing is entered until you press Enter.
 */
export function PlanMyWeek({ saveId, events, week }: { saveId: string; events: CareerEvent[]; week: number }) {
  const [open, setOpen] = useState(false);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const enter = useEnterEvents(saveId);
  const plan = useMemo(() => planWeek(events, week), [events, week]);
  const chosen = plan.events.filter(e => !off.has(e.id));
  const cost = chosen.reduce((n, e) => n + e.finance!.estimatedPlayerCostPence, 0);
  const upTo = chosen.reduce((n, e) => n + e.finance!.topPrizePence, 0);

  const start = () => { setOff(new Set()); setMessage(""); setOpen(true); };
  const confirm = () => enter.mutate(chosen.map(e => e.id), {
    onSuccess: results => {
      const done = results.filter(r => r.result?.entered).length;
      const failed = results.filter(r => !r.result?.entered).map(r => {
        const name = chosen.find(e => e.id === r.eventId)?.name ?? "An event";
        return `${name}: ${r.error ? errorMessage(r.error) : r.result!.denials.map(denialLabel).join(", ")}`;
      });
      setMessage([done ? `Entered ${done} event${done === 1 ? "" : "s"} for week ${week}.` : "", ...failed].filter(Boolean).join(" "));
      setOpen(false);
    },
    onError: error => setMessage(errorMessage(error)),
  });

  if (!open) return <div className="plan-week">
    <button type="button" className="career-btn career-btn-ghost plan-week__start" onClick={start}><Sparkles aria-hidden /> Plan my week</button>
    {message && <p className="plan-week__message" role="status">{message}</p>}
  </div>;

  return (
    <div className="plan-week plan-week--open" aria-label={`Suggested plan for week ${week}`}>
      <p className="plan-week__title">Suggested for week {week}</p>
      {plan.events.length ? <>
        <ul className="plan-week__list">
          {plan.events.map(e => {
            const worth = worthIt(e.finance)!;
            const on = !off.has(e.id);
            return <li key={e.id}><label>
              <input type="checkbox" checked={on} onChange={() => setOff(prev => { const next = new Set(prev); if (on) next.add(e.id); else next.delete(e.id); return next; })} />
              <span className="plan-week__day">{dayLabel(e.dates.startDayOfWeek)}</span>
              <span className="plan-week__what"><b>{e.name}</b><small>{e.venue.city} · {e.finance!.estimatedPlayerCostPence ? formatPence(e.finance!.estimatedPlayerCostPence) : "Free"}</small>
                <small className="career-worth" data-tone={worth.tone}>{worth.label}</small></span>
            </label></li>;
          })}
        </ul>
        <p className="plan-week__sum">{chosen.length
          ? <>{chosen.length} event{chosen.length === 1 ? "" : "s"} · about {formatPence(cost)} in entry and travel · up to {formatPence(upTo)} to win · leaves you {formatPence(plan.availablePence - cost)}</>
          : "Nothing ticked."}</p>
        {plan.skippedForMoney > 0 && <p className="plan-week__note">{plan.skippedForMoney} more worth-it event{plan.skippedForMoney === 1 ? "" : "s"} left out: not enough money free for {plan.skippedForMoney === 1 ? "it" : "them"} as well.</p>}
      </> : <p className="plan-week__note">{plan.skippedForMoney
        ? "The worth-it events this week cost more than the money you have free. Try the free nights below, or next week."
        : "Nothing worth the trip left to enter this week."}</p>}
      <p className="plan-week__note">Picks events that pay back their cost early, one a day, at most four in a week including what you have booked. Series that run over several weeks are entered from their own event page.</p>
      <div className="plan-week__actions">
        {plan.events.length > 0 && <button type="button" className="career-btn career-btn-primary" disabled={!chosen.length || enter.isPending} onClick={confirm}>
          {enter.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null} Enter {chosen.length || ""} event{chosen.length === 1 ? "" : "s"}</button>}
        <button type="button" className="career-btn career-btn-ghost" disabled={enter.isPending} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}
