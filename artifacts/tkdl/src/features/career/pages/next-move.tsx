import type { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowUpRight, CalendarDays, FastForward, Loader2, Swords, Trophy } from "lucide-react";
import { circuitLabel, formatPence } from "../model";
import { useContinueCareer, ContinueOutcomeCard, ContinueProgress } from "../continue-career";
import type { CareerEvent, CareerSave, CalendarOverview } from "../types";

/**
 * Home's first panel: the one thing to do next, without reading the rest of the page.
 * A waiting match or tournament → go there. Otherwise: the booked event (play on to it),
 * up to four events you can enter right now (one tap), and a way to skip ahead.
 */
export function NextMove({ save, overview, events, activeTournament, pendingReview, onEnter, entering, message }: {
  save: CareerSave; overview: CalendarOverview | null; events: CareerEvent[];
  activeTournament: { eventId: string; name: string } | undefined; pendingReview: boolean;
  onEnter: (eventId: string) => void; entering: boolean; message: string;
}) {
  const booked = overview?.nextHumanEntry ?? null;
  const go = useContinueCareer(save, booked);
  const match = overview?.pendingHumanMatches[0];
  const enterable = events
    .filter(e => e.human?.canEnter && e.dates.startWeek >= save.currentWeek && e.status !== "COMPLETED" && e.status !== "CANCELLED")
    .sort((a, b) => a.dates.startDay - b.dates.startDay || b.presentation.calendarPriority - a.presentation.calendarPriority)
    .slice(0, 4);
  const id = save.id;

  let lead;
  if (pendingReview) lead = <Lead title="Season complete" text="Read your season review to start the next season.">
    <Link className="career-btn career-btn-primary" href={`/career/${id}/my-career/history`}>Season review <ArrowUpRight aria-hidden /></Link></Lead>;
  else if (match) lead = <Lead title="Your match is ready" text="Step up to the oche.">
    <Link className="career-btn career-btn-gold" href={`/career/${id}/matches/${match.matchId}/play`}><Swords aria-hidden /> Play your match</Link></Lead>;
  else if (activeTournament) lead = <Lead title={activeTournament.name} text="Tournament in progress.">
    <Link className="career-btn career-btn-primary" href={`/career/${id}/tournaments/${activeTournament.eventId}`}><Trophy aria-hidden /> Return to tournament</Link></Lead>;
  else if (booked) lead = <Lead title={`Booked: ${booked.name}`} text={`Week ${booked.week}. Play on and your first match opens when it starts.`}>
    <button type="button" className="career-btn career-btn-primary" disabled={go.pending || go.blocked} onClick={() => { void go.run(); }}>
      {go.pending ? <Loader2 className="animate-spin" aria-hidden /> : <FastForward aria-hidden />} Play on to your match</button></Lead>;

  return (
    <section className="next-move panel" aria-labelledby="next-move-title">
      <h2 id="next-move-title" className="next-move__title">Your next move</h2>
      {lead}
      {!match && !activeTournament && !pendingReview && <>
        <div className="next-move__subhead"><span>{booked ? "Add another event" : "Pick an event to play"}</span>
          <Link href={`/career/${id}/calendar`} className="next-move__link"><CalendarDays aria-hidden /> Full calendar</Link></div>
        {enterable.length ? <ul className="next-move__events">
          {enterable.map(e => <li key={e.id}>
            <Link href={`/career/${id}/events/${e.id}`} className="next-move__event">
              <strong>{e.name}</strong>
              <span>Wk {e.dates.startWeek} · {circuitLabel(e.circuit)}{e.finance ? ` · Top prize ${formatPence(e.finance.topPrizePence)}` : ""}</span>
              {e.finance && <small>Your cost {formatPence(e.finance.estimatedPlayerCostPence)}</small>}
            </Link>
            <button type="button" className="career-btn career-btn-primary next-move__enter" disabled={entering} onClick={() => onEnter(e.id)} aria-label={`Enter ${e.name}`}>Enter</button>
          </li>)}
        </ul> : <p className="next-move__empty">Nothing you can enter in the next few weeks. Skip ahead and new entries will open.</p>}
        {message && <p className="next-move__message" role="status">{message}</p>}
        {!booked && <button type="button" className="career-btn career-btn-ghost next-move__skip" disabled={go.pending || go.blocked} onClick={() => { void go.run(); }}>
          {go.pending ? <Loader2 className="animate-spin" aria-hidden /> : <FastForward aria-hidden />} Skip ahead to the next date</button>}
      </>}
      {go.pending && <ContinueProgress from={go.from} toEvent={booked} />}
      {go.outcome && <ContinueOutcomeCard outcome={go.outcome} onClose={go.clear} />}
    </section>
  );
}

function Lead({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return <div className="next-move__lead"><div><strong>{title}</strong><span>{text}</span></div>{children}</div>;
}
