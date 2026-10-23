import "./_group.css";
import "./Redesign.css";
import {
  ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, ChevronRight,
  CircleDot, Coins, FastForward, Gamepad2, Menu, Shield, Trophy,
} from "lucide-react";

const openEvents = [
  { name: "Kilbirnie Monday League", type: "Club league", date: "MON", week: "01", cost: "£2", detail: "Local · entry open" },
  { name: "Kilbirnie Wednesday Flier", type: "Midweek flier", date: "WED", week: "01", cost: "£3", detail: "Local · entry open" },
  { name: "Friday Night 501", type: "Grassroots", date: "FRI", week: "01", cost: "£5", detail: "Local · entry open" },
];

function DartboardArt() {
  return <div className="cp-red-art" aria-hidden="true"><div className="cp-board"><i /><i /><i /><i /><i /></div><span className="cp-art-label">THE<br />OCHE</span></div>;
}

export function Redesign() {
  return (
    <main className="cp-redesign">
      <div className="cp-red-wrap">
        <header className="cp-red-bar">
          <div className="cp-red-backdrop" aria-hidden="true" />
          <button className="cp-red-back" type="button" aria-label="Back to Career saves"><ArrowLeft /></button>
          <div className="cp-red-avatar" aria-hidden="true">MV</div>
          <div className="cp-red-identity">
            <span><b>CAREER MODE</b><i /> SEASON 01 <i /> WEEK 01</span>
            <strong>Mara Vance</strong>
            <div className="cp-red-meta"><span><Coins /> £4,250 balance</span><span><Shield /> Amateur</span></div>
          </div>
          <div className="cp-redbar-right"><span className="cp-red-sample">Illustrative save data</span><button className="cp-red-menu" type="button"><Menu /> Menu</button></div>
        </header>

        <div className="cp-red-page-kicker"><span>CAREER / PLAY</span><span className="cp-red-line" /><span>YOUR NEXT CHAPTER</span></div>
        <section className="cp-red-hero">
          <DartboardArt />
          <div className="cp-red-hero-copy">
            <div className="cp-red-eyebrow"><span className="cp-red-live" /> THE TOUR STARTS HERE</div>
            <h1>Find your<br /><em>next move.</em></h1>
            <p>Choose the next stop on your route. Every night at the oche is a chance to move up.</p>
            <div className="cp-red-hero-foot"><span><CircleDot /> CURRENT STATUS</span><b>Looking for your next event</b></div>
          </div>
          <div className="cp-red-tour">
            <span className="cp-red-tour-icon"><Trophy /></span>
            <div><small>THE BIG PICTURE</small><strong>Tour Card</strong><span>Amateur route · offer &amp; eligibility</span></div>
            <ChevronRight />
          </div>
        </section>

        <div className="cp-red-content">
          <section className="cp-red-main-panel">
            <header className="cp-red-section-head">
              <div><span className="cp-red-index">01 / PLAY</span><h2>Open doors</h2></div>
              <button type="button" className="cp-red-calendar"><CalendarDays /> Full calendar <ArrowUpRight /></button>
            </header>
            <div className="cp-red-events">
              {openEvents.map((event, i) => (
                <article className={`cp-red-event${i === 0 ? " is-featured" : ""}`} key={event.name}>
                  <div className="cp-red-date"><small>WK {event.week}</small><b>{event.date}</b></div>
                  <div className="cp-red-event-copy"><span>{event.type.toUpperCase()}</span><strong>{event.name}</strong><small>{event.detail} · illustrative event</small></div>
                  <div className="cp-red-cost"><small>ENTRY</small><b>{event.cost}</b></div>
                  <button className="cp-red-enter" type="button" aria-label={`Illustrative entry control for ${event.name}`}><span>Enter</span><ArrowRight /></button>
                </article>
              ))}
            </div>
            <footer className="cp-red-main-foot">
              <button className="cp-red-skip" type="button"><FastForward /> Skip ahead to the next date</button>
              <p>Illustrative controls · entry and progression are not connected.</p>
            </footer>
          </section>

          <aside className="cp-red-side">
            <section className="cp-red-booked">
              <header><span className="cp-red-live" /><span>ON THE CALENDAR</span><b>01</b></header>
              <div className="cp-red-booked-inner">
                <div className="cp-red-booked-art"><Gamepad2 /><span>BOOKED EVENT</span><small>ILLUSTRATIVE</small></div>
                <span className="cp-red-side-eyebrow">WEEK 01 · LOCAL</span>
                <h3>Kilbirnie Monday League</h3>
                <p>Club league · Monday night · Entered</p>
                <div className="cp-red-booked-link">Event details <ChevronRight /></div>
              </div>
            </section>
            <section className="cp-red-standing">
              <header><span>02 / STANDING</span><strong>Your season, at a glance</strong></header>
              <div className="cp-red-stat"><span>World rank</span><b>Unranked</b></div>
              <div className="cp-red-stat"><span>Tour Card</span><b>None</b></div>
              <div className="cp-red-stat"><span>Last result</span><b>None yet</b></div>
            </section>
          </aside>
        </div>

        <footer className="cp-red-footer">
          <a href="#" onClick={(event) => event.preventDefault()}><ArrowLeft /> Back to Career HQ <span>Goals · route · schedule · records</span><ArrowUpRight /></a>
          <div>All player, save, balance and event details shown are illustrative only.</div>
        </footer>
      </div>
    </main>
  );
}
