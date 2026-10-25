import { useMemo, useState } from "react";
import { CalendarDays, Check, MapPin, Minus, Plus, ShieldCheck, Ticket, X } from "lucide-react";
import { errorMessage, useEnterEvents } from "./api";
import { denialLabel, eventCircuitLabel, eventDateLabel, formatPence } from "./model";
import type { CareerEvent, CareerSave } from "./types";

type Props = {
  save: CareerSave;
  events: CareerEvent[];
  retired: boolean;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
};

const enteredRelationships = new Set(["ENTERED", "CONFIRMED", "PLAYING", "COMPLETED", "WITHDRAWN", "MISSED"]);
const closedStatuses = new Set(["COMPLETED", "CANCELLED"]);

function canShortlist(event: CareerEvent, save: CareerSave, retired: boolean) {
  return !retired
    && event.season === save.currentSeason
    && event.dates.endWeek >= save.currentWeek
    && event.human?.canEnter === true
    && !enteredRelationships.has(event.human.relationship)
    && !closedStatuses.has(event.status)
    && event.finance !== null;
}

function conflict(a: CareerEvent, b: CareerEvent) {
  return a.dates.startDay <= b.dates.endDay && b.dates.startDay <= a.dates.endDay
    || !!a.human?.conflictsWith.includes(b.id)
    || !!b.human?.conflictsWith.includes(a.id);
}

function unavailableReason(event: CareerEvent) {
  if (event.human?.relationship === "NOT_ELIGIBLE") return "Not eligible";
  if (event.human && enteredRelationships.has(event.human.relationship)) return "Already entered";
  if (closedStatuses.has(event.status)) return event.status === "CANCELLED" ? "Cancelled" : "Completed";
  if (!event.finance) return "Cost estimate unavailable";
  if (event.human?.denials[0]) return denialLabel(event.human.denials[0]);
  if (!event.human) return "Eligibility details unavailable";
  return "Entry unavailable";
}

