import { useMemo, useState } from "react";
import {
  CalendarDays, ChevronDown, Clock3, MapPin, Minus, Plus,
  ShieldCheck, Ticket, X,
} from "lucide-react";
import "./_group.css";

type CareerSave = {
  id: string; currentSeason: number; currentWeek: number; balancePence: number;
};
type EventFixture = {
  id: string; name: string; circuit: string; status: "REGISTRATION_OPEN" | "SCHEDULED" | "COMPLETED" | "CANCELLED";
  dates: { startWeek: number; endWeek: number; startDay: number; endDay: number; startDayOfWeek: number };
  venue: { city: string; country: string };
  human: { canEnter: boolean; relationship: string; conflictsWith: string[] };
  finance: {
    entryFeePence: number; estimatedTravelPence: number; estimatedAccommodationPence: number;
    sponsorCoverage: { entryFeePence: number; travelPence: number; accommodationPence: number };
    estimatedPlayerCostPence: number; balancePence: number; availablePence: number; topPrizePence: number;
  };
};

const save: CareerSave = { id: "career-season-two", currentSeason: 2, currentWeek: 18, balancePence: 30840 };
const eventFixtures: EventFixture[] = [
  { id:"nottingham-open", name:"Robin Hood Friday 501", circuit:"Grassroots · Local Series", status:"REGISTRATION_OPEN",
    dates:{startWeek:18,endWeek:18,startDay:123,startDayOfWeek:5,endDay:123}, venue:{city:"Nottingham",country:"United Kingdom"},
    human:{canEnter:true,relationship:"AVAILABLE",conflictsWith:[]},
    finance:{entryFeePence:500,estimatedTravelPence:150,estimatedAccommodationPence:200,sponsorCoverage:{entryFeePence:0,travelPence:0,accommodationPence:0},estimatedPlayerCostPence:850,balancePence:30840,availablePence:28200,topPrizePence:4500}},
  { id:"derby-open", name:"East Midlands Open", circuit:"Regional · Open Tour", status:"REGISTRATION_OPEN",
    dates:{startWeek:19,endWeek:19,startDay:130,startDayOfWeek:5,endDay:130}, venue:{city:"Derby",country:"United Kingdom"},
    human:{canEnter:true,relationship:"QUALIFIED",conflictsWith:["leicester-county"]},
    finance:{entryFeePence:1000,estimatedTravelPence:550,estimatedAccommodationPence:300,sponsorCoverage:{entryFeePence:0,travelPence:150,accommodationPence:0},estimatedPlayerCostPence:1700,balancePence:30840,availablePence:28200,topPrizePence:24000}},
  { id:"leicester-county", name:"County Championship — East", circuit:"County · Team Circuit", status:"REGISTRATION_OPEN",
    dates:{startWeek:20,endWeek:20,startDay:137,startDayOfWeek:5,endDay:137}, venue:{city:"Leicester",country:"United Kingdom"},
    human:{canEnter:true,relationship:"AVAILABLE",conflictsWith:["derby-open"]},
    finance:{entryFeePence:900,estimatedTravelPence:800,estimatedAccommodationPence:0,sponsorCoverage:{entryFeePence:300,travelPence:0,accommodationPence:0},estimatedPlayerCostPence:1400,balancePence:30840,availablePence:28200,topPrizePence:8000}},
  { id:"birmingham-masters", name:"National Amateur Masters", circuit:"National Amateur · Masters", status:"REGISTRATION_OPEN",
    dates:{startWeek:22,endWeek:22,startDay:151,startDayOfWeek:5,endDay:151}, venue:{city:"Birmingham",country:"United Kingdom"},
    human:{canEnter:true,relationship:"AVAILABLE",conflictsWith:[]},
    finance:{entryFeePence:2500,estimatedTravelPence:850,estimatedAccommodationPence:900,sponsorCoverage:{entryFeePence:1000,travelPence:250,accommodationPence:300},estimatedPlayerCostPence:2700,balancePence:30840,availablePence:28200,topPrizePence:125000}},
  { id:"antwerp-challenger", name:"Challenger Series — Antwerp", circuit:"Challenger · European Tour", status:"SCHEDULED",
    dates:{startWeek:23,endWeek:24,startDay:158,startDayOfWeek:5,endDay:163}, venue:{city:"Antwerp",country:"Belgium"},
    human:{canEnter:false,relationship:"NOT_ELIGIBLE",conflictsWith:[]},
    finance:{entryFeePence:6500,estimatedTravelPence:3600,estimatedAccommodationPence:2500,sponsorCoverage:{entryFeePence:0,travelPence:0,accommodationPence:0},estimatedPlayerCostPence:12600,balancePence:30840,availablePence:28200,topPrizePence:650000}},
  { id:"rotterdam-open", name:"Northern Europe Open", circuit:"European Series · Open", status:"REGISTRATION_OPEN",
    dates:{startWeek:24,endWeek:24,startDay:165,startDayOfWeek:5,endDay:165}, venue:{city:"Rotterdam",country:"Netherlands"},
    human:{canEnter:true,relationship:"AVAILABLE",conflictsWith:[]},
    finance:{entryFeePence:4200,estimatedTravelPence:2900,estimatedAccommodationPence:2700,sponsorCoverage:{entryFeePence:0,travelPence:1200,accommodationPence:600},estimatedPlayerCostPence:8000,balancePence:30840,availablePence:28200,topPrizePence:180000}},
  { id:"club-classic", name:"Midlands Club Classic", circuit:"Grassroots · Regional", status:"REGISTRATION_OPEN",
    dates:{startWeek:22,endWeek:22,startDay:151,startDayOfWeek:5,endDay:151}, venue:{city:"Coventry",country:"United Kingdom"},
    human:{canEnter:true,relationship:"AVAILABLE",conflictsWith:["birmingham-masters"]},
    finance:{entryFeePence:750,estimatedTravelPence:320,estimatedAccommodationPence:0,sponsorCoverage:{entryFeePence:0,travelPence:0,accommodationPence:0},estimatedPlayerCostPence:1070,balancePence:30840,availablePence:28200,topPrizePence:6500}},
  { id:"closed-event", name:"Leeds Spring Invitational", circuit:"Invitational · Open", status:"SCHEDULED",
    dates:{startWeek:25,endWeek:25,startDay:172,startDayOfWeek:5,endDay:172}, venue:{city:"Leeds",country:"United Kingdom"},
    human:{canEnter:false,relationship:"AVAILABLE",conflictsWith:[]},
    finance:{entryFeePence:1200,estimatedTravelPence:700,estimatedAccommodationPence:0,sponsorCoverage:{entryFeePence:0,travelPence:0,accommodationPence:0},estimatedPlayerCostPence:1900,balancePence:30840,availablePence:28200,topPrizePence:12000}},
  { id:"entered-cardiff", name:"Welsh Regional Open", circuit:"Regional · Open Tour", status:"REGISTRATION_OPEN",
    dates:{startWeek:21,endWeek:21,startDay:144,startDayOfWeek:5,endDay:144}, venue:{city:"Cardiff",country:"United Kingdom"},
    human:{canEnter:false,relationship:"ENTERED",conflictsWith:[]},
    finance:{entryFeePence:800,estimatedTravelPence:1100,estimatedAccommodationPence:450,sponsorCoverage:{entryFeePence:0,travelPence:0,accommodationPence:0},estimatedPlayerCostPence:2350,balancePence:30840,availablePence:28200,topPrizePence:18000}},
  { id:"finished-cup", name:"Spring County Cup", circuit:"County · Team Circuit", status:"COMPLETED",
    dates:{startWeek:18,endWeek:18,startDay:124,startDayOfWeek:6,endDay:124}, venue:{city:"Sheffield",country:"United Kingdom"},
    human:{canEnter:false,relationship:"COMPLETED",conflictsWith:[]},
    finance:{entryFeePence:500,estimatedTravelPence:900,estimatedAccommodationPence:0,sponsorCoverage:{entryFeePence:0,travelPence:0,accommodationPence:0},estimatedPlayerCostPence:1400,balancePence:30840,availablePence:28200,topPrizePence:7000}},
  { id:"cancelled-night", name:"Yorkshire Open Night", circuit:"Grassroots · Local Series", status:"CANCELLED",
    dates:{startWeek:25,endWeek:25,startDay:173,startDayOfWeek:6,endDay:173}, venue:{city:"York",country:"United Kingdom"},
    human:{canEnter:false,relationship:"AVAILABLE",conflictsWith:[]},
    finance:{entryFeePence:600,estimatedTravelPence:500,estimatedAccommodationPence:0,sponsorCoverage:{entryFeePence:0,travelPence:0,accommodationPence:0},estimatedPlayerCostPence:1100,balancePence:30840,availablePence:28200,topPrizePence:5000}},
];

