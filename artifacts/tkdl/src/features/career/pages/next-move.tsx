import type { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowUpRight, CalendarDays, FastForward, Loader2, Swords, Trophy } from "lucide-react";
import { CareerEventCard } from "../components";
import { CareerEventAtmosphere, atmosphereFromCalendarEvent } from "../atmosphere";
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
  const byId = (eventId: string) => events.find(e => e.id === eventId);

  let lead;
  if (pendingReview) lead = <Lead title="Season complete" text="Read your season review to start the next season.">
    <Link className="career-btn career-btn-primary" href={`/career/${id}/my-career/history`}>Season review <ArrowUpRight aria-hidden /></Link></Lead>;
  else if (match) lead = <Lead title="Your match is ready" text="Step up to the oche." event={byId(match.eventId)}>
    <Link className="career-btn career-btn-gold" href={`/career/${id}/matches/${match.matchId}/play`}><Swords aria-hidden /> Play your match</Link></Lead>;
  else if (activeTournament) lead = <Lead title={activeTournament.name} text="Tournament in progress.">
    <Link className="career-btn career-btn-primary" href={`/career/${id}/tournaments/${activeTournament.eventId}`}><Trophy aria-hidden /> Return to tournament</Link></Lead>;
  else if (booked) lead = <Lead title={byId(booked.eventId) ? "Booked" : `Booked: ${booked.name}`} text={`Week ${booked.week} · play on and your first match opens`} event={byId(booked.eventId)}>
    <button type="button" className="career-btn career-btn-primary" disabled={go.pending || go.blocked} onClick={() => { void go.run(); }}>
      {go.pending ? <Loader2 className="animate-spin" aria-hidden /> : <FastForward aria-hidden />} Play on to your match</button></Lead>;

  return (
    <section className="next-move panel" aria-labelledby="next-move-title">
      <div className="next-move__kicker"><span className="live-indicator" aria-hidden /> Play</div>
      <h2 id="next-move-title" className="next-move__title">Your next move</h2>
      {lead}
      {!match && !activeTournament && !pendingReview && <>
        <div className="next-move__subhead"><span>{booked ? "Add another event" : "Pick an event to play"}</span>
          <Link href={`/career/${id}/calendar`} className="next-move__link"><CalendarDays aria-hidden /> Full calendar</Link></div>
        {enterable.length ? <div className="next-move__events">
          {enterable.map(e => <CareerEventCard key={e.id} event={e} saveId={id} compact onEnter={onEnter} entering={entering} />)}
        </div> : <p className="next-move__empty">Nothing you can enter in the next few weeks. Skip ahead and new entries will open.</p>}
        {message && <p className="next-move__message" role="status">{message}</p>}
        {!booked && <button type="button" className="career-btn career-btn-ghost next-move__skip" disabled={go.pending || go.blocked} onClick={() => { void go.run(); }}>
          {go.pending ? <Loader2 className="animate-spin" aria-hidden /> : <FastForward aria-hidden />} Skip ahead to the next date</button>}
      </>}
      {go.pending && <ContinueProgress saveId={save.id} from={go.from} toEvent={booked} />}
      {go.outcome && <ContinueOutcomeCard outcome={go.outcome} onClose={go.clear} />}
    </section>
  );
}

/** The lead decision. With its event known it stands on that event's venue (same scene as the event page). */
function Lead({ title, text, event, children }: { title: string; text: string; event?: CareerEvent; children: ReactNode }) {
  if (event) return <CareerEventAtmosphere event={atmosphereFromCalendarEvent(event)} animate={false} headingLevel={3} className="next-move__stage">
    <p className="next-move__stage-line"><b>{title}</b> · {text}</p>
    <div className="next-move__stage-cta">{children}</div>
  </CareerEventAtmosphere>;
  return <div className="next-move__lead"><div><strong>{title}</strong><span>{text}</span></div>{children}</div>;
}
