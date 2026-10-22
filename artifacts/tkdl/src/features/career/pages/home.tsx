import { useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, Award, CalendarDays, CircleDollarSign, Flag, History, Medal, Target, TrendingUp, X } from "lucide-react";
import {
  useCalendar, useSporting, useFinance, useHistory, useActiveTournament, usePresentation, usePathways, useStreaming, useHomeClub,
  useCareerProfile, useCareerLife, useCareerLegacySummary, useEnterEvent, useQualification, useMilestones,
  useCareerGoals, useGuidance, useEditGuidance, errorMessage,
} from "../api";
import {
  CareerSection, CareerEventCard, CareerEmptyState, CareerError, CareerLoading, EventPlateTile, Label, OSWALD, StatusBadge,
} from "../components";
import {
  pickNextEvent, formatPence, ordinal, dayLabel, circuitLabel, denialLabel, eventStatus, careerChapter,
  routeLines, milestoneLabel, pathwayLabel,
} from "../model";
import { CareerShirt, CareerEventIdentity } from "../identity";
import { CareerPageHero } from "../page-hero";
import { CareerEventAtmosphere, atmosphereFromCalendarEvent } from "../atmosphere";
import { ContextHelp } from "../guidance";
import { TournamentResume } from "./tournament";
import { NextMove } from "./next-move";
import type { ShellContext } from "../shell";
import type { CareerEvent, QualificationEvent } from "../types";
import "./home.css";

