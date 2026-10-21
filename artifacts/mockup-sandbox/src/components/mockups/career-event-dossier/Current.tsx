import { useState } from "react";
import {
  CalendarDays, ChevronRight, CircleDollarSign, MapPin, ShieldCheck, Ticket, Trophy,
} from "lucide-react";
import "./_group.css";

type EventTier = "WORLD" | "MAJOR" | "FEATURED" | "TELEVISED" | "STANDARD" | "LOCAL";
type CareerEvent = {
  id: string;
  season: number;
  name: string;
  circuit: string;
  presentation: { tier: EventTier; featured: boolean };
  dates: { startWeek: number; endWeek: number; startDayOfWeek: number };
  registration: { opensWeek: number; closesWeek: number };
  venue: { name: string; city: string; country: string; region: string };
  format: { gameType: string; startingScore: number; structure: string; stages: { bestOfByRound: number[] }[]; scoringUnit: "LEGS" | "SETS"; days: number; sideSize: number };
  capability: { executable: boolean; reasons?: string[] };
  field: { size: number; entrants: number };
  viability: { status: "PENDING" | "CONFIRMED" | "CANCELLED"; minimum: number; entrants: number | null } | null;
  status: string;
  statusReason: string | null;
  human: { relationship: string; eligible: boolean; eligibilityReasons: string[]; canEnter: boolean; denials: string[]; entryStatus: string | null } | null;
  finance: {
    estimatedPlayerCostPence: number; entryFeePence: number; estimatedTravelPence: number; estimatedAccommodationPence: number;
    sponsorCoverage: { entryFeePence: number; travelPence: number; accommodationPence: number };
    topPrizePence: number; rankingEligible: boolean; prizeBands: { upToPosition: number; amountPence: number }[];
  } | null;
  content: { summary: string; circuitName: string };
};

const event: CareerEvent = {
  id: "world-championship-2032",
  season: 2032,
  name: "World Championship",
  circuit: "WORLD_CHAMPIONSHIP",
  presentation: { tier: "WORLD", featured: true },
  dates: { startWeek: 49, endWeek: 50, startDayOfWeek: 4 },
  registration: { opensWeek: 42, closesWeek: 46 },
  venue: { name: "Alexandra Palace", city: "London", country: "United Kingdom", region: "England" },
  format: {
    gameType: "X01", startingScore: 501, structure: "KNOCKOUT",
    stages: [{ bestOfByRound: [5, 7, 9, 11, 13] }], scoringUnit: "SETS", days: 12, sideSize: 1,
  },
  capability: { executable: true },
  field: { size: 96, entrants: 84 },
  viability: { status: "CONFIRMED", minimum: 64, entrants: 84 },
  status: "REGISTRATION_OPEN",
  statusReason: null,
  human: { relationship: "QUALIFIED", eligible: true, eligibilityReasons: [], canEnter: true, denials: [], entryStatus: null },
  finance: {
    estimatedPlayerCostPence: 18_500, entryFeePence: 12_000, estimatedTravelPence: 3_500, estimatedAccommodationPence: 12_000,
    sponsorCoverage: { entryFeePence: 0, travelPence: 2_500, accommodationPence: 6_500 },
    topPrizePence: 500_000, rankingEligible: true,
    prizeBands: [{ upToPosition: 8, amountPence: 30_000 }, { upToPosition: 4, amountPence: 60_000 }, { upToPosition: 2, amountPence: 120_000 }, { upToPosition: 1, amountPence: 500_000 }],
  },
  content: {
    circuitName: "PDC World Championship",
    summary: "The season’s defining stage. Qualifiers and the world’s leading players compete for the Sid Waddell Trophy at Alexandra Palace.",
  },
};

const PLATE = "/__mockup/images/career-venues/career-venue-major-arena.jpg";
const tierLabel: Record<EventTier, string> = {
  WORLD: "World Championship", MAJOR: "Major", FEATURED: "Featured", TELEVISED: "Televised", STANDARD: "Standard", LOCAL: "Local event",
};

