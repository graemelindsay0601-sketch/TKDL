import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Loader2, Moon, Radio, Sparkles } from "lucide-react";
import { useEnterEvents, useStreaming, useWeekNights, useTeamNights, errorMessage } from "./api";
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
  const streaming = useStreaming(saveId);
  const nights = useWeekNights(saveId);
  const team = useTeamNights(saveId);
  const plan = useMemo(() => planWeek(events, week), [events, week]);
  const chosen = plan.events.filter(e => !off.has(e.id));
  const cost = chosen.reduce((n, e) => n + e.finance!.estimatedPlayerCostPence, 0);
  const upTo = chosen.reduce((n, e) => n + e.finance!.topPrizePence, 0);
  const bookedDays = new Set(events.filter(e => e.human && ["ENTERED", "CONFIRMED", "PLAYING"].includes(e.human.relationship)
    && e.status !== "CANCELLED" && e.dates.startWeek <= week && e.dates.endWeek >= week)
    .flatMap(e => Array.from({ length: e.dates.endDay - e.dates.startDay + 1 }, (_, i) => e.dates.startDay + i))
    .map(day => ((day - 1) % 7) + 1));
  const suggestedDays = new Set(chosen.flatMap(e => Array.from({ length: e.dates.endDay - e.dates.startDay + 1 }, (_, i) => e.dates.startDay + i))
    .map(day => ((day - 1) % 7) + 1));
  const nightsAreForWeek = nights.data?.week === week;
  const freeNights = nightsAreForWeek
    ? nights.data!.days.filter(d => d.items.length === 0 && !(team.data?.next?.week === week && d.dayOfWeek === 3)
      && !(team.isLoading && d.dayOfWeek === 3) && !(team.isError && d.dayOfWeek === 3)
      && !bookedDays.has(d.dayOfWeek) && !suggestedDays.has(d.dayOfWeek)).map(d => d.dayOfWeek)
    : [];
  const streamNights = streaming.data?.week === week
    ? streaming.data.freeNights.filter(day => !bookedDays.has(day) && !suggestedDays.has(day))
    : [];

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
      <section className="plan-week__options" aria-labelledby="plan-week-options-title">
        <h3 id="plan-week-options-title">Optional free-night ideas</h3>
        <p>These are options only. They are not scheduled or reserved here; open a feature to choose an activity.</p>
        {nights.isLoading && <p className="plan-week__note" role="status">Checking booked nights…</p>}
        {nights.isError && <p className="plan-week__note" role="status">Night availability could not be checked. No day is marked free.</p>}
        {!nights.isLoading && !nights.isError && !nightsAreForWeek && <p className="plan-week__note">Free-night details are available for the current week only. Browse Nights Out for other weeks.</p>}
        {nightsAreForWeek && (team.isLoading || team.isError) && <p className="plan-week__note" role="status">
          {team.isLoading ? "Checking the Wednesday team-night schedule." : "Wednesday availability could not be confirmed, so no Wednesday option is shown."}</p>}
        {nightsAreForWeek && freeNights.length ? <ul className="plan-week__options-list">
          {freeNights.map(day => <li key={day}><b>{dayLabel(day)}</b><span>
            <Link href={`/career/${saveId}/club`}><Moon aria-hidden /> Club</Link>
            <Link href={`/career/${saveId}/nights`}><Moon aria-hidden /> Nights Out</Link>
            {streamNights.includes(day) && <Link href={`/career/${saveId}/streaming`}><Radio aria-hidden /> DartCast</Link>}
          </span></li>)}
        </ul> : nightsAreForWeek ? <p className="plan-week__note">{team.isLoading || team.isError ? "No other unbooked nights are confirmed." : "No unbooked nights remain after the event suggestions."}</p> : null}
        {streaming.isError && <p className="plan-week__note" role="status">DartCast availability is unavailable; no stream night is suggested.</p>}
        {nightsAreForWeek && streaming.data?.week === week && streaming.data.freeNights.length === 0 && <p className="plan-week__note">DartCast reports no free stream nights this week.</p>}
      </section>
      <div className="plan-week__actions">
        {plan.events.length > 0 && <button type="button" className="career-btn career-btn-primary" disabled={!chosen.length || enter.isPending} onClick={confirm}>
          {enter.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null} Enter {chosen.length || ""} event{chosen.length === 1 ? "" : "s"}</button>}
        <button type="button" className="career-btn career-btn-ghost" disabled={enter.isPending} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}