/** Career headquarters: the next decision is prominent; every fact is server-backed. */
export function HomePage({ ctx }: { ctx: ShellContext }) {
  const { save, retired } = ctx;
  const id = save.id;
  const sporting = useSporting(id);
  const finance = useFinance(id);
  const presentation = usePresentation(id);
  const profile = useCareerProfile(id);
  const life = useCareerLife(id);
  const legacy = useCareerLegacySummary(id, !retired);
  const calendar = useCalendar(id, { scope: "RELEVANT", fromWeek: Math.max(1, save.currentWeek - 2), toWeek: Math.min(52, save.currentWeek + 8) }, !retired);
  const history = useHistory(id, { participant: "HUMAN" });
  const tournaments = useActiveTournament(id, !retired);
  const milestones = useMilestones(id, 12);
  const goals = useCareerGoals(id);
  const qualification = useQualification(id, { fromWeek: save.currentWeek, weeks: 12 }, !retired);
  const enter = useEnterEvent(id);
  const [message, setMessage] = useState("");

  const events = calendar.data?.events ?? [];
  const next = calendar.data ? pickNextEvent(events, calendar.data.overview) : null;
  const active = tournaments.data?.tournaments.find(t => !t.terminal);
  const pending = calendar.data?.overview.pendingHumanMatches.find(match => match.eventId === next?.event.id);
  const opportunities = events.filter(e => e.human && e.id !== next?.event.id &&
    !["ENTERED", "CONFIRMED", "PLAYING", "COMPLETED", "WITHDRAWN", "MISSED"].includes(e.human.relationship) &&
    e.status !== "COMPLETED" && e.status !== "CANCELLED").slice(0, 4);
  const entered = events.filter(e => e.human && ["ENTERED", "CONFIRMED", "PLAYING"].includes(e.human.relationship)).slice(0, 4);
  const chapter = sporting.data ? careerChapter(sporting.data, save) : null;

  const onEnter = (eventId: string) => enter.mutate(eventId, {
    onSuccess: result => setMessage(result.entered ? "Entry confirmed." : result.denials.map(denialLabel).join(" · ")),
    onError: error => setMessage(errorMessage(error)),
  });

  return (
    <main className="career-home">
      {/* Your next move comes first: the rest of Home is reference you can scroll to. */}
      {!retired && <NextMove save={save} overview={ctx.overview} events={events} activeTournament={active} pendingReview={!!legacy.data?.pendingReview}
        onEnter={onEnter} entering={enter.isPending} message={message} />}
      <CareerPageHero kicker={`Career headquarters · Season ${save.currentSeason} / Week ${save.currentWeek}`}
        title={profile.data?.displayName ?? save.careerName ?? "My Career"} accent="#c52842" archival={retired}
        watermark={`S${String(save.currentSeason).padStart(2, "0")} · W${String(save.currentWeek).padStart(2, "0")}`}
        stage={retired ? { eventClass: "NATIONAL" } : sporting.data?.tourCard.holdsCard
          ? { venue: { venueType: "professional-floor" }, eventClass: "PROFESSIONAL_TOUR" } : { venue: { venueType: "social-club" }, eventClass: "GRASSROOTS" }}
        subtitle={<>{chapter?.label ?? (retired ? "Retired Career" : "Reading sporting status")}
          {sporting.data && chapter?.label !== (sporting.data.professionalStatus === "PROFESSIONAL" ? "Professional" : "Amateur")
            ? <> · {sporting.data.professionalStatus === "PROFESSIONAL" ? "Professional" : "Amateur"}</> : null}
          {profile.data?.status === "COMPLETE" ? ` · Age ${profile.data.age}` : ""}
          {typeof presentation.data?.identity.nickname === "string" && presentation.data.identity.nickname ? <> · “{presentation.data.identity.nickname}”</> : null}</>}
        portrait={presentation.data ? <CareerShirt identity={presentation.data.identity} sponsors={presentation.data.placements} name={save.careerName ?? "Player"} scale="featured" /> : undefined}
        actions={<><Link className="career-btn career-btn-primary" href={`/career/${id}/calendar`}><CalendarDays aria-hidden /> Open calendar</Link>
          <Link className="career-btn career-btn-ghost" href={`/career/${id}/rankings`}><TrendingUp aria-hidden /> Rankings</Link></>}
        stats={[
          { label: "World rank", tone: sporting.data?.worldRanking.standing ? "gold" : "neutral",
            value: sporting.isLoading ? "…" : sporting.error ? "Unavailable" : sporting.data?.worldRanking.standing?.position ? ordinal(sporting.data.worldRanking.standing.position) : "Unranked" },
          { label: "Tour Card", tone: sporting.data?.tourCard.holdsCard ? "good" : "neutral",
            value: sporting.isLoading ? "…" : sporting.error ? "Unavailable" : sporting.data?.tourCard.holdsCard ? "Active" : "No Tour Card",
            sub: sporting.data?.tourCard.current ? `Review end of S${sporting.data.tourCard.current.reviewSeason}` : "Win one at Q-School or on the Challenger Tour" },
          { label: "Career balance", value: finance.isLoading ? "…" : finance.error ? "Unavailable" : formatPence(finance.data?.balancePence ?? save.balancePence),
            sub: finance.data ? `${formatPence(finance.data.availablePence)} available` : undefined },
          { label: "Sponsor", value: finance.data?.sponsor?.displayName ?? "Self-funded" },
        ]} />
      {!retired && finance.data?.availableOffers ? <aside className="home-sponsor-alert"><span><strong>Sponsor decision available</strong><small>Review the offer terms and coverage before your next commitment.</small></span><Link href={`/career/${id}/finances`}>Review <ArrowUpRight aria-hidden /></Link></aside> : null}
      {!retired && <PathwayTracker saveId={id} events={events} week={save.currentWeek}
        calendarLoading={calendar.isLoading} calendarError={calendar.error} retryCalendar={() => void calendar.refetch()} />}
      {(save.eventDatabaseVersion ?? 0) >= 5 && save.currentSeason === 1 && !retired && <>
        <SeasonOneGuidance saveId={id} />
        <details className="career-note" open>
          <summary>Tour Card routes this season</summary>
          <p>{(save.eventDatabaseVersion ?? 0) >= 17
            ? "Play wherever suits you. Q-School runs in weeks 2–4 if you can afford it, and the Challenger Tour is open to anyone without a Tour Card this season: finish in its top 2 for a Tour Card. Turning professional is up to you."
            : (save.eventDatabaseVersion ?? 0) >= 6
              ? `Play wherever suits you. This season the Challenger Tour is open to anyone without a Tour Card: finish in its top 2 for a Tour Card, or ${(save.eventDatabaseVersion ?? 0) >= 8 ? "3rd–16th" : "3rd–10th"} to go straight to the Q-School Final Stage. Q-School first runs in weeks 2–4 of season 2. Turning professional is up to you.`
              : "Play wherever suits you. Your first Q-School is at the start of season 2. Turning professional is up to you."}</p>
        </details>
      </>}
      <details className="home-more" open={retired}>
      <summary className="home-more__summary">More about your Career <span>Guidance, route ahead, goals, schedule and results</span></summary>
      <div className="home-more__body">
      <ContextHelp saveId={id} topic="home" />

      <section className={`home-next panel${active ? " home-next-live" : ""}`} aria-labelledby="home-next-title">
        <div className="home-section-kicker"><span className="live-indicator" aria-hidden /> PRIORITY DESK</div>
        <div className="home-next-heading">
          <div><Label color="#a7c9e8">Your next decision</Label><h2 id="home-next-title">Next Up</h2></div>
        </div>
        {retired ? (
          <div className="home-next-empty"><h3>Your permanent Career record</h3><p>Retired. Results, relationships, sponsors, reviews and honours remain readable.</p><Link className="career-btn career-btn-primary" href={`/career/${id}/my-career/history`}>Explore your history</Link></div>
        ) : legacy.data?.pendingReview ? (
          <div className="home-next-empty"><p>Read how your season went before the next one starts.</p><Link className="career-btn career-btn-primary" href={`/career/${id}/my-career/history`}>Continue Season Review</Link></div>
        ) : active ? (
          <div className="home-active-match">
            <div className="home-active-copy"><h3>Tournament in progress</h3><strong>{active.name}</strong><Link className="career-btn career-btn-primary" href={`/career/${id}/tournaments/${active.eventId}`}>Return to Tournament <ArrowUpRight aria-hidden /></Link><p>Your place is saved. Leaving a screen never withdraws you.</p></div>
          </div>
        ) : tournaments.isLoading || legacy.isLoading ? <CareerLoading label="Checking saved Career decisions" />
          : tournaments.error || legacy.error ? <CareerError error={tournaments.error || legacy.error} onRetry={() => { void tournaments.refetch(); void legacy.refetch(); }} />
          : calendar.isLoading ? <CareerLoading label="Finding the next useful decision" />
          : calendar.error ? <CareerError error={calendar.error} onRetry={() => void calendar.refetch()} />
          : next ? (
            <CareerEventIdentity eventKey={next.event.definitionKey} circuit={next.event.circuit} level={next.event.presentation.tier} className="home-featured-event">
              <CareerEventAtmosphere event={atmosphereFromCalendarEvent(next.event)} animate={false} headingLevel={3} className="home-next-stage">
                <div className="home-event-topline"><StatusBadge label={next.reason} tone={pending ? "warning" : next.event.human?.canEnter ? "gold" : "neutral"} /><span>Week {next.event.dates.startWeek} <span aria-hidden>·</span> {circuitLabel(next.event.circuit)}</span></div>
              </CareerEventAtmosphere>
              {pending
                ? <Link className="career-btn career-btn-primary" href={`/career/${id}/matches/${pending.matchId}/play`}>Play match <ArrowUpRight aria-hidden /></Link>
                : <CareerEventCard event={next.event} saveId={id} onEnter={onEnter} entering={enter.isPending} />}
              {next.event.finance && <div className="home-cost-grid">
                <div><span>EST. COMMITMENT</span><strong>{formatPence(next.event.finance.entryFeePence + next.event.finance.estimatedTravelPence + next.event.finance.estimatedAccommodationPence)}</strong></div>
                <div><span>SPONSOR COVERAGE</span><strong>{formatPence(next.event.finance.sponsorCoverage.entryFeePence + next.event.finance.sponsorCoverage.travelPence + next.event.finance.sponsorCoverage.accommodationPence)}</strong></div>
                <div><span>YOUR EST. COST</span><strong>{formatPence(next.event.finance.estimatedPlayerCostPence)}</strong></div>
              </div>}
            </CareerEventIdentity>
          ) : <CareerEmptyState title="No current entry decision">Your calendar has no immediate entry decision. Browse upcoming dates or continue Career to the next meaningful point.</CareerEmptyState>}
        {message && <p className="home-action-message" role="status">{message}</p>}
      </section>

      {!retired && active === undefined && tournaments.data?.tournaments.some(t => t.terminal) && <TournamentResume saveId={id} />}

      {(sporting.error || finance.error) && <div className="home-query-errors">
        {sporting.error && <CareerError error={sporting.error} onRetry={() => void sporting.refetch()} />}
        {finance.error && <CareerError error={finance.error} onRetry={() => void finance.refetch()} />}
      </div>}

      <div className="home-two-column">
        <CareerSection title="The route ahead" icon={<Target aria-hidden />} accent="#8dc9bc" action={<Link className="home-text-link" href={`/career/${id}/q-school`}>Qualification <ArrowUpRight aria-hidden /></Link>}>
          <RouteObjective
            loading={qualification.isLoading}
            error={qualification.error}
            retry={() => void qualification.refetch()}
            events={qualification.data?.events ?? []}
            hasCard={sporting.data?.tourCard.holdsCard ?? false}
            card={sporting.data?.tourCard.current ?? null}
            worldPosition={sporting.data?.worldRanking.standing?.position ?? null}
            saveId={id}
          />
        </CareerSection>
      </div>
        <CareerSection title="Career Compass" icon={<Target aria-hidden />} accent="#dbb866" action={<Link className="home-text-link" href={`/career/${id}/goals`}>Focus & goals <ArrowUpRight aria-hidden /></Link>}>
          {goals.isLoading ? <CareerLoading label="Reading your goals" /> : goals.error ? <CareerError error={goals.error} onRetry={() => void goals.refetch()} /> :
            goals.data ? <div className="home-goals">
              <p className="home-focus">{goals.data.focusOptions.find(f => f.value === goals.data?.focus)?.label ?? "Career focus"} <span>NEAR-TERM PREFERENCE</span></p>
              {goals.data.retired && <p className="home-muted">Retired Career: goals remain readable; no new sporting progress.</p>}
               {(() => {
                 const activeGoals=goals.data!.goals.filter(g=>g.status==="ACTIVE");
                 const mainGoal=goals.data!.goals.find(g=>g.id===goals.data!.mainGoalId) ?? activeGoals[0];
                 return mainGoal ? <div className="home-main-ambition">
                   <strong>{mainGoal.label}</strong><span>{mainGoal.status==="COMPLETED"?"Achieved":"Main ambition"}</span>
                   {mainGoal.evidence && <p>Confirmed: {mainGoal.evidence.label} · Season {mainGoal.evidence.season}</p>}
                   {mainGoal.status==="ACTIVE" && !mainGoal.evidence && <p>Not done yet. Your next step is below.</p>}
                 </div> : <NoGoalNudge saveId={id} retired={goals.data!.retired} />;
                })()}
               {goals.data.nearTermEventId && <p className="home-route-choice">
                 Chosen next step: {goals.data.opportunities.find(e=>e.id===goals.data!.nearTermEventId)?.name ?? "no longer among the two current suggestions"}
               </p>}
              <CompassOpportunities
                opportunities={goals.data.opportunities}
                events={events}
                saveId={id}
                onEnter={onEnter}
                entering={enter.isPending}
              />
               <p className="home-goal-foot">Suggestions only: goals never give you rewards or shortcuts.</p>
            </div> : <CareerEmptyState title="No goals available" />}
        </CareerSection>

      {!retired && <CareerSection title="Entry windows" icon={<CalendarDays aria-hidden />} accent="#86b8ec" action={<Link className="home-text-link" href={`/career/${id}/calendar`}>Full calendar <ArrowUpRight aria-hidden /></Link>}>
        {calendar.isLoading ? <CareerLoading label="Reading registration windows" /> : calendar.error ? <CareerError error={calendar.error} onRetry={() => void calendar.refetch()} /> :
          opportunities.length ? opportunities.map(event => <OpportunityRow key={event.id} event={event} saveId={id} onEnter={onEnter} entering={enter.isPending} />) :
            <CareerEmptyState title="No further entry decisions in this window">Other circuits and future dates remain discoverable in the full calendar.</CareerEmptyState>}
      </CareerSection>}

      {!retired && <CareerSection title="Your schedule" icon={<CalendarDays aria-hidden />} accent="#84c5b2" action={<Link className="home-text-link" href={`/career/${id}/calendar`}>Plan the season <ArrowUpRight aria-hidden /></Link>}>
        {calendar.isLoading ? <CareerLoading label="Reading your schedule" /> : calendar.error ? <CareerError error={calendar.error} onRetry={() => void calendar.refetch()} /> :
          entered.length ? entered.map(e => <CareerEventCard key={e.id} event={e} saveId={id} compact />) :
            <CareerEmptyState title="No entered commitments nearby">Qualified does not mean entered. Choose an event when registration and your schedule work.</CareerEmptyState>}
      </CareerSection>}

      <div className="home-two-column home-records">
        <CareerSection title="Recent results" icon={<Medal aria-hidden />} accent="#d8b76a" action={<Link className="home-text-link" href={`/career/${id}/my-career/history`}>Full history <ArrowUpRight aria-hidden /></Link>}>
          {history.isLoading ? <CareerLoading label="Loading your results" /> : history.error ? <CareerError error={history.error} onRetry={() => void history.refetch()} /> :
            history.data?.length ? <ul className="home-result-list">{history.data.slice(0, 4).map(row => <li key={row.eventId}>
              <CareerEventIdentity eventKey={row.definitionKey} circuit={row.circuit}><Link href={`/career/${id}/events/${row.eventId}`} className="home-result-link">
                <EventPlateTile atmosphere={{ circuit: row.circuit, classification: row.classification }} label={<>S{row.season} · WK {row.week}</>} />
                <span className="home-result-name"><strong>{row.name}</strong><small>{circuitLabel(row.circuit)} <span aria-hidden>·</span> {row.wins}W–{row.losses}L</small></span>
                <StatusBadge label={row.champion ? "Champion" : row.stageReached.replaceAll("_", " ")} tone={row.champion ? "gold" : "neutral"} />
              </Link></CareerEventIdentity>
            </li>)}</ul> : <CareerEmptyState title="No results yet">Your first finished event will appear here with its verified result.</CareerEmptyState>}
        </CareerSection>
        <CareerSection title="Latest milestones" icon={<Award aria-hidden />} accent="#c9a96e" action={<Link className="home-text-link" href={`/career/${id}/my-career/achievements`}>Achievements <ArrowUpRight aria-hidden /></Link>}>
          {milestones.isLoading ? <CareerLoading label="Checking dated achievements" /> : milestones.error ? <CareerError error={milestones.error} onRetry={() => void milestones.refetch()} /> :
            milestones.data?.milestones.length ? <ol className="home-milestones">{milestones.data.milestones.slice(0, 4).map((milestone, index) => {
              const label = milestoneLabel(milestone);
              return <li key={milestone.id ?? `${milestone.kind}-${index}`}>
                <span className="home-milestone-date">S{milestone.season}<small>WK {milestone.week}</small></span>
                <span className="home-milestone-mark" aria-hidden />
                <span><strong>{label.title}</strong>{label.detail && <small>{label.detail}</small>}</span>
              </li>;
            })}</ol> : <CareerEmptyState title="No milestones yet">Your first ranking, Tour Card and other big moments will show here.</CareerEmptyState>}
        </CareerSection>
      </div>

      <div className="home-two-column home-latest">
        <CareerSection title="Recent changes" icon={<History aria-hidden />} accent="#82a9d0" action={<Link className="home-text-link" href={`/career/${id}/my-career/history`}>Career history <ArrowUpRight aria-hidden /></Link>}>
          {legacy.isLoading ? <CareerLoading label="Checking Career changes" /> : legacy.error ? <CareerError error={legacy.error} onRetry={() => void legacy.refetch()} /> :
            legacy.data?.recentReviews?.length ? <div className="home-change-list">
              {legacy.data.recentReviews.slice(0,3).map((review, index) => <p key={`${review.season}-${index}`}><span>S{review.season}</span>{review.identity}<small>{review.provenance === "CAPTURED" ? "Recorded season review" : "Reconstructed historical review"}</small><Link href={`/career/${id}/my-career/history`} aria-label={`Open season ${review.season} history`}><ArrowUpRight aria-hidden /></Link></p>)}
            </div> : <CareerEmptyState title="No season changes to report">Important changes and season reviews will show here.</CareerEmptyState>}
        </CareerSection>
        <CareerSection title="Darts world" icon={<TrendingUp aria-hidden />} accent="#7ebbd3" action={<Link className="home-text-link" href={`/career/${id}/world`}>Explore world <ArrowUpRight aria-hidden /></Link>}>
          {life.isLoading ? <CareerLoading label="Checking the darts world" /> : life.error ? <CareerError error={life.error} onRetry={() => void life.refetch()} /> :
            life.data?.news.length ? <ul className="home-news">{life.data.news.slice(0, 3).map(n => <li key={n.id}><Link href={`/career/${id}/stories`}>{n.title}<ArrowUpRight aria-hidden /></Link></li>)}</ul> :
              <CareerEmptyState title="No recent developments">No news yet. Results and rankings are in Darts World.</CareerEmptyState>}
        </CareerSection>
      </div>

      </div>
      </details>
    </main>
  );
}

