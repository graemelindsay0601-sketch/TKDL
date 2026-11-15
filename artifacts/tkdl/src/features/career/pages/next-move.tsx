import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowUpRight, CalendarDays, FastForward, Loader2, Swords, Trophy } from "lucide-react";
import { CareerEventCard } from "../components";
import { CareerEventAtmosphere, atmosphereFromCalendarEvent } from "../atmosphere";
import { useContinueCareer, ContinueOutcomeCard, ContinueProgress } from "../continue-career";
import { FormBadge } from "../quick-sim";
import type { CareerEvent, CareerSave, CalendarOverview } from "../types";
import { dayLabel, formatPence, worthIt } from "../model";
import { CareerWelcome } from "../welcome";
import { TourCardOffer } from "./road";
import { LastWeekMoney } from "../week-money";
import { SavingsGoalLine } from "../savings-goal";
import { PlanMyWeek } from "../plan-week";
import { NextSponsorLine } from "../sponsor-prospects";
import { MoneyChallengeLine } from "../money-matches";
import { RoadVisitorLine } from "../road-trips";
import { TeamNightLine } from "../team-nights";
import { NightsLine } from "./nights";
import { useCamLeague, useProAm, useRoadTrips, useStreaming, useTeamNights, useWeekNights } from "../api";

/**
 * Home's first panel: the one thing to do next, without reading the rest of the page.
 * A waiting match or tournament → go there. Otherwise: the booked event (play on to it),
 * up to four events you can enter right now (one tap), and a way to skip ahead.
 */
const VALUE_RANK = { good: 0, fair: 1, neutral: 2, poor: 3 } as const;
const valueRank = (e: CareerEvent) => VALUE_RANK[worthIt(e.finance)?.tone ?? "neutral"];