const money = (pence: number) => `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: Number.isInteger(pence / 100) ? 0 : 2, maximumFractionDigits: 2 })}`;
const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const eventDay = (event: EventFixture) => dayNames[(event.dates.startDayOfWeek - 1 + 7) % 7];
const dateLabel = (event: EventFixture) => event.dates.startWeek === event.dates.endWeek
  ? `W${event.dates.startWeek} · ${eventDay(event)}` : `W${event.dates.startWeek}–${event.dates.endWeek}`;
const isSelectable = (event: EventFixture) => event.human.canEnter
  && !["ENTERED", "CONFIRMED", "PLAYING", "COMPLETED", "WITHDRAWN"].includes(event.human.relationship)
  && !["COMPLETED", "CANCELLED"].includes(event.status);

function rangesOverlap(a: EventFixture, b: EventFixture) {
  return a.dates.startDay <= b.dates.endDay && b.dates.startDay <= a.dates.endDay;
}

export function SeasonPlanner() {
  const horizonEnd = Math.min(52, save.currentWeek + 7);
  const [selected, setSelected] = useState<string[]>(["nottingham-open", "derby-open", "birmingham-masters"]);
  const [openWeeks, setOpenWeeks] = useState<number[]>([18, 19, 20, 22, 23, 24, 25]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [reviewComplete, setReviewComplete] = useState(false);
  const selectedEvents = useMemo(() => eventFixtures.filter(event => selected.includes(event.id)), [selected]);
  const candidates = eventFixtures.filter(event => event.dates.startWeek >= save.currentWeek && event.dates.startWeek <= horizonEnd);
  const totals = useMemo(() => selectedEvents.reduce((sum, event) => ({
    fee: sum.fee + event.finance.entryFeePence,
    travel: sum.travel + event.finance.estimatedTravelPence,
    stay: sum.stay + event.finance.estimatedAccommodationPence,
    coveredFee: sum.coveredFee + event.finance.sponsorCoverage.entryFeePence,
    coveredTravel: sum.coveredTravel + event.finance.sponsorCoverage.travelPence,
    coveredStay: sum.coveredStay + event.finance.sponsorCoverage.accommodationPence,
    net: sum.net + event.finance.estimatedPlayerCostPence,
    prizes: sum.prizes + event.finance.topPrizePence,
  }), { fee:0,travel:0,stay:0,coveredFee:0,coveredTravel:0,coveredStay:0,net:0,prizes:0 }), [selectedEvents]);
  const gross = totals.fee + totals.travel + totals.stay;
  const offset = totals.coveredFee + totals.coveredTravel + totals.coveredStay;
  const projection = save.balancePence - totals.net;
  const conflicts = selectedEvents.flatMap((event, index) => selectedEvents.slice(index + 1).flatMap(other => {
    const overlaps = rangesOverlap(event, other);
    const explicit = event.human.conflictsWith.includes(other.id) || other.human.conflictsWith.includes(event.id);
    return overlaps || explicit ? [{ first:event, second:other, overlaps, explicit }] : [];
  }));
  const eventConflicts = (event: EventFixture) => selectedEvents.filter(chosen => chosen.id !== event.id
    && (rangesOverlap(event, chosen) || event.human.conflictsWith.includes(chosen.id) || chosen.human.conflictsWith.includes(event.id)));

  const toggleEvent = (event: EventFixture) => {
    if (!isSelectable(event)) return;
    setConfirmation("");
    setReviewComplete(false);
    setSelected(current => current.includes(event.id) ? current.filter(id => id !== event.id) : [...current, event.id]);
  };
  const toggleWeek = (week: number) => setOpenWeeks(current => current.includes(week)
    ? current.filter(item => item !== week) : [...current, week]);

  return <main className="season-planner">
    <div className="sp-wrap">
      <header className="sp-hero">
        <div className="sp-hero-copy">
          <div className="sp-eyebrow"><i /> TKDL CAREER / SEASON PLANNER</div>
          <h1>Calendar <em>&amp;</em> Planning</h1>
          <p>Lay out the next eight weeks before you commit. Compare the stops, the travel, and what the season balance can carry.</p>
          <div className="sp-tags"><span className="sp-tag">SEASON {save.currentSeason}</span><span className="sp-tag muted">CURRENTLY AT WEEK {String(save.currentWeek).padStart(2,"0")}</span></div>
        </div>
        <div className="sp-progress">
          <div className="sp-progress-line"><span>SEASON PROGRESSION</span><strong>{String(save.currentWeek).padStart(2,"0")} <small>/ 52</small></strong></div>
          <div className="sp-track"><i style={{ width:`${(save.currentWeek / 52) * 100}%` }} /></div>
          <small>Amateur circuit · Week {save.currentWeek}</small>
        </div>
        <div className="sp-balance"><small>CAREER BALANCE</small><strong>{money(save.balancePence)}</strong><small>Current cash · before this plan</small></div>
      </header>

      <nav className="sp-nav" aria-label="Career navigation">
        <span>CAREER</span><i /><button type="button">Overview</button><button type="button" aria-current="page">Calendar</button><button type="button">My Entries</button><button type="button">Finance</button><button type="button">Sponsors</button>
      </nav>

      <div className="sp-board">
        <section className="sp-agenda sp-surface" aria-label="Upcoming event shortlist">
          <div className="sp-agenda-head">
            <div><span className="sp-kicker">NEXT ON THE TOUR</span><h2>Upcoming events <span className="sp-count">{String(candidates.length).padStart(2,"0")}</span></h2></div>
            <div className="sp-horizon"><CalendarDays size={14} /><span>PLANNING WINDOW</span><strong>8 WEEKS</strong></div>
          </div>
          <div className="sp-window"><Clock3 size={13} /> SEASON {save.currentSeason} <b>·</b> WEEKS {save.currentWeek}—{horizonEnd} <b>·</b> Selectable stops only</div>
          {Array.from(new Set(candidates.map(event => event.dates.startWeek))).sort((a,b) => a-b).map(week => {
            const weekEvents = candidates.filter(event => event.dates.startWeek === week);
            const isOpen = openWeeks.includes(week);
            return <section className="sp-week" key={week}>
              <button className="sp-week-head" type="button" aria-expanded={isOpen} onClick={() => toggleWeek(week)}>
                <CalendarDays size={14} /><strong>Week {String(week).padStart(2,"0")}</strong><small>{weekEvents.length} stop{weekEvents.length === 1 ? "" : "s"}</small><ChevronDown size={15} />
              </button>
              {isOpen && weekEvents.map(event => {
                const picked = selected.includes(event.id);
                const allowed = isSelectable(event);
                const clashes = eventConflicts(event);
                const unavailable = !allowed ? event.human.relationship === "NOT_ELIGIBLE" ? "Not eligible" :
                  event.status === "COMPLETED" ? "Completed" : event.status === "CANCELLED" ? "Cancelled" : "Entry unavailable" : "";
                return <article className="sp-event" key={event.id} data-picked={picked} data-blocked={!allowed}>
                  <button type="button" className="sp-event-main" aria-label={`${event.name}, ${dateLabel(event)}`} onClick={() => toggleEvent(event)}>
                    <span className="sp-date"><small>WEEK</small><b>{String(event.dates.startWeek).padStart(2,"0")}</b></span>
                    <span className="sp-event-copy"><strong>{event.name}</strong><small>{event.circuit} · {event.venue.city}, {event.venue.country} · {dateLabel(event)}</small></span>
                  </button>
                  <div className="sp-event-meta">
                    <span className={`sp-pill ${picked ? "selected" : !allowed ? "locked" : ""}`}>{picked ? "Shortlisted" : allowed ? "Open for entry" : unavailable}</span>
                    <small>{money(event.finance.estimatedPlayerCostPence)} net · prize {money(event.finance.topPrizePence)}</small>
                    {clashes.length > 0 && <small className="sp-conflict-flag">Conflicts with {clashes.map(clash => clash.name).join(", ")}</small>}
                    {allowed && <button type="button" className={`sp-pick ${picked ? "remove" : ""}`} aria-pressed={picked} onClick={() => toggleEvent(event)}>
                      {picked ? <><Minus size={13} /> Remove</> : <><Plus size={13} /> Shortlist</>}
                    </button>}
                  </div>
                </article>;
              })}
            </section>;
          })}
          <div className="sp-legend"><span><i /> Enterable</span><span><i className="picked" /> On your shortlist</span><span><i className="blocked" /> Not selectable</span></div>
        </section>

        <aside className="sp-plan sp-surface" aria-label="Tour plan and cash impact">
          <header className="sp-plan-head">
            <div className="sp-plan-head-line"><div><span className="sp-kicker">YOUR TOURING DESK</span><h2>Season shortlist</h2></div><span className="sp-plan-count">{selectedEvents.length} STOP{selectedEvents.length === 1 ? "" : "S"}</span></div>
            <p>Build a route across the window. Nothing is entered until you review your choices.</p>
          </header>
          {selectedEvents.length ? <div className="sp-shortlist">
            {selectedEvents.map(event => <div className="sp-shortlist-item" key={event.id}>
              <span className="sp-shortlist-date">{dateLabel(event)}</span>
              <span><strong>{event.name}</strong><small><MapPin size={10} /> {event.venue.city} · {money(event.finance.estimatedPlayerCostPence)} player cost</small></span>
              <button className="sp-remove" type="button" aria-label={`Remove ${event.name}`} onClick={() => toggleEvent(event)}><X size={14} /></button>
            </div>)}
          </div> : <div className="sp-empty"><Ticket size={22} /><strong>No stops shortlisted</strong><p>Choose any enterable event across the eight-week window to start mapping your season.</p></div>}

          {conflicts.length > 0 && <div className="sp-conflicts" role="status"><strong>Schedule needs a closer look</strong>
            {conflicts.map(({first,second,overlaps,explicit}) => <div key={`${first.id}-${second.id}`}>{first.name} and {second.name}: {overlaps ? "event dates overlap" : "event records identify a conflict"}{explicit && !overlaps ? " (listed conflict)" : ""}.</div>)}
          </div>}

          <section className="sp-finance" aria-label="Combined cash impact">
            <div className="sp-finance-top"><span>Combined gross costs</span><strong>{money(gross)}</strong></div>
            <div className="sp-finance-lines">
              <span>Entry fees</span><b>{money(totals.fee)}</b>
              <span>Travel estimates</span><b>{money(totals.travel)}</b>
              <span>Accommodation</span><b>{money(totals.stay)}</b>
              <div className="sp-finance-divider" />
              <span>Sponsor covers entry</span><b className="offset">−{money(totals.coveredFee)}</b>
              <span>Sponsor covers travel</span><b className="offset">−{money(totals.coveredTravel)}</b>
              <span>Sponsor covers stay</span><b className="offset">−{money(totals.coveredStay)}</b>
              <div className="sp-finance-divider" />
              <span>Net player cost</span><b>{money(totals.net)}</b>
            </div>
            <div className="sp-projection"><span>Projected balance<br />Current cash minus planned cost</span><strong>{money(projection)}</strong></div>
            <div className="sp-prize"><span>Potential prize upside</span><strong>Up to {money(totals.prizes)}</strong></div>
          </section>
          <p className="sp-disclaimer">Prize money is not counted in the projected balance. Costs and sponsor offsets use each event’s supplied finance estimate.</p>
          {confirmation && <p className="sp-toast" role="status">{confirmation}</p>}
          {reviewComplete && <p className="sp-local-note">Review acknowledged locally. Your entries and Career save are unchanged.</p>}
          <div className="sp-review"><button type="button" disabled={!selectedEvents.length} onClick={() => setReviewOpen(true)}><ShieldCheck size={15} /> Review &amp; confirm plan</button><small>Local preview only · no booking or entry</small></div>
        </aside>
      </div>
    </div>
    {reviewOpen && <div className="sp-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setReviewOpen(false); }}>
      <section className="sp-modal" role="dialog" aria-modal="true" aria-labelledby="sp-review-title">
        <div className="sp-kicker">FINAL REVIEW · LOCAL PREVIEW</div><h2 id="sp-review-title">Confirm this shortlist?</h2>
        <p>This is a planning confirmation only. No events will be booked or entered, and no Career save or balance will change.</p>
        <div className="sp-modal-summary"><span>{selectedEvents.length} event{selectedEvents.length === 1 ? "" : "s"} · estimated net cost</span><strong>{money(totals.net)}</strong></div>
        <div className="sp-modal-summary"><span>Projected cash after planned costs</span><strong>{money(projection)}</strong></div>
        <div className="sp-modal-actions"><button type="button" onClick={() => setReviewOpen(false)}>Back to shortlist</button><button type="button" onClick={() => { setReviewOpen(false); setReviewComplete(true); setConfirmation("Shortlist reviewed locally. No entry was submitted."); }}>Confirm review</button></div>
      </section>
    </div>}
  </main>;
}