function formatPence(pence: number | null | undefined) {
  if (pence === null || pence === undefined) return "—";
  return `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: Number.isInteger(pence / 100) ? 0 : 2, maximumFractionDigits: 2 })}`;
}
function titleCase(value: string) {
  return value.toLowerCase().split(/[_\s-]+/).filter(Boolean).map(word => word[0].toUpperCase() + word.slice(1)).join(" ");
}
function eventDateLabel(e: CareerEvent) {
  return `Wk ${e.dates.startWeek}–${e.dates.endWeek}`;
}
function formatLabel(f: CareerEvent["format"]) {
  const range = f.stages[0]?.bestOfByRound ?? [];
  const bestOf = range.length ? `best of ${Math.min(...range)}–${Math.max(...range)} sets` : "";
  return `${f.startingScore} · knockout · ${bestOf}`;
}
function eventStatusLabel(e: CareerEvent) {
  if (!e.capability.executable) return "Intentionally benched";
  if (e.human?.relationship === "ENTERED" || e.human?.relationship === "CONFIRMED") return "Entered";
  if (e.human?.canEnter) return e.human.relationship === "QUALIFIED" ? "Qualified — enter now" : "Open for entry";
  return e.status === "REGISTRATION_OPEN" ? "Entries open" : titleCase(e.status);
}
function viabilityText(viability: CareerEvent["viability"]) {
  return viability?.status === "CONFIRMED"
    ? { label: "Field confirmed", detail: `${viability.entrants ?? "—"} entrants · ${viability.minimum} required to run` }
    : null;
}
function worthIt(finance: NonNullable<CareerEvent["finance"]>) {
  return {
    tone: "good",
    label: `${formatPence(finance.estimatedPlayerCostPence)} with travel. You get it back if you reach the quarter-finals.`,
    detail: `Quarter-finalists receive ${formatPence(finance.prizeBands.find(band => band.upToPosition === 8)?.amountPence)}.`,
  };
}

function EventStatus({ event: selectedEvent }: { event: CareerEvent }) {
  return <span className="cc-status cc-status--gold">{eventStatusLabel(selectedEvent)}</span>;
}

function EventMark({ event: selectedEvent }: { event: CareerEvent }) {
  return <span className="cc-event-mark cc-event-mark--venue" aria-hidden="true">
    <img src={PLATE} alt="" loading="lazy" decoding="async" />
    {(selectedEvent.presentation.tier === "WORLD" || selectedEvent.presentation.tier === "MAJOR") && <Trophy size={13} />}
  </span>;
}

