import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowUpRight, CalendarDays, FastForward, Loader2, Swords, Trophy } from "lucide-react";
import { CareerEventCard } from "../components";
import { CareerEventAtmosphere, atmosphereFromCalendarEvent } from "../atmosphere";
import { useContinueCareer, ContinueOutcomeCard, ContinueProgress } from "../continue-career";
import { FormBadge, QuickSim } from "../quick-sim";
import type { CareerEvent, CareerSave, CalendarOverview } from "../types";
import { dayLabel, formatPence } from "../model";
import { LastWeekMoney } from "../week-money";

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
  const [plan, setPlan] = useState<{ week: number; day: number | null }>({ week: save.currentWeek, day: null });
  const planWeek = plan.week < save.currentWeek ? save.currentWeek : plan.week;
  const open = events
    .filter(e => e.human?.canEnter && e.dates.startWeek >= save.currentWeek && e.status !== "COMPLETED" && e.status !== "CANCELLED")
    // Day by day; on a busy night the cheapest (usually nearest) first.
    .sort((a, b) => a.dates.startDay - b.dates.startDay || (a.finance?.estimatedPlayerCostPence ?? 0) - (b.finance?.estimatedPlayerCostPence ?? 0)
      || b.presentation.calendarPriority - a.presentation.calendarPriority);
  const enterable = open.filter(e => e.dates.startWeek === planWeek && (plan.day === null || e.dates.startDayOfWeek === plan.day)).slice(0, 6);
  const id = save.id;
  const byId = (eventId: string) => events.find(e => e.id === eventId);

  let lead;
  if (pendingReview) lead = <Lead title="Season complete" text="Read your season review to start the next season.">
    <Link className="career-btn career-btn-primary" href={`/career/${id}/my-career/history`}>Season review <ArrowUpRight aria-hidden /></Link></Lead>;
  else if (match) lead = <Lead title="Your match is ready" text="Step up to the oche." event={byId(match.eventId)}>
    <Link className="career-btn career-btn-gold" href={`/career/${id}/matches/${match.matchId}/play`}><Swords aria-hidden /> Play your match</Link>
    <QuickSim saveId={id} eventId={match.eventId} matchId={match.matchId} compact /></Lead>;
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
        <LastWeekMoney saveId={id} currentWeek={save.currentWeek} />
        <WeekPlanner events={events} open={open} currentWeek={save.currentWeek} week={planWeek} day={plan.day} onPick={setPlan} />
        {enterable.length ? <div className="next-move__events">
          {enterable.map(e => <CareerEventCard key={e.id} event={e} saveId={id} compact onEnter={onEnter} entering={entering} />)}
        </div> : <p className="next-move__empty">{open.length ? `Nothing you can enter ${plan.day ? `on ${dayLabel(plan.day)}` : "that week"}. Pick another day or week.` : "Nothing you can enter in the next few weeks. Skip ahead and new entries will open."}</p>}
        {message && <p className="next-move__message" role="status">{message}</p>}
        {!booked && <button type="button" className="career-btn career-btn-ghost next-move__skip" disabled={go.pending || go.blocked} onClick={() => { void go.run(); }}>
          {go.pending ? <Loader2 className="animate-spin" aria-hidden /> : <FastForward aria-hidden />} Skip ahead to the next date</button>}
      </>}
      <FormBadge saveId={id} variant="card" />
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

const BOOKED = new Set(["ENTERED", "CONFIRMED", "PLAYING"]);
/**
 * Your week, Monday to Sunday: what you have booked each day and how many events you could still enter,
 * for this week and the next. A league night on Tuesday, a flier on Friday and an open on Saturday all fit.
 */
function WeekPlanner({ events, open, currentWeek, week, day, onPick }: {
  events: CareerEvent[]; open: CareerEvent[]; currentWeek: number; week: number; day: number | null;
  onPick: (plan: { week: number; day: number | null }) => void;
}) {
  const booked = events.filter(e => e.human && BOOKED.has(e.human.relationship) && e.status !== "CANCELLED" && e.dates.startWeek <= week && e.dates.endWeek >= week);
  const onDay = (d: number) => {
    const n = (week - 1) * 7 + d;
    return { mine: booked.filter(e => e.dates.startDay <= n && e.dates.endDay >= n), free: open.filter(e => e.dates.startWeek === week && e.dates.startDayOfWeek === d).length,
      played: events.some(e => e.human?.relationship === "COMPLETED" && e.dates.startDay <= n && e.dates.endDay >= n) };
  };
  const cost = booked.filter(e => e.dates.startWeek === week).reduce((n, e) => n + (e.finance?.estimatedPlayerCostPence ?? 0), 0);
  const prizes = booked.filter(e => e.dates.startWeek === week).reduce((n, e) => n + (e.finance?.topPrizePence ?? 0), 0);
  const weeks = [currentWeek, currentWeek + 1].filter(w => w <= 52);
  return (
    <div className="week-planner" aria-label={`Week ${week} plan`}>
      <div className="week-planner__tabs" role="tablist">
        {weeks.map(w => <button key={w} type="button" role="tab" aria-selected={w === week} className="week-planner__tab" onClick={() => onPick({ week: w, day: null })}>
          {w === currentWeek ? "This week" : "Next week"} <small>Wk {w}</small></button>)}
      </div>
      <div className="week-planner__days">
        {[1, 2, 3, 4, 5, 6, 7].map(d => {
          const { mine, free, played } = onDay(d);
          const state = mine.length ? "booked" : played ? "played" : free ? "open" : "empty";
          return <button key={d} type="button" className="week-planner__day" data-state={state} aria-pressed={day === d}
            aria-label={`${dayLabel(d)}: ${mine.length ? `booked ${mine.map(e => e.name).join(", ")}` : played ? "played" : free ? `${free} you can enter` : "nothing on"}`}
            onClick={() => onPick({ week, day: day === d ? null : d })}>
            <span className="week-planner__dow">{dayLabel(d)}</span>
            <span className="week-planner__what">{mine.length ? mine[0].name : played ? "Played" : free ? `${free} open` : "—"}</span>
          </button>;
        })}
      </div>
      <p className="week-planner__sum">{booked.length
        ? <>{booked.length} booked · about {formatPence(cost)} in entry and travel{prizes ? <> · up to {formatPence(prizes)} to win</> : null}</>
        : "Nothing booked this week yet."}{day ? <> · showing {dayLabel(day)} <button type="button" className="week-planner__clear" onClick={() => onPick({ week, day: null })}>show all</button></> : null}</p>
    </div>
  );
}
