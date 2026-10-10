import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Activity, CalendarDays, ChevronLeft, ChevronRight, CircleDollarSign, Clock3,
  MapPin, ShieldCheck, Ticket, Trophy,
} from "lucide-react";
import { useCalendar, useEnterEvent, errorMessage, type CalendarQuery } from "../api";
import {
  CALENDAR_STATUS_FILTERS, TIER_STYLES, circuitLabel, denialLabel, eventDateLabel,
  eventStatus, formatLabel, formatPence, matchesStatusFilter, primaryAction,
} from "../model";
import {
  CareerEmptyState, CareerError, CareerLoading, Label, OSWALD, SeasonProgress, Segmented,
} from "../components";
import type { ShellContext } from "../shell";
import type { CareerEvent, PresentationTier } from "../types";
import "../career-calendar-premium.css";

type View = "MY_SCHEDULE" | "UPCOMING" | "SEASON";
const CIRCUITS = ["GRASSROOTS", "COUNTY", "REGIONAL", "NATIONAL_AMATEUR", "CHALLENGER", "VAULT", "Q_SCHOOL", "PRO_CIRCUIT", "EUROPEAN_SERIES", "WORLD_SERIES", "INVITATIONAL", "MAJOR", "WORLD_CHAMPIONSHIP", "SPECIAL"];
const PAGE_SIZE = 30;

function EventStatus({ event, awaitingMatch = false }: { event: CareerEvent; awaitingMatch?: boolean }) {
  const status = eventStatus(event, { awaitingMatch });
  return <span className={`cc-status cc-status--${status.tone}`}>{status.label}</span>;
}

function EventMark({ event }: { event: CareerEvent }) {
  const Icon = event.presentation.tier === "WORLD" || event.presentation.tier === "MAJOR" ? Trophy : Activity;
  return <span className="cc-event-mark" aria-hidden="true"><Icon size={17} /></span>;
}

function Select({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="cc-filter">
      <span>{label}</span>
      <select value={value} onChange={event => onChange(event.target.value)}>
        {options.map(([option, title]) => <option key={option} value={option}>{title}</option>)}
      </select>
    </label>
  );
}

function CalendarEventRow({
  event, active, awaitingMatch, saveId, retired, entering, onSelect, onEnter,
}: {
  event: CareerEvent;
  active: boolean;
  awaitingMatch: boolean;
  saveId: string;
  retired: boolean;
  entering: boolean;
  onSelect: () => void;
  onEnter: (id: string) => void;
}) {
  const action = primaryAction(event, { awaitingMatch, retired });
  const eventHref = awaitingMatch || (event.status === "IN_PROGRESS" && event.human?.relationship === "ENTERED")
    ? `/career/${saveId}/tournaments/${event.id}`
    : `/career/${saveId}/events/${event.id}`;
  return (
    <article className="cc-event-row" data-tier={event.presentation.tier.toLowerCase()} data-selected={active || undefined}>
      <button
        type="button"
        className="cc-event-select"
        aria-pressed={active}
        onClick={onSelect}
      >
        <span className="cc-event-week"><small>WEEK</small><strong>{String(event.dates.startWeek).padStart(2, "0")}</strong></span>
        <EventMark event={event} />
        <span className="cc-event-copy">
          <strong>{event.name}</strong>
          <span>{circuitLabel(event.circuit)} <i aria-hidden="true" /> {event.venue.city}, {event.venue.country}</span>
        </span>
        <span className="cc-event-status"><EventStatus event={event} awaitingMatch={awaitingMatch} />
          <small>{eventDateLabel(event)}</small>
        </span>
        <ChevronRight className="cc-event-chevron" size={16} aria-hidden="true" />
      </button>
      <div className="cc-row-action">
        {action.kind === "ENTER" ? (
          <button type="button" className="cc-button cc-button--primary" disabled={entering} onClick={() => onEnter(event.id)}>
            {entering ? "Entering…" : action.label}
          </button>
        ) : action.kind === "PLAY_MATCH" && action.enabled ? (
          <Link className="cc-button cc-button--primary" href={eventHref}>{action.label}</Link>
        ) : action.kind === "PLAY_MATCH" ? (
          <span className="cc-action-unavailable">Match unavailable</span>
        ) : action.kind === "CANNOT_AFFORD" || action.kind === "NOT_QUALIFIED" ? (
          <span className="cc-action-unavailable">{action.label}</span>
        ) : (
          <Link className="cc-button cc-button--quiet" href={eventHref}>{action.label}</Link>
        )}
      </div>
    </article>
  );
}

