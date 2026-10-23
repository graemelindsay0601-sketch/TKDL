import "./_group.css";
import "./Current.css";
import {
  ArrowLeft, ArrowUpRight, CalendarDays, ChevronRight, CircleDot, Coins,
  FastForward, Gamepad2, Menu, Shield, Trophy,
} from "lucide-react";

const events = [
  { name: "Kilbirnie Monday League", type: "Club league", when: "Week 1 · Mon", cost: "£2" },
  { name: "Kilbirnie Wednesday Flier", type: "Midweek flier", when: "Week 1 · Wed", cost: "£3" },
  { name: "Kilbirnie Friday Night 501", type: "Grassroots", when: "Week 1 · Fri", cost: "£5" },
];

export function Current() {
  return (
    <main className="cp-current">
      <div className="cp-current-wrap">
        <header className="cp-current-bar">
          <div className="cp-current-stage" aria-hidden="true" />
          <div className="cp-current-bar-top">
            <button className="cp-back" type="button" aria-label="Back to Career saves"><ArrowLeft /></button>
            <div className="cp-player-mark" aria-hidden="true"><span>MV</span></div>
            <div className="cp-current-identity">
              <span className="cp-current-kicker"><b>Career</b> · S1 · Wk 1</span>
              <strong>Mara Vance</strong>
              <div className="cp-chips"><i><Coins /> £4,250</i><i><Shield /> Amateur</i></div>
            </div>
            <button className="cp-menu" type="button"><Menu /> Career sections</button>
          </div>
          <div className="cp-source-note">Illustrative sample save · not a real player or live save</div>
        </header>

        <section className="cp-current-next">
          <div className="cp-current-eyebrow"><span className="cp-live-dot" /> Play</div>
          <div className="cp-current-title-row">
            <div>
              <h1>Your next move</h1>
              <p>Welcome to your Career. Find your next event and get on the oche.</p>
            </div>
            <div className="cp-tour-offer"><Trophy /><span><b>Tour Card</b><small>Amateur route · eligibility details</small></span><ChevronRight /></div>
          </div>
          <div className="cp-current-lead">
            <div className="cp-lead-copy"><span className="cp-current-eyebrow">UP NEXT</span><strong>Pick an event to play</strong><small>Enter an event, or skip ahead to the next date.</small></div>
            <span className="cp-current-entry-pill"><CircleDot /> 3 open events</span>
          </div>
          <div className="cp-current-subhead">
            <span>Available events <small>· Week 1</small></span>
            <button type="button"><CalendarDays /> Full calendar</button>
          </div>
          <div className="cp-current-events">
            {events.map((event) => (
              <div className="cp-current-event" key={event.name}>
                <div className="cp-event-date"><b>W1</b><small>{event.when.split("·")[1]}</small></div>
                <div className="cp-event-name"><strong>{event.name}</strong><span>{event.type} · Illustrative event</span></div>
                <span className="cp-open">Open for entry</span>
                <button className="cp-enter" type="button">Enter · {event.cost}</button>
              </div>
            ))}
          </div>
          <button className="cp-skip" type="button"><FastForward /> Skip ahead to the next date</button>
          <p className="cp-disclaimer">Mockup controls only · no event entry or career advancement is connected.</p>
        </section>

        <section className="cp-current-card cp-booked">
          <header><span className="cp-live-dot" /><h2>Booked</h2><span className="cp-section-meta">1 upcoming event · illustrative</span></header>
          <div className="cp-booked-row">
            <span className="cp-booked-icon"><Gamepad2 /></span>
            <div><strong>Kilbirnie Monday League</strong><small>Club league · Week 1 · Local venue</small></div>
            <span className="cp-booked-status">Entered</span><ChevronRight />
          </div>
        </section>

        <section className="cp-current-card cp-standing">
          <div><span>World rank</span><strong>Unranked</strong></div>
          <div><span>Tour Card</span><strong>None</strong></div>
          <div><span>Last result</span><strong>None yet</strong></div>
        </section>
        <a className="cp-current-hq" href="#" onClick={(event) => event.preventDefault()}>Career HQ: goals, route, schedule and records <ArrowUpRight /></a>
        <div className="cp-current-footer">Current reference · Source-aligned Play composition · all sample values illustrative</div>
      </div>
    </main>
  );
}