/**
 * A live orientation across the routes a player can take. Every status is read
 * from the Career calendar, pathway service or DartCast service; routes can
 * overlap, and this tracker does not treat one as a prerequisite for another.
 */
function PathwayTracker({ saveId, events, week, calendarLoading, calendarError, retryCalendar }: {
  saveId: string; events: CareerEvent[]; week: number; calendarLoading: boolean; calendarError: unknown; retryCalendar: () => void;
}) {
  const pathways = usePathways(saveId);
  const streaming = useStreaming(saveId);
  const club = useHomeClub(saveId);
  const base = `/career/${saveId}`;
  const nearest = (predicate: (event: CareerEvent) => boolean) => events
    .filter(event => predicate(event) && event.status !== "CANCELLED" && event.status !== "COMPLETED")
    .sort((a, b) => a.dates.startDay - b.dates.startDay)[0] ?? null;
  const nextLocal = nearest(event => event.circuit === "GRASSROOTS" || event.circuit === "NATIONAL_AMATEUR");
  const nextCounty = nearest(event => event.circuit === "COUNTY" || event.circuit === "REGIONAL" || event.circuit === "NATIONAL_AMATEUR");
  const nextSeries = nearest(event => !!event.series);
  const countyFixture = club.data?.county?.fixtures.find(f => f.week >= week);
  const countyFacts = club.isLoading ? "Checking county and national selection…"
    : club.error ? "County and national selection status is temporarily unavailable."
    : !club.data?.club ? "No home-club or county status is reported for this Career."
    : [
      club.data.county?.youSelected ? `Selected for ${club.data.county.name} county.` : club.data.county?.category
        ? `Not listed in the current ${club.data.county.category.toLowerCase()} county squad.` : "County category or selection is not reported.",
      countyFixture ? `Next county fixture: week ${countyFixture.week} ${countyFixture.home ? "v" : "at"} ${countyFixture.opponent}.` : "No upcoming county fixture reported.",
      club.data.nation?.selected ? `Selected for ${club.data.nation.name}.` : "No current national selection reported.",
    ].join(" ");
  const eventStatusText = (event: CareerEvent | null) => !event ? "No matching event in this calendar window."
    : event.human && ["ENTERED", "CONFIRMED", "PLAYING"].includes(event.human.relationship) ? `Booked: ${event.name} · week ${event.dates.startWeek}`
    : event.human?.canEnter ? `Open for entry: ${event.name} · week ${event.dates.startWeek}`
    : `Listed: ${event.name} · week ${event.dates.startWeek}. Check event details for your entry status.`;
  const routeRows = [
    { title: "Local & amateur", text: eventStatusText(nextLocal), event: nextLocal, href: `${base}/calendar`, action: nextLocal ? "View local event" : "Browse calendar" },
    { title: "County & national", text: `${eventStatusText(nextCounty)} ${countyFacts}`, event: nextCounty, href: `${base}/club`, action: nextCounty ? "View event" : "Club & selection" },
    { title: "Modus & series", text: nextSeries
      ? `${eventStatusText(nextSeries)} Series events appear when they are actually listed; no Modus date is assumed.`
      : "No series event is listed in this calendar window. No Modus event is assumed.", event: nextSeries, href: `${base}/calendar`, action: nextSeries ? "View series event" : "Browse calendar" },
  ];
  return <section className="pathway-tracker panel" aria-labelledby="pathway-tracker-title">
    <header className="pathway-tracker__head">
      <div><span className="home-section-kicker">ROUTES THROUGH DARTS</span><h2 id="pathway-tracker-title">Pathway tracker</h2></div>
      <Link href={`${base}/road-to-the-tour`} className="home-text-link">All Tour Card routes <ArrowUpRight aria-hidden /></Link>
    </header>
    <p className="pathway-tracker__note">These routes can overlap. Choosing one does not close the others; DartCast is a parallel route, not a sporting qualification.</p>
    <div className="pathway-tracker__grid">
      {routeRows.map(row => <article className="pathway-tracker__route" key={row.title}>
        <div><span className="pathway-tracker__eyebrow">SPORTING ROUTE</span><h3>{row.title}</h3></div>
        <p role={calendarLoading || calendarError ? "status" : undefined}>{calendarLoading ? "Loading events in your calendar window…"
          : calendarError ? "Calendar route status is temporarily unavailable." : row.text}</p>
        <Link href={row.event ? `${base}/events/${encodeURIComponent(row.event.id)}` : row.href}>{row.action} <ArrowUpRight aria-hidden /></Link>
        {row.title === "County & national" && <Link href={`${base}/club`}>Club &amp; selection <ArrowUpRight aria-hidden /></Link>}
        {!!calendarError && <button type="button" onClick={retryCalendar}>Retry calendar</button>}
        {row.title === "County & national" && club.error && <button type="button" onClick={() => void club.refetch()}>Retry selection</button>}
      </article>)}
      <article className="pathway-tracker__route">
        <div><span className="pathway-tracker__eyebrow">PARALLEL ROUTE</span><h3>DartCast</h3></div>
        {streaming.isLoading ? <p role="status">Checking your channel and available stream nights…</p>
          : streaming.error || !streaming.data ? <p role="status">Channel status is temporarily unavailable.</p>
          : <p>{streaming.data.live ? "You are live now."
            : streaming.data.pathway.focus === "DARTCAST" ? `${streaming.data.pathway.scheduledNights.length
              ? `Streamer focus · ${streaming.data.pathway.scheduledNights.map(dayLabel).join(", ")} reserved this week`
              : streaming.data.freeNights.length ? "Streamer focus · no night reserved yet; open DartCast to check this week"
                : "Streamer focus · no free night available this week"}. ${streaming.data.pathway.weeklyFrequency} stream night${streaming.data.pathway.weeklyFrequency === 1 ? "" : "s"} requested per week.`
            : streaming.data.freeNights.length ? `${streaming.data.freeNights.length} free night${streaming.data.freeNights.length === 1 ? "" : "s"} reported for streaming this week.`
              : "No free stream night reported this week."} {streaming.data.next
              ? `${streaming.data.followers.toLocaleString("en-GB")} followers · ${Math.max(0, streaming.data.next.followers - streaming.data.followers).toLocaleString("en-GB")} to ${streaming.data.next.name}.`
              : "Top channel tier reached."}</p>}
        <div className="pathway-tracker__actions">
          <Link href={`${base}/streaming`}>{streaming.data?.live ? "Return to DartCast" : streaming.data?.pathway.focus === "DARTCAST" ? "Manage stream schedule" : "Open DartCast"} <ArrowUpRight aria-hidden /></Link>
          {streaming.error && <button type="button" onClick={() => void streaming.refetch()}>Retry</button>}
        </div>
      </article>
      <article className="pathway-tracker__route">
        <div><span className="pathway-tracker__eyebrow">PROFESSIONAL ROUTE</span><h3>Tour Card</h3></div>
        {pathways.isLoading ? <p role="status">Checking Q-School and ranking routes…</p>
          : pathways.error || !pathways.data ? <p role="status">Tour Card route status is temporarily unavailable.</p>
          : pathways.data.tourCard ? <p>{pathways.data.tourCard.offer
            ? `Tour Card offer available; decide by Season ${pathways.data.tourCard.offer.decideBy.season}, week ${pathways.data.tourCard.offer.decideBy.week}.`
            : `Tour Card held for Seasons ${pathways.data.tourCard.startSeason}–${pathways.data.tourCard.endSeason}.`}</p>
          : <p>{pathways.data.qSchool.next
            ? `Next listed Q-School: ${pathways.data.qSchool.next.name}, week ${pathways.data.qSchool.next.week}.`
            : `No Q-School event listed ahead this season. Next listed season: ${pathways.data.qSchool.nextSeason ?? "not reported"}.`}
            {pathways.data.challenger.access !== "NONE" ? ` Challenger access: ${pathways.data.challenger.access === "OPEN_SEASON" ? "open this season" : "pass held"}.` : ""}
          </p>}
        <div className="pathway-tracker__actions">
          <Link href={`${base}/road-to-the-tour`}>Review routes <ArrowUpRight aria-hidden /></Link>
          <Link href={`${base}/q-school`}>Q-School <ArrowUpRight aria-hidden /></Link>
          {pathways.error && <button type="button" onClick={() => void pathways.refetch()}>Retry</button>}
        </div>
      </article>
    </div>
  </section>;
}