function SelectedEvent({
  event, saveId, awaitingMatch, retired, currentSeason, entering, onEnter,
}: {
  event: CareerEvent;
  saveId: string;
  awaitingMatch: boolean;
  retired: boolean;
  currentSeason: boolean;
  entering: boolean;
  onEnter: (id: string) => void;
}) {
  const action = primaryAction(event, { awaitingMatch, retired: retired || !currentSeason });
  const eventHref = awaitingMatch || (event.status === "IN_PROGRESS" && event.human?.relationship === "ENTERED")
    ? `/career/${saveId}/tournaments/${event.id}`
    : `/career/${saveId}/events/${event.id}`;
  const reasons = [...new Set([...(event.human?.eligibilityReasons ?? []), ...(event.human?.denials ?? [])])];
  return (
    <aside className="cc-detail" data-tier={event.presentation.tier.toLowerCase()} aria-label="Selected event details">
      <div className="cc-detail-top">
        <span className="cc-kicker">EVENT DOSSIER</span>
        <span className="cc-detail-priority">{event.presentation.featured ? "FEATURED STOP" : TIER_STYLES[event.presentation.tier].label}</span>
      </div>
      <div className="cc-detail-heading">
        <EventMark event={event} />
        <div><span className="cc-detail-circuit">{circuitLabel(event.circuit)}</span><h2>{event.name}</h2></div>
      </div>
      <div className="cc-detail-status"><EventStatus event={event} awaitingMatch={awaitingMatch} />
        <span>{event.human?.eligible ? "Eligibility checked" : "Event information"}</span>
      </div>
      <div className="cc-detail-locations">
        <div><span className="cc-detail-icon"><CalendarDays size={15} /></span><span><small>Event window</small><strong>Season {event.season} · {eventDateLabel(event)}</strong></span></div>
        <div><span className="cc-detail-icon"><MapPin size={15} /></span><span><small>Venue</small><strong>{event.venue.name}</strong><em>{event.venue.city}, {event.venue.region}</em></span></div>
      </div>
      {event.presentation.tier === "WORLD" && (
        <div className="cc-world-note"><Trophy size={16} aria-hidden="true" /><span><strong>World Championship pathway</strong>
          <small>{event.human?.eligible ? "Your eligibility is confirmed for this event." : reasons.length ? denialLabel(reasons[0]) : "Check your qualification route on the event page."}</small>
        </span></div>
      )}
      <section className="cc-detail-section">
        <div className="cc-detail-section-title"><span>ENTRY &amp; FIELD</span><i /></div>
        <div className="cc-facts-grid">
          <div><small>Entry window</small><strong>Weeks {event.registration.opensWeek}–{event.registration.closesWeek}</strong></div>
          <div><small>Field</small><strong>{event.field.entrants ?? "—"} / {event.field.size}</strong><em>entrants / capacity</em></div>
          <div><small>Eligibility</small><strong>{event.human?.eligible ? "Eligible" : event.human ? "Not eligible" : "Details unavailable"}</strong></div>
          <div><small>Entry status</small><strong>{event.human?.entryStatus ?? event.human?.relationship ?? "Not entered"}</strong></div>
        </div>
      </section>
      <section className="cc-format-card">
        <span className="cc-format-score">{event.format.startingScore ?? "—"}</span>
        <span><small>TOURNAMENT FORMAT</small><strong>{formatLabel(event.format)}</strong><em>{event.format.scoringUnit === "SETS" ? "Set play" : "Leg play"} · {event.format.days} day{event.format.days === 1 ? "" : "s"}</em></span>
      </section>
      {event.finance && (
        <section className="cc-cost-card">
          <div className="cc-cost-heading"><span><CircleDollarSign size={15} /> COST OUTLOOK</span><small>ESTIMATES</small></div>
          <div className="cc-cost-total"><span>Estimated player cost</span><strong>{formatPence(event.finance.estimatedPlayerCostPence)}</strong></div>
          <div className="cc-cost-lines">
            <span>Entry fee <b>{formatPence(event.finance.entryFeePence)}</b></span>
            <span>Travel estimate <b>{formatPence(event.finance.estimatedTravelPence)}</b></span>
            <span>Accommodation <b>{formatPence(event.finance.estimatedAccommodationPence)}</b></span>
            <span>Sponsor covers entry <b className="cc-covered">{formatPence(event.finance.sponsorCoverage.entryFeePence)}</b></span>
            <span>Sponsor covers travel <b className="cc-covered">{formatPence(event.finance.sponsorCoverage.travelPence)}</b></span>
            <span>Sponsor covers stay <b className="cc-covered">{formatPence(event.finance.sponsorCoverage.accommodationPence)}</b></span>
          </div>
          <div className="cc-cost-foot"><span>Top prize</span><strong>{event.finance.topPrizePence ? formatPence(event.finance.topPrizePence) : "None"}</strong>
            <span>Ranking</span><strong>{event.finance.rankingEligible ? "Ranking event" : "Non-ranking"}</strong>
          </div>
        </section>
      )}
      {!event.capability.executable && (
        <div className="cc-info-note"><ShieldCheck size={15} /><span><strong>Informational event</strong><small>{event.capability.reasons?.[0] ? denialLabel(event.capability.reasons[0]) : "Playable event details are not available."}</small></span></div>
      )}
      {reasons.length > 0 && !event.human?.canEnter && (
        <div className="cc-entry-reasons"><span>ENTRY NOTES</span><p>{reasons.slice(0, 3).map(denialLabel).join(" · ")}</p></div>
      )}
      <div className="cc-detail-actions">
        {action.kind === "ENTER" ? (
          <button type="button" className="cc-button cc-button--primary" disabled={entering || retired || !currentSeason} onClick={() => onEnter(event.id)}>
            <Ticket size={16} />{entering ? "Confirming entry…" : action.label}
          </button>
        ) : action.kind === "PLAY_MATCH" && action.enabled ? (
          <Link className="cc-button cc-button--primary" href={eventHref}><Ticket size={16} />{action.label}</Link>
        ) : action.kind === "PLAY_MATCH" ? (
          <button type="button" className="cc-button cc-button--quiet" disabled><Ticket size={16} />Match unavailable</button>
        ) : (
          <Link className="cc-button cc-button--primary" href={eventHref}><Ticket size={16} />View event</Link>
        )}
        <Link className="cc-button cc-button--quiet" href={`/career/${saveId}/events/${event.id}`}>Full event details <ChevronRight size={15} /></Link>
      </div>
    </aside>
  );
}

