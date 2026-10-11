import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowUpRight, Award, CalendarDays, CircleDollarSign, Flag, History, Medal, Target, TrendingUp } from "lucide-react";
import {
  useCalendar, useSporting, useFinance, useHistory, useActiveTournament, usePresentation,
  useCareerProfile, useCareerLife, useLegacy, useEnterEvent, useQualification, useMilestones,
  useCareerGoals, errorMessage,
} from "../api";
import {
  CareerSection, CareerEventCard, CareerEmptyState, CareerError, CareerLoading, Label, OSWALD, StatusBadge,
} from "../components";
import {
  pickNextEvent, formatPence, ordinal, circuitLabel, denialLabel, eventStatus, careerChapter,
  routeLines, milestoneLabel, pathwayLabel,
} from "../model";
import { CareerPlayerCard, CareerEventIdentity } from "../identity";
import { ContextHelp } from "../guidance";
import { TournamentResume } from "./tournament";
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
  const legacy = useLegacy(id);
  const calendar = useCalendar(id, { scope: "WORLD", fromWeek: Math.max(1, save.currentWeek - 2), toWeek: Math.min(52, save.currentWeek + 8) }, !retired);
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
      <header className="home-heading">
        <div>
          <span className="career-eyebrow">Career headquarters <span aria-hidden>·</span> Season {save.currentSeason} / Week {save.currentWeek}</span>
          <h1>Home</h1>
          <p>One career. Every result earned on the oche.</p>
        </div>
        <Link className="home-heading-link" href={`/career/${id}/calendar`}><CalendarDays aria-hidden /> Open calendar <ArrowUpRight aria-hidden /></Link>
      </header>

      <section className="home-player panel" aria-label="Career status">
        <CareerPlayerCard
          name={profile.data?.displayName ?? save.careerName ?? "My Career"}
          nickname={presentation.data?.identity.nickname}
          identity={presentation.data?.identity}
          sponsors={presentation.data?.placements}
          scale="compact"
          rank={sporting.data?.worldRanking.standing?.position}
        />
        <div className="home-player-facts">
          <span className="home-status-kicker">CURRENT STATUS</span>
          <strong>{chapter?.label ?? (retired ? "Retired Career" : "Reading sporting status")}</strong>
          <p>
            {sporting.data?.professionalStatus === "PROFESSIONAL" ? "Professional" : sporting.data ? "Amateur" : "Status pending"}
            {sporting.data?.tourCard.holdsCard ? " · Active Tour Card" : " · No active Tour Card"}
            {profile.data?.status === "COMPLETE" ? ` · Age ${profile.data.age}` : ""}
          </p>
          <p className="home-sponsor-line">{finance.data?.sponsor?.displayName ?? "Self-funded"} <span aria-hidden>·</span> Season {save.currentSeason}</p>
        </div>
        <div className="home-season-mark" aria-label={`Season ${save.currentSeason}, week ${save.currentWeek}`}>
          <span>S{String(save.currentSeason).padStart(2, "0")}</span><i aria-hidden />
          <strong>W{String(save.currentWeek).padStart(2, "0")}</strong>
        </div>
      </section>
      <ContextHelp saveId={id} topic="home" />
      {(save.eventDatabaseVersion ?? 0) >= 5 && save.currentSeason === 1 && !retired &&
        <p className="career-home-note">Establishment season: choose your own amateur path. Your first normal Q-School opportunity opens at the Season 1 → 2 boundary. Turning professional is optional.</p>}

      <section className={`home-next panel${active ? " home-next-live" : ""}`} aria-labelledby="home-next-title">
        <div className="home-section-kicker"><span className="live-indicator" aria-hidden /> PRIORITY DESK</div>
        <div className="home-next-heading">
          <div><Label color="#a7c9e8">Your next decision</Label><h2 id="home-next-title">Next Up</h2></div>
        </div>
        {retired ? (
          <div className="home-next-empty"><h3>Your permanent Career record</h3><p>Retired. Results, relationships, sponsors, reviews and honours remain readable.</p><Link className="career-btn career-btn-primary" href={`/career/${id}/my-career/history`}>Explore your history</Link></div>
        ) : legacy.data?.pendingReview ? (
          <div className="home-next-empty"><p>Review the season’s recorded results and changes before continuing.</p><Link className="career-btn career-btn-primary" href={`/career/${id}/my-career/history`}>Continue Season Review</Link></div>
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
              <div className="home-event-topline"><StatusBadge label={next.reason} tone={pending ? "warning" : next.event.human?.canEnter ? "gold" : "neutral"} /><span>{next.event.venue.city} <span aria-hidden>·</span> Week {next.event.dates.startWeek}</span></div>
              <h3>{next.event.name}</h3>
              <p className="home-event-sub">{circuitLabel(next.event.circuit)} <span aria-hidden>·</span> {next.event.presentation.tier.toLowerCase()} event</p>
              {pending
                ? <Link className="career-btn career-btn-primary" href={`/career/${id}/tournaments/${next.event.id}/matches/${pending.matchId}`}>Prepare / Play match <ArrowUpRight aria-hidden /></Link>
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

      <div className="home-fact-ribbon" aria-label="Current career facts">
        <FactLink label="WORLD RANK" value={sporting.isLoading ? "…" : sporting.error ? "Unavailable" : sporting.data?.worldRanking.standing?.position ? ordinal(sporting.data.worldRanking.standing.position) : "Unranked"} detail={sporting.data?.worldRanking.standing?.movement == null ? "Published position" : `Movement ${sporting.data.worldRanking.standing.movement > 0 ? "+" : ""}${sporting.data.worldRanking.standing.movement}`} href={`/career/${id}/rankings`} icon={<TrendingUp aria-hidden />} />
        <FactLink label="TOUR CARD" value={sporting.isLoading ? "…" : sporting.error ? "Unavailable" : sporting.data?.tourCard.holdsCard ? "Active" : "No Tour Card"} detail={sporting.data?.tourCard.current ? `Review at end of S${sporting.data.tourCard.current.reviewSeason}` : "Q-School or Challenger route"} href={`/career/${id}/q-school`} icon={<Flag aria-hidden />} />
        <FactLink label="CAREER BALANCE" value={finance.isLoading ? "…" : finance.error ? "Unavailable" : formatPence(finance.data?.balancePence ?? save.balancePence)} detail={finance.data ? `${formatPence(finance.data.availablePence)} available` : "Career cash, separate from TKDL coins"} href={`/career/${id}/finances`} icon={<CircleDollarSign aria-hidden />} />
      </div>
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
            saveId={id}
          />
        </CareerSection>
        <CareerSection title="Focus & goals" icon={<Target aria-hidden />} accent="#dbb866" action={<Link className="home-text-link" href={`/career/${id}/goals`}>Manage goals <ArrowUpRight aria-hidden /></Link>}>
          {goals.isLoading ? <CareerLoading label="Reading your goals" /> : goals.error ? <CareerError error={goals.error} onRetry={() => void goals.refetch()} /> :
            goals.data ? <div className="home-goals">
              <p className="home-focus">{goals.data.focusOptions.find(f => f.value === goals.data?.focus)?.label ?? "Career focus"} <span>OPTIONAL FOCUS</span></p>
              {goals.data.retired && <p className="home-muted">Retired Career: goals remain readable; no new sporting progress.</p>}
              {goals.data.goals.filter(g => g.status === "ACTIVE").length
                ? <ul>{goals.data.goals.filter(g => g.status === "ACTIVE").slice(0, 3).map(g => <li key={g.id}><span aria-hidden />{g.label}</li>)}</ul>
                : <CareerEmptyState title="No active personal goals">Goals are optional ambitions, not quests. They grant no points, money or unlocks.</CareerEmptyState>}
              <p className="home-goal-foot">{goals.data.goals.filter(g => g.status === "ACTIVE").length} active <span aria-hidden>·</span> no rewards or progression shortcuts</p>
            </div> : <CareerEmptyState title="No goals available" />}
        </CareerSection>
      </div>

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
          {history.isLoading ? <CareerLoading label="Reading recorded results" /> : history.error ? <CareerError error={history.error} onRetry={() => void history.refetch()} /> :
            history.data?.length ? <ul className="home-result-list">{history.data.slice(0, 4).map(row => <li key={row.eventId}>
              <CareerEventIdentity eventKey={row.definitionKey} circuit={row.circuit}><Link href={`/career/${id}/events/${row.eventId}`} className="home-result-link">
                <span className="home-result-season">S{row.season}<small>WK {row.week}</small></span>
                <span className="home-result-name"><strong>{row.name}</strong><small>{circuitLabel(row.circuit)} <span aria-hidden>·</span> {row.wins}W–{row.losses}L</small></span>
                <StatusBadge label={row.champion ? "Champion" : row.stageReached.replaceAll("_", " ")} tone={row.champion ? "gold" : "neutral"} />
              </Link></CareerEventIdentity>
            </li>)}</ul> : <CareerEmptyState title="No results yet">Your first finished event will appear here with its verified result.</CareerEmptyState>}
        </CareerSection>
        <CareerSection title="Latest sporting evidence" icon={<Award aria-hidden />} accent="#c9a96e" action={<Link className="home-text-link" href={`/career/${id}/my-career/achievements`}>Achievements <ArrowUpRight aria-hidden /></Link>}>
          {milestones.isLoading ? <CareerLoading label="Checking dated achievements" /> : milestones.error ? <CareerError error={milestones.error} onRetry={() => void milestones.refetch()} /> :
            milestones.data?.milestones.length ? <ol className="home-milestones">{milestones.data.milestones.slice(0, 4).map((milestone, index) => {
              const label = milestoneLabel(milestone);
              return <li key={milestone.id ?? `${milestone.kind}-${index}`}>
                <span className="home-milestone-date">S{milestone.season}<small>WK {milestone.week}</small></span>
                <span className="home-milestone-mark" aria-hidden />
                <span><strong>{label.title}</strong>{label.detail && <small>{label.detail}</small>}</span>
              </li>;
            })}</ol> : <CareerEmptyState title="No milestones recorded yet">Dated ranking and Tour Card milestones appear here when supported by sporting evidence.</CareerEmptyState>}
        </CareerSection>
      </div>

      <div className="home-two-column home-latest">
        <CareerSection title="Recent changes" icon={<History aria-hidden />} accent="#82a9d0" action={<Link className="home-text-link" href={`/career/${id}/my-career/history`}>Career history <ArrowUpRight aria-hidden /></Link>}>
          {legacy.isLoading ? <CareerLoading label="Checking Career changes" /> : legacy.error ? <CareerError error={legacy.error} onRetry={() => void legacy.refetch()} /> :
            legacy.data?.reviews?.length ? <div className="home-change-list">
              {legacy.data.reviews.slice(-3).reverse().map((review, index) => <p key={`${review.season}-${index}`}><span>S{review.season}</span>{review.identity}<small>{review.provenance === "CAPTURED" ? "Recorded season review" : "Reconstructed historical review"}</small><Link href={`/career/${id}/my-career/history`} aria-label={`Open season ${review.season} history`}><ArrowUpRight aria-hidden /></Link></p>)}
            </div> : <CareerEmptyState title="No season changes to report">Important changes and season reviews will be recorded here.</CareerEmptyState>}
        </CareerSection>
        <CareerSection title="Darts world" icon={<TrendingUp aria-hidden />} accent="#7ebbd3" action={<Link className="home-text-link" href={`/career/${id}/world`}>Explore world <ArrowUpRight aria-hidden /></Link>}>
          {life.isLoading ? <CareerLoading label="Checking the darts world" /> : life.error ? <CareerError error={life.error} onRetry={() => void life.refetch()} /> :
            life.data?.news.length ? <ul className="home-news">{life.data.news.slice(0, 3).map(n => <li key={n.id}><Link href={`/career/${id}/stories`}>{n.title}<ArrowUpRight aria-hidden /></Link></li>)}</ul> :
              <CareerEmptyState title="No recent developments">No new world news has been recorded. Results and standings remain available in Darts World.</CareerEmptyState>}
        </CareerSection>
      </div>

      {!retired && finance.data?.availableOffers ? <aside className="home-sponsor-alert"><span><strong>Sponsor decision available</strong><small>Review the offer terms and coverage before your next commitment.</small></span><Link href={`/career/${id}/finances`}>Review <ArrowUpRight aria-hidden /></Link></aside> : null}
    </main>
  );
}

function FactLink({ label, value, detail, href, icon }: { label: string; value: string; detail: string; href: string; icon: ReactNode }) {
  return <Link className="home-fact" href={href}>
    <span className="home-fact-icon">{icon}</span><span className="home-fact-copy"><small>{label}</small><strong>{value}</strong><span>{detail}</span></span><ArrowUpRight className="home-fact-arrow" aria-hidden />
  </Link>;
}

function RouteObjective({ loading, error, retry, events, hasCard, card, saveId }: {
  loading: boolean; error: unknown; retry: () => void; events: QualificationEvent[]; hasCard: boolean;
  card: { reviewSeason: number; retention: { maxPosition: number } } | null; saveId: string;
}) {
  if (loading) return <CareerLoading label="Checking qualification routes" />;
  if (error) return <CareerError error={error} onRetry={retry} />;
  if (hasCard && card) return <div className="home-objective">
    <span className="home-objective-icon"><Flag aria-hidden /></span><div><span className="home-objective-label">TOUR CARD RETENTION</span><h3>Hold position {ordinal(card.retention.maxPosition)} or higher</h3><p>Review at the end of Season {card.reviewSeason}. Your current published ranking is the sporting evidence.</p></div>
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

export function AgeLine({ saveId }: { saveId: string }) {
  const profile = useCareerProfile(saveId).data;
  if (profile?.status !== "COMPLETE") return null;
  const parts = [`Age ${profile.age}`, `Career started at ${profile.ageAtCareerStart}`];
  if (profile.junior) parts.push(`Junior events until you turn ${profile.juniorMaxAgeExclusive}`);
  if (!profile.qSchool.eligibleNow && profile.qSchool.eligibleFrom) parts.push(`Q-School from ${profile.qSchool.eligibleFrom.date}`);
  return <p className="home-age-line" style={OSWALD}>{parts.join(" · ")}</p>;
}