/** Where the player stands against the Tour Card retention cut, in plain words. */
export const retentionStatus = (card: { retention: { maxPosition: number } }, position: number | null) =>
  position === null ? "You are not on the World Ranking yet."
    : position === card.retention.maxPosition ? `You are ${ordinal(position)} — exactly on the cut line.`
    : position < card.retention.maxPosition ? `You are ${ordinal(position)} — inside the cut with ${card.retention.maxPosition - position} place${card.retention.maxPosition - position === 1 ? "" : "s"} to spare.`
    : `You are ${ordinal(position)} — ${position - card.retention.maxPosition} place${position - card.retention.maxPosition === 1 ? "" : "s"} outside the cut.`;

function RouteObjective({ loading, error, retry, events, hasCard, card, worldPosition = null, saveId }: {
  loading: boolean; error: unknown; retry: () => void; events: QualificationEvent[]; hasCard: boolean;
  card: { reviewSeason: number; retention: { maxPosition: number }; inFinalSeason?: boolean } | null; worldPosition?: number | null; saveId: string;
}) {
  if (loading) return <CareerLoading label="Checking qualification routes" />;
  if (error) return <CareerError error={error} onRetry={retry} />;
  if (hasCard && card) return <div className="home-objective">
    <span className="home-objective-icon"><Flag aria-hidden /></span><div><span className="home-objective-label">TOUR CARD RETENTION</span><h3>Finish Season {card.reviewSeason} in the World top {card.retention.maxPosition}</h3>
      <p>{retentionStatus(card, worldPosition)} The World Ranking is prize money over the last two seasons. {card.inFinalSeason ? "This is the final season of your card." : "Your card runs for two seasons, so this season counts towards the review without deciding it."} Missing the cut is not the end: you keep playing the Challenger ranking and go straight into the Q-School Final Stage.</p></div>
    <Link href={`/career/${saveId}/rankings`} className="home-objective-link">Rankings <ArrowUpRight aria-hidden /></Link>
  </div>;
  const sorted = [...events].sort((a, b) => a.startWeek - b.startWeek);
  const objective = sorted.find(event => !event.eligible && routeLines(event.routes).some(line => !line.met));
  const lines = objective ? routeLines(objective.routes) : [];
  return <div className="home-objective">
    <span className="home-objective-icon"><Target aria-hidden /></span>
    <div className="home-objective-copy">
      <span className="home-objective-label">NEXT QUALIFICATION OBJECTIVE</span>
      <h3>{objective ? objective.name : "Tour Card pathways"}</h3>
      {objective ? <><p>Authoritative routes reported for this event:</p><ul className="home-route-list">{lines.map((line, i) => <li key={`${i}-${line.text}`} data-met={line.met}><span aria-hidden />{line.text}</li>)}</ul></>
        : <p>Earn a Tour Card through Q-School or a Challenger ranking. Turning professional remains optional.</p>}
    </div>
    <Link href={`/career/${saveId}/q-school`} className="home-objective-link">{objective ? "View routes" : pathwayLabel("UK_IRELAND")} <ArrowUpRight aria-hidden /></Link>
  </div>;
}