export function SeasonPlannerView({ save, events, retired, loading, error, onRetry, selectedIds, onSelectedIdsChange }: Props) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [message, setMessage] = useState("");
  const enterEvents = useEnterEvents(save.id);
  const endWeek = Math.min(52, save.currentWeek + 7);
  const candidates = useMemo(() => [...events]
    .filter(event => event.season === save.currentSeason && event.dates.startWeek >= save.currentWeek && event.dates.startWeek <= endWeek)
    .sort((a, b) => a.dates.startDay - b.dates.startDay || a.name.localeCompare(b.name)), [events, save.currentSeason, save.currentWeek, endWeek]);
  const selectable = candidates.filter(event => canShortlist(event, save, retired));
  const selected = selectable.filter(event => selectedIds.includes(event.id));
  const selectedConflicts = useMemo(() => selected.flatMap((event, index) => selected.slice(index + 1)
    .filter(other => conflict(event, other)).map(other => [event, other] as const)), [selected]);

  const totals = useMemo(() => selected.reduce((sum, event) => {
    const finance = event.finance!;
    return {
      entry: sum.entry + finance.entryFeePence,
      travel: sum.travel + finance.estimatedTravelPence,
      accommodation: sum.accommodation + finance.estimatedAccommodationPence,
      sponsorEntry: sum.sponsorEntry + finance.sponsorCoverage.entryFeePence,
      sponsorTravel: sum.sponsorTravel + finance.sponsorCoverage.travelPence,
      sponsorAccommodation: sum.sponsorAccommodation + finance.sponsorCoverage.accommodationPence,
      net: sum.net + finance.estimatedPlayerCostPence,
      prize: sum.prize + finance.topPrizePence,
    };
  }, { entry: 0, travel: 0, accommodation: 0, sponsorEntry: 0, sponsorTravel: 0, sponsorAccommodation: 0, net: 0, prize: 0 }), [selected]);
  const gross = totals.entry + totals.travel + totals.accommodation;
  const sponsorCoverage = totals.sponsorEntry + totals.sponsorTravel + totals.sponsorAccommodation;
  const projectedBalance = save.balancePence - totals.net;

  const toggle = (event: CareerEvent) => {
    if (!canShortlist(event, save, retired)) return;
    setMessage("");
    onSelectedIdsChange(selectedIds.includes(event.id)
      ? selectedIds.filter(id => id !== event.id)
      : [...selectedIds, event.id]);
  };

  const confirmEntries = () => enterEvents.mutate(selected.map(event => event.id), {
    onSuccess: results => {
      const entered = new Set(results.filter(item => item.result?.entered).map(item => item.eventId));
      const names = new Map(selected.map(event => [event.id, event.name]));
      const failures = results.filter(item => !item.result?.entered).map(item => {
        const reason = item.error
          ? errorMessage(item.error)
          : item.result?.denials.length
            ? item.result.denials.map(denialLabel).join(", ")
            : "Entry was not confirmed";
        return `${names.get(item.eventId) ?? "Event"}: ${reason}`;
      });
      onSelectedIdsChange(selectedIds.filter(id => !entered.has(id)));
      setMessage([
        entered.size ? `Entered ${entered.size} event${entered.size === 1 ? "" : "s"}.` : "",
        ...failures,
      ].filter(Boolean).join(" "));
      setReviewOpen(false);
    },
    onError: error => setMessage(errorMessage(error)),
  });

  return (
    <section className="cc-season-plan" aria-label="Season event planner">
      <div className="cc-season-plan__grid">
        <div className="cc-season-plan__agenda">
          <header className="cc-season-plan__header">
            <div>
              <span className="cc-kicker">NEXT ON THE TOUR</span>
              <h3>Plan the next eight weeks <span>{candidates.length.toString().padStart(2, "0")}</span></h3>
              <p>Shortlist events to compare the full trip cost before you enter.</p>
            </div>
            <span className="cc-season-plan__window"><CalendarDays size={14} /> W{save.currentWeek}–{endWeek}</span>
          </header>

          {message && <p className="cc-season-plan__message" role="status">{message}</p>}
          {loading ? <div className="cc-state">Loading upcoming events…</div>
            : error ? <div className="cc-state"><CareerErrorMessage error={error} onRetry={onRetry} /></div>
            : candidates.length === 0 ? <div className="cc-state"><Ticket size={22} /><strong>No events in this planning window</strong>
              <span>Try the Timeline view to browse the rest of the season.</span></div>
            : <div className="cc-season-plan__events">
              {candidates.map(event => {
                const allowed = canShortlist(event, save, retired);
                const checked = selectedIds.includes(event.id) && allowed;
                const chosenConflicts = checked ? [] : selected.filter(chosen => conflict(event, chosen));
                return <article className="cc-season-plan__event" data-selected={checked || undefined} data-disabled={!allowed || undefined} key={event.id}>
                  <div className="cc-season-plan__event-main">
                    <span className="cc-season-plan__week"><small>WEEK</small><strong>{String(event.dates.startWeek).padStart(2, "0")}</strong></span>
                    <div className="cc-season-plan__event-copy">
                      <strong>{event.name}</strong>
                      <span>{eventCircuitLabel(event)} · {event.venue.city}, {event.venue.country}</span>
                      <small>{eventDateLabel(event)}{chosenConflicts.length ? ` · Conflicts with ${chosenConflicts.map(item => item.name).join(", ")}` : ""}</small>
                    </div>
                  </div>
                  <div className="cc-season-plan__event-side">
                    <span className={`cc-season-plan__status ${checked ? "is-selected" : !allowed ? "is-locked" : ""}`}>
                      {checked ? "Shortlisted" : allowed ? "Open for entry" : unavailableReason(event)}
                    </span>
                    {event.finance
                      ? <small>{formatPence(event.finance.estimatedPlayerCostPence)} net · prize {formatPence(event.finance.topPrizePence)}</small>
                      : <small>Cost estimate unavailable</small>}
                    {allowed && <button type="button" className="cc-season-plan__toggle" aria-pressed={checked} onClick={() => toggle(event)}>
                      {checked ? <><Minus size={13} /> Remove</> : <><Plus size={13} /> Shortlist</>}
                    </button>}
                  </div>
                </article>;
              })}
            </div>}
        </div>

        <aside className="cc-season-plan__summary" aria-label="Selected events and projected finances">
          <header className="cc-season-plan__summary-head">
            <span className="cc-kicker">YOUR TOURING DESK</span>
            <div><h3>Season shortlist</h3><span>{selected.length} STOP{selected.length === 1 ? "" : "S"}</span></div>
            <p>Nothing is entered until you review and confirm the selections.</p>
          </header>
          {selected.length ? <ul className="cc-season-plan__shortlist">
            {selected.map(event => <li key={event.id}>
              <span>{eventDateLabel(event)}</span>
              <div><strong>{event.name}</strong><small><MapPin size={11} /> {event.venue.city} · {formatPence(event.finance!.estimatedPlayerCostPence)} player cost</small></div>
              <button type="button" aria-label={`Remove ${event.name}`} onClick={() => toggle(event)}><X size={14} /></button>
            </li>)}
          </ul> : <div className="cc-season-plan__empty"><Ticket size={22} /><strong>No stops shortlisted</strong><p>Choose an event you can enter to map your season.</p></div>}

          {selectedConflicts.length > 0 && <div className="cc-season-plan__conflicts" role="status">
            <strong>Resolve schedule conflicts</strong>
            {selectedConflicts.map(([first, second]) => <span key={`${first.id}-${second.id}`}>{first.name} and {second.name} overlap or conflict.</span>)}
            <small>Remove one of these events before confirming the plan.</small>
          </div>}

          <section className="cc-season-plan__finance" aria-label="Combined cash impact">
            <div className="cc-season-plan__finance-total"><span>Combined gross costs</span><strong>{formatPence(gross)}</strong></div>
            <dl>
              <div><dt>Entry fees</dt><dd>{formatPence(totals.entry)}</dd></div>
              <div><dt>Travel estimates</dt><dd>{formatPence(totals.travel)}</dd></div>
              <div><dt>Accommodation</dt><dd>{formatPence(totals.accommodation)}</dd></div>
              <div className="cc-season-plan__divider"><dt>Sponsor coverage</dt><dd>−{formatPence(sponsorCoverage)}</dd></div>
              <div><dt>Net player cost</dt><dd>{formatPence(totals.net)}</dd></div>
            </dl>
            <div className="cc-season-plan__projection" data-negative={projectedBalance < 0 || undefined}>
              <span>Projected balance<small>Current cash minus planned costs</small></span>
              <strong>{formatPence(projectedBalance)}</strong>
            </div>
            <div className="cc-season-plan__prize"><span>Potential top prizes<small>Not guaranteed or included above</small></span><strong>Up to {formatPence(totals.prize)}</strong></div>
          </section>
          <p className="cc-season-plan__note">Estimates use each event’s current finance preview. Entry checks run again when you confirm; a multi-event plan can partly succeed if a later entry is refused.</p>
          <button type="button" className="cc-button cc-button--primary cc-season-plan__review" disabled={!selected.length || selectedConflicts.length > 0 || enterEvents.isPending} onClick={() => setReviewOpen(true)}>
            <ShieldCheck size={15} /> Review selected events
          </button>
        </aside>
      </div>

      {reviewOpen && <div className="cc-season-plan__backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setReviewOpen(false); }}>
        <section className="cc-season-plan__dialog" role="dialog" aria-modal="true" aria-labelledby="cc-season-plan-review-title">
          <span className="cc-kicker">FINAL ENTRY REVIEW</span>
          <h3 id="cc-season-plan-review-title">Enter these events?</h3>
          <p>Each event is checked separately against the latest eligibility, schedule and finance rules. Some entries may be refused while others succeed.</p>
          <div><span>{selected.length} event{selected.length === 1 ? "" : "s"} · estimated net cost</span><strong>{formatPence(totals.net)}</strong></div>
          <div><span>Projected balance after planned costs</span><strong>{formatPence(projectedBalance)}</strong></div>
          <footer>
            <button type="button" className="cc-button cc-button--quiet" disabled={enterEvents.isPending} onClick={() => setReviewOpen(false)}>Back to plan</button>
            <button type="button" className="cc-button cc-button--primary" disabled={enterEvents.isPending} onClick={confirmEntries}>
              {enterEvents.isPending ? "Checking entries…" : <><Check size={15} /> Confirm entries</>}
            </button>
          </footer>
        </section>
      </div>}
    </section>
  );
}

function CareerErrorMessage({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return <><span>{errorMessage(error)}</span><button type="button" className="cc-inline-link" onClick={onRetry}>Try again</button></>;
}