export function NextMove({ save, overview, events, activeTournament, pendingReview, onEnter, entering, message, embedded = false }: {
  save: CareerSave; overview: CalendarOverview | null; events: CareerEvent[];
  activeTournament: { eventId: string; name: string } | undefined; pendingReview: boolean;
  onEnter: (eventId: string) => void; entering: boolean; message: string;
  /** Inside the Career Guide: the guide already says what's next, so this is just the week. */
  embedded?: boolean;
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
  // The best value first (a newcomer's first tap should not be a trip where even winning loses money), then the cheapest.
  const enterable = open.filter(e => e.dates.startWeek === planWeek && (plan.day === null || e.dates.startDayOfWeek === plan.day))
    .sort((a, b) => valueRank(a) - valueRank(b) || (a.finance?.estimatedPlayerCostPence ?? 0) - (b.finance?.estimatedPlayerCostPence ?? 0) || a.dates.startDay - b.dates.startDay)
    .slice(0, 6);
  const id = save.id;
  const byId = (eventId: string) => events.find(e => e.id === eventId);

  let lead;
  if (pendingReview) lead = <Lead title="Season complete" text="Read your season review to start the next season.">
    <Link className="career-btn career-btn-primary" href={`/career/${id}/my-career/history`}>Season review <ArrowUpRight aria-hidden /></Link></Lead>;
  else if (match) lead = <Lead title="Your match is ready" text="Step up to the oche." event={byId(match.eventId)}>
    <Link className="career-btn career-btn-gold" href={`/career/${id}/matches/${match.matchId}/play`}><Swords aria-hidden /> Play your match</Link>
    </Lead>;
  else if (activeTournament) lead = <Lead title={activeTournament.name} text="Tournament in progress.">
    <Link className="career-btn career-btn-primary" href={`/career/${id}/tournaments/${activeTournament.eventId}`}><Trophy aria-hidden /> Return to tournament</Link></Lead>;
  else if (booked) lead = <Lead title={byId(booked.eventId) ? "Booked" : `Booked: ${booked.name}`} text={`Week ${booked.week} · play on and your first match opens`} event={byId(booked.eventId)}>
    <button type="button" className="career-btn career-btn-primary" disabled={go.pending || go.blocked} onClick={() => { void go.run(); }}>
      {go.pending ? <Loader2 className="animate-spin" aria-hidden /> : <FastForward aria-hidden />} Play on to your match</button></Lead>;

  return (
    <section id="week-planner" className="next-move panel" data-embedded={embedded || undefined} aria-labelledby="next-move-title">
      {!embedded && <div className="next-move__kicker"><span className="live-indicator" aria-hidden /> Play</div>}
      <h2 id="next-move-title" className="next-move__title">{embedded ? "This week" : "Your next move"}</h2>
      <CareerWelcome save={save} entered={!!booked} />
      <TourCardOffer saveId={id} />
      {!embedded && lead}
      {!match && !activeTournament && !pendingReview && <>
        <div className="next-move__subhead"><span>{booked ? "Add another event" : "Pick an event to play"}</span>
          <Link href={`/career/${id}/calendar`} className="next-move__link"><CalendarDays aria-hidden /> Full calendar</Link></div>
        {/* The week first: pick a day, and that day's events are right underneath. */}
        <WeekPlanner saveId={id} events={events} open={open} currentWeek={save.currentWeek} week={planWeek} day={plan.day} onPick={setPlan}
          today={overview?.today?.week === save.currentWeek ? overview.today.dayOfWeek : 1} />
        {enterable.length ? <div className="next-move__events" aria-label={plan.day ? `Events you can enter on ${dayLabel(plan.day)}` : `Events you can enter in week ${planWeek}`}>
          {enterable.map(e => <CareerEventCard key={e.id} event={e} saveId={id} compact onEnter={onEnter} entering={entering} />)}
        </div> : <WhyNothing saveId={id} events={events} week={planWeek} day={plan.day} anyOpen={open.length > 0} currentWeek={save.currentWeek} onNextWeek={() => setPlan({ week: Math.min(52, planWeek + 1), day: null })} />}
        {!save.retiredAt && <PlanMyWeek saveId={id} events={events} week={planWeek} />}
        <div className="next-move__lines" aria-label="This week at a glance">
          <NextSponsorLine saveId={id} />
          <LastWeekMoney saveId={id} currentWeek={save.currentWeek} />
          <SavingsGoalLine saveId={id} />
          <MoneyChallengeLine saveId={id} />
          <RoadVisitorLine saveId={id} />
          <TeamNightLine saveId={id} week={save.currentWeek} />
          <NightsLine saveId={id} week={save.currentWeek} save={save} />
        </div>
        {message && <p className="next-move__message" role="status">{message}</p>}
        {!booked && <button type="button" className="career-btn career-btn-ghost next-move__skip" disabled={go.pending || go.blocked} onClick={() => { void go.run(); }}>
          {go.pending ? <Loader2 className="animate-spin" aria-hidden /> : <FastForward aria-hidden />} Skip ahead to the next date</button>}
      </>}
      <FormBadge saveId={id} variant="card" />
      {go.dialog}
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
type WeekPlannerActivity = { kind: string; id: string; label: string };
/**
 * Your week, Monday to Sunday: what you have booked each day and how many events you could still enter,
 * for this week and the next. A league night on Tuesday, a flier on Friday and an open on Saturday all fit.
 */
function WeekPlanner({ saveId, events, open, currentWeek, week, day, onPick, today }: {
  saveId: string; events: CareerEvent[]; open: CareerEvent[]; currentWeek: number; week: number; day: number | null; today: number;
  onPick: (plan: { week: number; day: number | null }) => void;
}) {
  const nights = useWeekNights(saveId);
  const teamNights = useTeamNights(saveId);
  const streaming = useStreaming(saveId, week);
  const camLeague = useCamLeague(saveId, week);
  const roadTrips = useRoadTrips(saveId, week);
  const proAm = useProAm(saveId, week);
  const booked = events.filter(e => e.human && BOOKED.has(e.human.relationship) && e.status !== "CANCELLED" && e.dates.startWeek <= week && e.dates.endWeek >= week);
  const activitiesOnDay = (d: number): WeekPlannerActivity[] => {
    const activities: WeekPlannerActivity[] = nights.data?.week === week
      ? nights.data.days.find(item => item.dayOfWeek === d)?.items.filter(item => item.kind !== "EVENT") ?? []
      : [];
    const teamNight = teamNights.data?.next;
    if (d === 3 && teamNight?.week === week) activities.push({
      kind: "team",
      id: "team",
      label: `Team night ${teamNight.home ? "v" : "at"} ${teamNight.opponent}`,
    });
    if (week !== currentWeek && streaming.data?.week === week && streaming.data.pathway.scheduledNights.includes(d))
      activities.push({ kind: "stream", id: `stream-${week}-${d}`, label: "DartCast stream" });
    if (week !== currentWeek && roadTrips.data?.week === week && roadTrips.data.trip?.dayOfWeek === d)
      activities.push({ kind: "trip", id: roadTrips.data.trip.id, label: `Road trip · ${roadTrips.data.trip.town}` });
    const bookedFixture = camLeague.data?.league?.fixtures.find(f => f.week === week && f.status === "BOOKED" && f.dayOfWeek === d);
    if (week !== currentWeek && bookedFixture) activities.push({ kind: "league", id: bookedFixture.id, label: "Webcam league match" });
    const futureProAm = proAm.data?.booking;
    if (week !== currentWeek && proAm.data?.week === week && futureProAm?.status === "BOOKED" && futureProAm.dayOfWeek === d)
      activities.push({ kind: "proam", id: futureProAm.id, label: `Pro-Am night · ${futureProAm.town}` });
    return activities;
  };
  const activityHref = (kind: string) => ({
    LIFE: `/career/${saveId}/life`,
    stream: `/career/${saveId}/streaming`,
    trip: `/career/${saveId}/road-trips`,
    league: `/career/${saveId}/cam-league`,
    proam: `/career/${saveId}/pro-am`,
    team: `/career/${saveId}/club#team-nights`,
  }[kind] ?? `/career/${saveId}/nights`);
  const activityOptions = (d: number) => {
    const dayIsFree = !onDay(d).mine.length && !activitiesOnDay(d).length;
    if (!dayIsFree) return [];
    const options: { label: string; href: string }[] = [];
    const query = `?week=${week}&day=${d}`;
    const streamDays = week === currentWeek && streaming.data?.pathway.scheduledNights.length
      ? streaming.data.pathway.scheduledNights : streaming.data?.freeNights ?? [];
    if (streaming.data?.week === week && streamDays.includes(d) && streaming.data.streamsThisWeek < streaming.data.perWeek)
      options.push({ label: week === currentWeek ? "Book a DartCast stream" : "Schedule a DartCast stream", href: `${activityHref("stream")}${query}` });
    const fixture = camLeague.data?.league?.fixtures.find(f => f.week === week);
    if (fixture?.status === "SCHEDULED" && camLeague.data?.week === week && camLeague.data.freeNights.includes(d))
      options.push({ label: `Book ${week === currentWeek ? "this week’s" : "next week’s"} webcam match`, href: `${activityHref("league")}${query}` });
    if (roadTrips.data?.week === week && roadTrips.data.canTravel && roadTrips.data.freeNights.includes(d))
      options.push({ label: "Plan a road trip", href: `${activityHref("trip")}${query}` });
    if (proAm.data?.week === week && proAm.data.nights.some(n => n.dayOfWeek === d && n.free))
      options.push({ label: "Book a Pro-Am night", href: `${activityHref("proam")}${query}` });
    if (week === currentWeek) options.push({ label: "A local night (practice, pub league, knockout)", href: `/career/${saveId}/local` });
    return options;
  };
  const onDay = (d: number) => {
    const n = (week - 1) * 7 + d;
    return { mine: booked.filter(e => e.dates.startDay <= n && e.dates.endDay >= n), activities: activitiesOnDay(d), free: open.filter(e => e.dates.startWeek === week && e.dates.startDayOfWeek === d).length,
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
          const { mine, activities, free, played } = onDay(d);
          const past = week === currentWeek && d < today, isToday = week === currentWeek && d === today;
          const state = mine.length || activities.length ? "booked" : played ? "played" : past ? "past" : free ? "open" : "empty";
          return <button key={d} type="button" className="week-planner__day" data-state={state} aria-pressed={day === d}
            aria-label={`${dayLabel(d)}: ${mine.length || activities.length ? `booked ${[...mine.map(e => e.name), ...activities.map(item => item.label)].join(", ")}` : played ? "played" : free ? `${free} you can enter` : "nothing on"}`}
            onClick={() => onPick({ week, day: day === d ? null : d })}>
            <span className="week-planner__dow">{dayLabel(d)}{isToday && <i className="week-planner__today">Today</i>}</span>
            <span className="week-planner__what">{mine[0]?.name ?? activities[0]?.label ?? (played ? "Played" : past ? "Gone" : free ? `${free} open` : "—")}</span>
          </button>;
        })}
      </div>
      <div className="week-planner__agenda" aria-label={`Day-by-day details for week ${week}`}>
        {[1, 2, 3, 4, 5, 6, 7].filter(d => day === null || day === d).map(d => {
          const { mine, activities } = onDay(d);
          const dayNumber = (week - 1) * 7 + d;
          const options = open.filter(e => e.dates.startWeek === week && e.dates.startDayOfWeek === d
            && !mine.some(bookedEvent => bookedEvent.dates.startDay <= e.dates.startDay && bookedEvent.dates.endDay >= e.dates.startDay));
          return <div className="week-planner__agenda-day" key={d} data-booked={mine.length > 0 || activities.length > 0 || undefined}>
            <b>{dayLabel(d)}</b>
            <div>{mine.map(e => <Link key={`event:${e.id}`} href={`/career/${saveId}/events/${encodeURIComponent(e.id)}`}>{e.name}<small>{e.dates.endDay > dayNumber ? ` · through ${dayLabel(((e.dates.endDay - 1) % 7) + 1)}` : " · booked"}</small></Link>)}
              {activities.map(item => <Link key={`${item.kind}:${item.id}`} href={activityHref(item.kind)}>{item.label}<small> · open activity</small></Link>)}
              {!mine.length && !activities.length ? <span className="week-planner__agenda-empty">No event booked</span> : null}
              {options.length > 0 && <button type="button" className="week-planner__see" onClick={() => onPick({ week, day: d })}>{options.length} event{options.length === 1 ? "" : "s"} you can enter{day === d ? " (shown below)" : ": show them"}</button>}
              {!mine.length && !activities.length && activityOptions(d).length > 0 && (day === d
                ? <div className="week-planner__book-options" aria-label={`Activities available on ${dayLabel(d)}`}>
                  <b>Or do something else this night</b>
                  {activityOptions(d).map(option => <Link key={option.label} href={option.href}>{option.label}</Link>)}
                </div>
                : <span className="week-planner__also">Free night: {activityOptions(d).map((option, i) => <span key={option.label}>{i ? " · " : ""}<Link href={option.href}>{option.label}</Link></span>)}</span>)}
            </div>
          </div>;
        })}
      </div>
      <p className="week-planner__sum">{booked.length
        ? <>{booked.length} booked · about {formatPence(cost)} in entry and travel{prizes ? <> · up to {formatPence(prizes)} to win</> : null}</>
        : "Nothing booked this week yet."}{day ? <> · showing {dayLabel(day)} <button type="button" className="week-planner__clear" onClick={() => onPick({ week, day: null })}>show all</button></> : null}</p>
    </div>
  );
}

const DENIAL_WHY: Record<string, string> = { INSUFFICIENT_FUNDS: "you don't have enough money free", REGISTRATION_NOT_OPEN: "entries haven't opened yet",
  SCHEDULE_CONFLICT: "you're already booked", REGISTRATION_CLOSED: "entries have closed", FIELD_FULL: "the field is full", NOT_ELIGIBLE: "you're not eligible" };
/** When nothing can be entered: say why (from the events' own denials) and what to do instead. */
function WhyNothing({ saveId, events, week, day, anyOpen, currentWeek, onNextWeek }: { saveId: string; events: CareerEvent[]; week: number; day: number | null; anyOpen: boolean;
  currentWeek: number; onNextWeek: () => void }) {
  const inWeek = events.filter(e => e.dates.startWeek === week && (day === null || e.dates.startDayOfWeek === day));
  const allPlayed = inWeek.length > 0 && inWeek.every(e => e.status === "COMPLETED" || e.status === "CANCELLED");
  const there = events.filter(e => e.dates.startWeek === week && (day === null || e.dates.startDayOfWeek === day) && e.human && !e.human.canEnter
    && !["COMPLETED", "CANCELLED"].includes(e.status) && e.human.eligible);
  const counts = new Map<string, number>();
  for (const e of there) for (const d of e.human!.denials ?? []) if (DENIAL_WHY[d]) counts.set(d, (counts.get(d) ?? 0) + 1);
  const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 2);
  const opens = Math.min(99, ...there.filter(e => (e.human!.denials ?? []).includes("REGISTRATION_NOT_OPEN")).map(e => e.registration?.opensWeek ?? 99).filter(w => w > currentWeek));
  const where = day ? `on ${dayLabel(day)}` : `in week ${week}`;
  return <div className="next-move__empty next-move__why">
    <p>{allPlayed && !top.length ? <>{day ? `${dayLabel(day)}'s` : "This week's"} events have all been played. <button type="button" className="week-planner__see" onClick={onNextWeek}>Look at week {week + 1}</button> or play on.</> : top.length ? <>Nothing you can enter {where}: {top.map(([k, n]) => `${n} because ${DENIAL_WHY[k]}`).join("; ")}{counts.has("REGISTRATION_NOT_OPEN") ? (opens < 99 ? ` (entries open in week ${opens})` : " (entries open once you play on)") : ""}.</>
      : anyOpen ? `Nothing you can enter ${where}. Pick another day or week.` : "Nothing you can enter in the next few weeks. Skip ahead and new entries will open."}</p>
    <p className="next-move__why-tips">{counts.has("INSUFFICIENT_FUNDS") ? "Short of money? Free local events, local nights (practice, the pub league, the knockout) and money matches at your club cost little or nothing. " : ""}
      <Link href={`/career/${saveId}/local`}>Local nights</Link> · <Link href={`/career/${saveId}/calendar`}>Full calendar</Link></p>
  </div>;
}