function OpportunityRow({ event, saveId, onEnter, entering }: { event: CareerEvent; saveId: string; onEnter: (eventId: string) => void; entering: boolean }) {
  const status = eventStatus(event);
  const reasons = [...(event.human?.eligibilityReasons ?? []), ...(event.human?.denials ?? [])];
  const uniqueReasons = [...new Set(reasons)].filter(reason => reason !== "NOT_ELIGIBLE");
  return <div className="home-opportunity">
    <CareerEventCard event={event} saveId={saveId} compact onEnter={onEnter} entering={entering} />
    <div className="home-eligibility" aria-label={`${event.name} eligibility`}>
      <StatusBadge label={status.label} tone={status.tone} />
      {uniqueReasons.length ? <span>{uniqueReasons.map(denialLabel).join(" · ")}</span>
        : event.human?.eligible ? <span>Eligibility confirmed by Career rules. Registration status is shown above.</span>
          : <span>Eligibility details are not available for this event.</span>}
    </div>
  </div>;
}

function SeasonOneGuidance({ saveId }: { saveId: string }) {
  const guidance = useGuidance(saveId);
  const edit = useEditGuidance(saveId);
  if (!guidance.data || guidance.data.mode === "MINIMAL" || guidance.data.dismissed.includes("establishment")) return null;
  return <aside className="career-home-note" aria-label="Season 1 guidance">
    <div><strong>Your first season</strong><p>Amateur darts is a full career on its own. When you want a Tour Card, Road to the Tour shows every way to get one. Turning professional is up to you.</p></div>
    {guidance.data.canEdit && <button type="button" className="home-guidance-dismiss" disabled={edit.isPending} onClick={() => edit.mutate({ dismiss: "establishment" })} aria-label="Dismiss Season 1 guidance"><X aria-hidden /><span>Later</span></button>}
    {edit.error && <p role="alert">{errorMessage(edit.error)}</p>}
  </aside>;
}