export function Current() {
  const [entered, setEntered] = useState(false);
  const reasons = [...new Set([...(event.human?.eligibilityReasons ?? []), ...(event.human?.denials ?? [])])];
  const worth = event.finance ? worthIt(event.finance) : null;
  const viability = viabilityText(event.viability);
  return (
    <main className="cc-root">
      <aside id="event-dossier" className="cc-detail" data-tier={event.presentation.tier.toLowerCase()} aria-label="Selected event details">
        <div className="cc-detail-top">
          <span className="cc-kicker">EVENT DOSSIER</span>
          <span className="cc-detail-priority">{event.presentation.featured ? "FEATURED STOP" : tierLabel[event.presentation.tier]}</span>
        </div>
        <div className="cc-detail-banner"><img src={PLATE} alt="" loading="lazy" decoding="async"
          style={{ objectPosition: "50% 50%" }} />
          <span className="cc-detail-banner__caption"><Trophy size={13} /> SEASON {event.season} · WEEK {String(event.dates.startWeek).padStart(2, "0")}</span>
          <span className="cc-detail-banner__tier">{tierLabel[event.presentation.tier]}</span>
        </div>
        <div className="cc-detail-heading">
          <EventMark event={event} />
          <div><span className="cc-detail-circuit">{event.content.circuitName}</span><h2>{event.name}</h2></div>
        </div>
        {event.content?.summary && <p className="cc-detail-summary">{event.content.summary}</p>}
        <div className="cc-detail-status"><EventStatus event={event} />
          <span>{event.human?.eligible ? "Eligibility checked" : "Event information"}</span>
        </div>
        <div className="cc-detail-locations">
          <div><span className="cc-detail-icon"><CalendarDays size={15} /></span><span><small>EVENT WINDOW</small><strong>Season {event.season}</strong><em>{eventDateLabel(event)}</em></span></div>
          <div><span className="cc-detail-icon"><MapPin size={15} /></span><span><small>VENUE · {event.venue.city}</small><strong>{event.venue.name}</strong><em>{event.venue.region}, {event.venue.country}</em></span></div>
        </div>
        {event.presentation.tier === "WORLD" && (
          <div className="cc-world-note"><Trophy size={16} aria-hidden="true" /><span><strong>World Championship pathway</strong>
            <small>{event.human?.eligible ? "Your eligibility is confirmed for this event." : reasons.length ? titleCase(reasons[0]) : "Check your qualification route on the event page."}</small>
          </span></div>
        )}
        <section className="cc-detail-section">
          <div className="cc-detail-section-title"><span>ENTRY POSITION</span><i /></div>
          <div className="cc-entry-overview">
            <div className="cc-entry-field"><small>FIELD</small><strong>{event.field.entrants ?? "—"}<i>/</i>{event.field.size}</strong><span>entrants / capacity</span></div>
            <div className="cc-entry-side">
              <div><small>ENTRY WINDOW</small><strong>Weeks {event.registration.opensWeek}–{event.registration.closesWeek}</strong></div>
              <div><small>ELIGIBILITY</small><strong data-eligible={event.human?.eligible || undefined}>{event.human?.eligible ? "Eligible" : event.human ? "Not eligible" : "Details unavailable"}</strong></div>
              <div><small>YOUR ENTRY</small><strong>{titleCase(String(entered ? "ENTERED" : event.human?.entryStatus ?? event.human?.relationship ?? "Not entered").replaceAll("_", " "))}</strong></div>
              {viability && <div className="cc-viability"><small>FIELD STATUS</small><strong>{viability.label}</strong><span>{viability.detail}</span></div>}
            </div>
          </div>
        </section>
        <section className="cc-format-card">
          <span className="cc-format-score">{event.format.startingScore ?? "—"}</span>
          <span className="cc-format-copy"><small>TOURNAMENT FORMAT</small><strong>{formatLabel(event.format)}</strong><em>{event.format.scoringUnit === "SETS" ? "Set play" : "Leg play"} · {event.format.days} days</em></span>
        </section>
        {event.finance && (
          <section className="cc-cost-card">
            <div className="cc-cost-header">
              <div className="cc-cost-heading"><span><CircleDollarSign size={15} /> COST OUTLOOK</span><small>ESTIMATES</small></div>
              <div className="cc-cost-total"><span>Estimated player cost</span><strong>{formatPence(event.finance.estimatedPlayerCostPence)}</strong></div>
            </div>
            <div className="cc-cost-detail">
              <div className="cc-cost-lines">
                <span>Entry fee <b>{formatPence(event.finance.entryFeePence)}</b></span>
                <span>Travel estimate <b>{formatPence(event.finance.estimatedTravelPence)}</b></span>
                <span>Accommodation <b>{formatPence(event.finance.estimatedAccommodationPence)}</b></span>
              </div>
              <div className="cc-cost-lines cc-cost-lines--covered">
                <span>Sponsor covers entry <b className="cc-covered">{formatPence(event.finance.sponsorCoverage.entryFeePence)}</b></span>
                <span>Sponsor covers travel <b className="cc-covered">{formatPence(event.finance.sponsorCoverage.travelPence)}</b></span>
                <span>Sponsor covers stay <b className="cc-covered">{formatPence(event.finance.sponsorCoverage.accommodationPence)}</b></span>
              </div>
            </div>
            {worth && <p className="career-worth cc-cost-worth" data-tone={worth.tone}><strong>{worth.label}</strong> <small>{worth.detail}</small></p>}
            <div className="cc-cost-foot"><span>Top prize</span><strong>{formatPence(event.finance.topPrizePence)}</strong>
              <span>Ranking</span><strong>{event.finance.rankingEligible ? "Ranking event" : "Non-ranking"}</strong>
            </div>
          </section>
        )}
        {!event.capability.executable && (
          <div className="cc-info-note"><ShieldCheck size={15} /><span><strong>Informational event</strong><small>{event.capability.reasons?.[0] ?? "Playable event details are not available."}</small></span></div>
        )}
        {reasons.length > 0 && !event.human?.canEnter && (
          <div className="cc-entry-reasons"><span>ENTRY NOTES</span><p>{reasons.slice(0, 3).map(titleCase).join(" · ")}</p></div>
        )}
        <div className="cc-detail-actions">
          <button type="button" className="cc-button cc-button--primary" disabled={entered} onClick={() => setEntered(true)}>
            <Ticket size={16} />{entered ? "Entry confirmed" : "Enter · £185"}
          </button>
          <a className="cc-button cc-button--quiet" href="#event-dossier">Full event details <ChevronRight size={15} /></a>
        </div>
      </aside>
    </main>
  );
}