/** Career Calendar, grounded in the live save and its authoritative event/finance projections. */
export function CalendarPage({ ctx }: { ctx: ShellContext }) {
  const { save, retired } = ctx;
  const [view, setView] = useState<View>("UPCOMING");
  const [page, setPage] = useState(0);
  const [circuit, setCircuit] = useState("");
  const [tier, setTier] = useState("");
  const [status, setStatus] = useState("ALL");
  const [season, setSeason] = useState(save.currentSeason);
  const [focusWeek, setFocusWeek] = useState(save.currentWeek);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const isCurrentSeason = season === save.currentSeason;
  const fromWeek = isCurrentSeason ? Math.max(1, focusWeek - 2) : 1;
  const toWeek = Math.min(52, (isCurrentSeason ? focusWeek : 1) + 8);
  const query: CalendarQuery = view === "UPCOMING"
    ? { scope: "WORLD", season, fromWeek, toWeek, circuit: circuit || undefined }
    : { scope: "WORLD", season, circuit: circuit || undefined };
  const calendar = useCalendar(save.id, query);
  const enter = useEnterEvent(save.id);
  const pending = useMemo(() => new Set(calendar.data?.overview.pendingHumanMatches.map(item => item.eventId) ?? []), [calendar.data]);
  const events = useMemo(() => (calendar.data?.events ?? []).filter(event =>
    (view !== "MY_SCHEDULE" || event.human?.entryStatus || event.human?.relationship === "QUALIFIED")
    && (!tier || event.presentation.tier === tier)
    && matchesStatusFilter(event, status)
  ), [calendar.data, tier, status, view]);
  const selectedEvent = events.find(event => event.id === selectedId) ?? events[0];
  const groupings = calendar.data?.overview.groupings ?? [];
  const pageEvents = events.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const groups = useMemo(() => {
    const result = groupings.flatMap(group => {
      const groupEvents = pageEvents.filter(event => event.dates.startWeek >= group.fromWeek && event.dates.startWeek <= group.toWeek);
      return groupEvents.length ? [{ ...group, events: groupEvents }] : [];
    });
    if (result.length || pageEvents.length === 0) return result;
    return [{ key: "season", name: "Season schedule", fromWeek: 1, toWeek: 52, events: pageEvents }];
  }, [groupings, pageEvents]);
  const onEnter = (eventId: string) => {
    setMessage(null);
    enter.mutate(eventId, {
      onSuccess: result => setMessage(result.entered ? "Entry confirmed. Your schedule has been updated." : `Entry refused: ${result.denials.map(denialLabel).join(", ")}`),
      onError: error => setMessage(errorMessage(error)),
    });
  };
  const resetFilters = () => { setCircuit(""); setTier(""); setStatus("ALL"); setPage(0); };

  return (
    <div className="career-calendar-page cc-root">
      <header className="cc-hero">
        <div className="cc-hero-copy">
          <span className="cc-eyebrow"><CalendarDays size={14} /> CAREER / SEASON PLANNER</span>
          <h2>Calendar <em>&amp;</em> Planning</h2>
          <p>Plan the season around the events, entry windows and travel costs that matter to your career.</p>
          <div className="cc-hero-tags">
            <span className="cc-season-tag">SEASON {season}</span>
            <span className="cc-week-tag"><i /> CURRENTLY AT WEEK {String(save.currentWeek).padStart(2, "0")}</span>
          </div>
        </div>
        <div className="cc-hero-progress">
          <div className="cc-progress-label"><span>SEASON PROGRESSION</span><strong>{String(isCurrentSeason ? save.currentWeek : 52).padStart(2, "0")} <small>/ 52</small></strong></div>
          <SeasonProgress week={isCurrentSeason ? save.currentWeek : 52} groupings={groupings} current={calendar.data?.overview.grouping.key} />
          <span className="cc-progress-foot">{calendar.data?.overview.grouping.name ?? `Season ${season}`} · Week {isCurrentSeason ? save.currentWeek : 52}</span>
        </div>
        <div className="cc-hero-balance">
          <span className="cc-balance-icon"><CircleDollarSign size={17} /></span>
          <span>CAREER BALANCE</span>
          <strong>{formatPence(save.balancePence)}</strong>
          <small>Available for your next stop</small>
        </div>
        <span className="cc-hero-orbit" aria-hidden="true" />
      </header>

      <section className="cc-controls" aria-label="Calendar controls">
        <div className="cc-control-main">
          <div className="cc-view-heading"><span className="cc-control-icon"><CalendarDays size={16} /></span><span><strong>Tour planner</strong><small>Choose how you want to explore the season</small></span></div>
          <Segmented<View> label="Calendar view" value={view} onChange={next => { setView(next); setPage(0); setSelectedId(null); }} wrap options={[
            { value: "UPCOMING", label: "Timeline" },
            { value: "SEASON", label: "Season" },
            { value: "MY_SCHEDULE", label: "My Entries" },
          ]} />
          <label className="cc-season-select"><span>SEASON</span>
            <select value={season} onChange={event => { setSeason(Number(event.target.value)); setPage(0); setSelectedId(null); }}>
              {Array.from({ length: save.currentSeason }, (_, index) => save.currentSeason - index).map(value => <option key={value} value={value}>Season {value}</option>)}
            </select>
          </label>
        </div>
        <div className="cc-filters">
          <div className="cc-filter-title"><span>REFINE THE TOUR</span><button type="button" onClick={resetFilters}>Reset filters</button></div>
          <div className="cc-filter-grid">
            <Select label="Circuit" value={circuit} onChange={value => { setCircuit(value); setPage(0); }} options={[["", "All circuits"], ...CIRCUITS.map(value => [value, circuitLabel(value)] as [string, string])]} />
            <Select label="Event level" value={tier} onChange={value => { setTier(value); setPage(0); }} options={[["", "All levels"], ...(Object.keys(TIER_STYLES) as PresentationTier[]).map(value => [value, TIER_STYLES[value].label] as [string, string])]} />
            <Select label="Entry status" value={status} onChange={value => { setStatus(value); setPage(0); }} options={CALENDAR_STATUS_FILTERS.map(filter => [filter.key, filter.label])} />
          </div>
        </div>
        {message && <p role="status" className="cc-action-message">{message}</p>}
      </section>

      {view === "SEASON" && (
        <section className="cc-rhythm" aria-label="52-week season rhythm">
          <div className="cc-rhythm-heading"><div><span className="cc-kicker">THE FULL CAMPAIGN</span><h3>Season rhythm</h3></div>
            <span>{groupings.length} tour phases · {events.length} matching events</span>
          </div>
          <div className="cc-rhythm-groups">
            {groupings.map(group => <div key={group.key} className="cc-rhythm-group" style={{ flexGrow: group.toWeek - group.fromWeek + 1 }}>
              <strong>{group.name}</strong><small>W{group.fromWeek}—{group.toWeek}</small>
            </div>)}
          </div>
          <div className="cc-week-rail" aria-label={`Season ${season} weeks`}>
            {Array.from({ length: 52 }, (_, index) => {
              const week = index + 1;
              const hasEvent = events.some(event => event.dates.startWeek === week);
              return <span key={week} className={`${isCurrentSeason && week === save.currentWeek ? "is-current" : ""} ${hasEvent ? "has-event" : ""}`} title={`Week ${week}${hasEvent ? " · event scheduled" : ""}`} />;
            })}
          </div>
          <div className="cc-rhythm-key"><span><i className="is-current" />Current week · {String(save.currentWeek).padStart(2, "0")}</span><span><i className="has-event" />Event week</span></div>
        </section>
      )}

      {(calendar.data?.sponsorActivities?.length??0)>0&&<section className="pdc-card space-y-3 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3"><div><p className="cc-eyebrow">PARTNERSHIPS</p><h3 className="text-lg font-bold text-white">Sponsor commitments</h3></div>
          <Link href={`/career/${save.id}/sponsors`} className="text-xs font-semibold text-amber-200">Open Sponsor HQ →</Link></div>
        <div className="grid gap-2 md:grid-cols-2">{calendar.data!.sponsorActivities!.map(a=><article key={a.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="flex justify-between gap-2"><b className="text-sm text-white">{a.required?"Required":"Optional"} · {a.kind.replaceAll("_"," ")}</b><span className="text-[10px] uppercase text-amber-200">{a.status}</span></div>
          <p className="mt-1 text-xs text-white/55">{a.sponsor_key} · S{a.season} · {a.scheduled_week?`Scheduled W${a.scheduled_week}`:`Available W${a.available_from_week}–${a.to_week}`}</p>
        </article>)}</div>
      </section>}

      <div className="cc-content-grid">
        <section className="cc-agenda" aria-label="Event schedule">
          <div className="cc-agenda-header">
            <div><span className="cc-kicker">{view === "MY_SCHEDULE" ? "YOUR COMMITMENTS" : view === "SEASON" ? "THE CAMPAIGN" : "NEXT ON THE TOUR"}</span>
              <h3>{view === "MY_SCHEDULE" ? "My Entries" : view === "SEASON" ? "Season events" : "Upcoming events"} <span>{events.length.toString().padStart(2, "0")}</span></h3>
            </div>
            {view === "UPCOMING" && <div className="cc-week-controls">
              <button type="button" aria-label="Previous weeks" disabled={focusWeek <= 1} onClick={() => { setFocusWeek(week => Math.max(1, week - 2)); setPage(0); }}><ChevronLeft size={16} /></button>
              <button type="button" onClick={() => { setFocusWeek(save.currentWeek); setPage(0); }}>Today</button>
              <button type="button" aria-label="Next weeks" disabled={focusWeek >= 52} onClick={() => { setFocusWeek(week => Math.min(52, week + 2)); setPage(0); }}><ChevronRight size={16} /></button>
            </div>}
          </div>
          {view === "UPCOMING" && <div className="cc-window-label"><Clock3 size={13} /> Weeks {fromWeek}–{toWeek} <span>•</span> {isCurrentSeason ? `Season ${season}` : "Full season view"}</div>}
          {calendar.isLoading ? <div className="cc-state"><CareerLoading label="Loading your calendar" /></div>
            : calendar.error ? <div className="cc-state"><CareerError error={calendar.error} onRetry={() => calendar.refetch()} /></div>
            : groups.length === 0 ? (
              <div className="cc-state"><CareerEmptyState title={view === "MY_SCHEDULE" ? "No events in your schedule" : "No events match these filters"}>
                {view === "MY_SCHEDULE" ? <>Browse <button type="button" className="cc-inline-link" onClick={() => setView("UPCOMING")}>upcoming events</button> to find your next entry.</> : "Try another circuit, level or entry status."}
              </CareerEmptyState></div>
            ) : (
              <div className="cc-event-groups">
                {groups.map(group => <section className="cc-event-group" key={group.key} aria-label={`${group.name}, weeks ${group.fromWeek} to ${group.toWeek}`}>
                  <div className="cc-group-heading"><span className="cc-group-pin" /><strong>{group.name}</strong><i /><small>W{group.fromWeek}—{group.toWeek}</small></div>
                  <div className="cc-event-list">
                    {group.events.map(event => <CalendarEventRow key={event.id} event={event} active={selectedEvent?.id === event.id} awaitingMatch={pending.has(event.id)} saveId={save.id} retired={retired || !isCurrentSeason} entering={enter.isPending} onSelect={() => setSelectedId(event.id)} onEnter={onEnter} />)}
                  </div>
                </section>)}
              </div>
            )}
          <div className="cc-agenda-footer"><span>{events.length} event{events.length === 1 ? "" : "s"} match your view</span><span>Showing events from your Career save</span></div>
        </section>

        {selectedEvent ? <SelectedEvent event={selectedEvent} saveId={save.id} awaitingMatch={pending.has(selectedEvent.id)} retired={retired} currentSeason={isCurrentSeason} entering={enter.isPending} onEnter={onEnter} />
          : <aside className="cc-detail cc-detail--empty" aria-label="Selected event details"><CalendarDays size={24} /><strong>Select an event</strong><span>Choose an event in your season schedule to see its venue, entry status and cost outlook.</span></aside>}
      </div>
      <div className="cc-pagination">
        <button type="button" className="cc-button cc-button--quiet" disabled={page === 0} onClick={() => setPage(value => Math.max(0, value - 1))}>Previous events</button>
        <span>Page {page + 1} · {events.length} events</span>
        <button type="button" className="cc-button cc-button--quiet" disabled={(page + 1) * PAGE_SIZE >= events.length} onClick={() => setPage(value => value + 1)}>Next events</button>
      </div>
    </div>
  );
}