function NoGoalNudge({ saveId, retired }: { saveId: string; retired: boolean }) {
  const guidance = useGuidance(saveId);
  const edit = useEditGuidance(saveId);
  if (retired || guidance.data?.dismissed.includes("compass") || guidance.data?.mode === "MINIMAL") {
    return <CareerEmptyState title="No active personal goals">Goals are optional ambitions, not quests. They grant no points, money or unlocks.</CareerEmptyState>;
  }
  return <div className="home-no-goal">
    <div><strong>No active ambition</strong><p>Choose a focus or personal goal when it helps. You can leave it for later; the calendar, event entry and Career progression stay open.</p></div>
    <div className="home-no-goal-actions"><Link className="career-btn career-btn-ghost" href={`/career/${saveId}/goals`}>Choose a focus or goal</Link>
      {guidance.data?.canEdit && <button type="button" className="home-later-link" disabled={edit.isPending} onClick={() => edit.mutate({ dismiss: "compass" })}>Later</button>}</div>
      {edit.error && <p role="alert">{errorMessage(edit.error)}</p>}
  </div>;
}

type CompassOpportunityView = {
  id: string; name: string; season: number; startDay: number; circuit: string; classification: string; tier: string; status: string;
  canEnter: boolean; eligible: boolean; denials: string[]; relationship: string; firstPrizePence: number | null;
  estimatedCostPence: number | null; registration: { opensWeek: number; closesWeek: number }; reason: string;
};

function CompassOpportunities({ opportunities, events, saveId, onEnter, entering }: {
  opportunities: CompassOpportunityView[]; events: CareerEvent[]; saveId: string;
  onEnter: (eventId: string) => void; entering: boolean;
}) {
  if (!opportunities.length) return <div className="home-compass-opportunities">
    <span className="home-compass-kicker">OPPORTUNITIES THAT FIT YOUR FOCUS</span>
    <p>No matching opportunity is listed in the current window. Your full calendar remains open.</p>
    <Link href={`/career/${saveId}/calendar`}>Browse calendar <ArrowUpRight aria-hidden /></Link>
  </div>;
  const [recommended, ...alternatives] = opportunities;
  const render = (opportunity: CompassOpportunityView, isRecommended: boolean) => {
    const event = events.find(item => item.id === opportunity.id);
    const state = event ? eventStatus(event) : null;
    const availability = opportunity.canEnter ? "Open for entry" :
      opportunity.denials.length ? opportunity.denials.map(denialLabel).join(" · ") :
        `${opportunity.status.replaceAll("_", " ")} · ${opportunity.relationship.replaceAll("_", " ")}`;
    return <article className={`home-compass-opportunity${isRecommended ? " is-recommended" : ""}`} key={opportunity.id}>
      <div className="home-compass-opportunity-head">
        <span className="home-compass-kicker">{isRecommended ? "RECOMMENDED OPPORTUNITY" : "ALTERNATIVE"}</span>
        <span className="home-compass-event-meta">S{opportunity.season} · Day {opportunity.startDay} · {opportunity.circuit.replaceAll("_", " ")}</span>
      </div>
      <h3><Link href={`/career/${saveId}/events/${opportunity.id}`}>{opportunity.name}</Link></h3>
      <p className="home-compass-reason">{opportunity.reason}</p>
      {event ? <CareerEventCard event={event} saveId={saveId} compact onEnter={onEnter} entering={entering} /> :
        <div className="home-compass-facts">
          <span>{availability}</span><span>Registration weeks {opportunity.registration.opensWeek}–{opportunity.registration.closesWeek}</span>
          <span>{opportunity.firstPrizePence === null ? "First prize unavailable" : `${formatPence(opportunity.firstPrizePence)} first prize`}</span>
          <span>{opportunity.estimatedCostPence === null ? "Cost estimate unavailable" : `${formatPence(opportunity.estimatedCostPence)} estimated Career cost`}</span>
          <Link className="home-text-link" href={`/career/${saveId}/events/${opportunity.id}`}>View event details <ArrowUpRight aria-hidden /></Link>
        </div>}
      {event && <p className="home-compass-eligibility">{state?.label ?? availability} · {availability} · Registration weeks {opportunity.registration.opensWeek}–{opportunity.registration.closesWeek}
        {opportunity.firstPrizePence === null ? " · First prize unavailable" : ` · ${formatPence(opportunity.firstPrizePence)} first prize`}
        {opportunity.estimatedCostPence === null ? " · Cost estimate unavailable" : ` · ${formatPence(opportunity.estimatedCostPence)} estimated Career cost`}</p>}
    </article>;
  };
  return <div className="home-compass-opportunities">
    <div className="home-compass-title-row"><span className="home-compass-kicker">OPPORTUNITIES THAT FIT YOUR FOCUS</span><Link href={`/career/${saveId}/calendar`}>Full calendar <ArrowUpRight aria-hidden /></Link></div>
    {render(recommended, true)}
    {alternatives.length > 0 && <div className="home-compass-alternatives">{alternatives.slice(0, 1).map(item => render(item, false))}</div>}
    <p className="home-compass-caveat">Guidance only. Check event eligibility, registration, schedule and costs before entering; this recommendation makes no sporting decision for you.</p>
  </div>;
}

export function AgeLine({ saveId }: { saveId: string }) {
  const profile = useCareerProfile(saveId).data;
  if (profile?.status !== "COMPLETE") return null;
  const parts = [`Age ${profile.age}`, `Career started at ${profile.ageAtCareerStart}`];
  if (profile.junior) parts.push(`Junior events until you turn ${profile.juniorMaxAgeExclusive}`);
  if (!profile.qSchool.eligibleNow && profile.qSchool.eligibleFrom) parts.push(`Q-School from ${profile.qSchool.eligibleFrom.date}`);
  return <p className="home-age-line" style={OSWALD}>{parts.join(" · ")}</p>;
}
