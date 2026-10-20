import { useState } from "react";
import { Activity, ArrowUpRight, CalendarDays, Check, ChevronLeft, ChevronRight, Coins, MapPin, Shield, Target, Trophy, X } from "lucide-react";
import { CareerShell, Eyebrow } from "./_shared/CareerShell";
import "./_shared/career.css";
import "./_shared/pages.css";
import "./_shared/tkdl-theme.css";
import "./_group.css";

type PlanItem = { title: string; type: string; time: string; place: string; cost: string; accent: string };
const days = [
  { name: "Mon", date: "12", item: { title: "Practice session", type: "PRACTICE", time: "18:30", place: "The Robin Hood", cost: "£4", accent: "blue" } },
  { name: "Tue", date: "13", item: null },
  { name: "Wed", date: "14", item: { title: "County team night", type: "FIXTURE", time: "19:00", place: "Away · Derbyshire Arrows", cost: "£12", accent: "red" } },
  { name: "Thu", date: "15", item: null },
  { name: "Fri", date: "16", item: { title: "Recovery & review", type: "LIFE", time: "Free evening", place: "At home", cost: "Free", accent: "gold" } },
  { name: "Sat", date: "17", item: { title: "Robin Hood Open", type: "TOURNAMENT", time: "12:00", place: "The Robin Hood", cost: "£10", accent: "gold" } },
  { name: "Sun", date: "18", item: null },
];
const choices: PlanItem[] = [
  { title: "Club practice", type: "PRACTICE", time: "18:30 · 90 min", place: "The Robin Hood", cost: "£4", accent: "blue" },
  { title: "Local open night", type: "TOURNAMENT", time: "19:00 · doors open", place: "Nottingham Darts Social", cost: "£12", accent: "gold" },
  { title: "DartCast stream", type: "DARTCAST", time: "20:00 · 2 hours", place: "Your channel", cost: "Free", accent: "blue" },
];

export function Overview() {
  const [selected, setSelected] = useState(1);
  const [week, setWeek] = useState(18);
  const [booking, setBooking] = useState<PlanItem | null>(null);
  const [detail, setDetail] = useState<PlanItem | null>(null);
  const [confirmed, setConfirmed] = useState<Record<number, PlanItem>>({});
  const activeItem = confirmed[selected] ?? days[selected].item;
  const book = () => {
    if (booking) setConfirmed(old => ({ ...old, [selected]: booking }));
    setBooking(null);
  };
  return <CareerShell page="Overview">
    <div className="tk-home">
      <section className="overview-hero">
        <div className="hero-copy"><Eyebrow>SEASON 2 / WEEK 18 · CAREER HEADQUARTERS</Eyebrow><h1>Your next<br /><em>throw.</em></h1>
          <p>Build the week that builds your game. Your club, your money, your call.</p>
          <div className="hero-actions"><button className="tk-button primary" onClick={() => document.getElementById("week-planner")?.scrollIntoView({ behavior: "smooth" })}><CalendarDays size={16} /> Plan this week <ArrowUpRight size={15} /></button><button className="tk-button hero-outline" onClick={() => setDetail({ title: "Career pathways", type: "GUIDE", time: "Season 2", place: "Local to professional", cost: "Your pace", accent: "blue" })}>Career guide <ArrowUpRight size={14} /></button></div>
        </div>
        <div className="hero-stamp"><span>TKDL</span><b>18</b><small>WEEK<br />IN PLAY</small><div className="hero-target"><i /></div></div>
        <div className="hero-ribbon"><span><b>On fire</b> form</span><span><b>2nd</b> county league</span><span><b>£308</b> balance</span><span><b>Amateur</b> circuit</span></div>
      </section>
      <section id="week-planner" className="week-planner tk-card">
        <header className="tk-section-head"><h2><CalendarDays size={18} /> This week, at a glance</h2><div className="week-head-tools"><span>SEASON 2 · WEEK {week}</span><button className="tk-icon-button" aria-label="Previous week" onClick={() => setWeek(value => Math.max(1, value - 1))}><ChevronLeft size={17} /></button><button className="tk-icon-button" aria-label="Next week" onClick={() => setWeek(value => Math.min(52, value + 1))}><ChevronRight size={17} /></button></div></header>
        <div className="week-body">
          <div className="week-days" role="tablist" aria-label="Choose a day">
            {days.map((day, i) => <button key={day.name} role="tab" aria-selected={selected === i} className={`week-day ${selected === i ? "selected" : ""} ${day.item ? `has-${day.item.accent}` : ""}`} onClick={() => { setSelected(i); setBooking(null); }}>
              <span>{day.name}</span><b>{day.date}</b><i>{(confirmed[i] || day.item) ? <span /> : <span className="empty-dot" />}</i><small>{confirmed[i] ? "BOOKED" : day.item ? day.item.type : "OPEN"}</small>
            </button>)}
          </div>
          <div className="day-focus">
            <div className="day-focus-copy"><span className="day-date">{days[selected].name.toUpperCase()} · {days[selected].date} MARCH</span><h3>{days[selected].name}<span> / {days[selected].date}</span></h3>
              {activeItem ? <button className={`day-event event-${activeItem.accent}`} onClick={() => setDetail(activeItem)}>
                <span className="event-mark">{activeItem.type === "TOURNAMENT" ? <Trophy size={19} /> : activeItem.type === "FIXTURE" ? <Shield size={19} /> : <Activity size={19} />}</span>
                <span className="event-copy"><small>{activeItem.type} · {activeItem.time}</small><strong>{activeItem.title}</strong><span>{activeItem.place} <i>·</i> {activeItem.cost}</span></span><ArrowUpRight size={16} />
              </button> : <div className="day-open"><div><span className="open-dot" /><strong>Free to shape</strong><small>No fixture booked. Choose what moves your career forward.</small></div>
                <button className="tk-button primary" onClick={() => setBooking({ ...choices[0] })}>Book this day <ChevronRight size={15} /></button></div>}
            </div>
            <aside className="week-snapshot"><Eyebrow>WEEK LOAD</Eyebrow><div className="load-track"><i style={{ width: "57%" }} /></div><div className="snapshot-row"><span>4 of 7 days in play</span><b>57%</b></div><div className="snapshot-note"><Coins size={14} /><span>£282 available after planned costs</span></div></aside>
          </div>
          {confirmed[selected] && <p className="booking-confirmed" role="status"><Check size={15} /> {confirmed[selected].title} is booked for {days[selected].name} {days[selected].date} March. Your week is updated.</p>}
        </div>
      </section>
      <div className="overview-lower">
        <section className="tk-card decision-card"><div className="decision-top"><Eyebrow>DECISION WINDOW · CLOSES THIS WEEK</Eyebrow><span className="decision-badge">ENTRY OPEN</span></div><h2>East Midlands<br />Open</h2><p>One good run can move your county ranking. A sensible road trip, a serious field.</p><div className="decision-meta"><span><MapPin size={14} /> Nottingham</span><span><Coins size={14} /> £18 total</span><span><Trophy size={14} /> £240 winner</span></div><button className="tk-button quiet" onClick={() => setDetail({ title: "East Midlands Open", type: "AMATEUR OPEN", time: "Week 19 · Saturday", place: "Nottingham", cost: "£18 estimated", accent: "gold" })}>Review event <ArrowUpRight size={15} /></button><div className="decision-number">01</div></section>
        <section className="tk-card next-card"><div className="tk-section-head"><h2><Target size={18} /> On the horizon</h2><span>YOUR PATH</span></div><div className="path-progress"><div className="path-node done"><i /><span>Club nights</span><small>COMPLETE</small></div><div className="path-line"><i /></div><div className="path-node current"><i /><span>Amateur circuit</span><small>YOU ARE HERE</small></div><div className="path-line" /><div className="path-node"><i /><span>Professional</span><small>WHEN EARNED</small></div></div><p>Keep entering, keep winning. The route opens through results, not shortcuts.</p><a href="/__mockup/preview/career-redesign/MyCareer">Your player record <ArrowUpRight size={14} /></a></section>
      </div>
       <section className="tk-card quick-links"><div><Eyebrow>DIRECT ACCESS</Eyebrow><h2>Make the next call.</h2></div><button onClick={() => setDetail({ title: "Career money", type: "FINANCES", time: "Current balance", place: "Available for entries and travel", cost: "£308", accent: "gold" })}><Coins size={17} /><span>Money &amp; sponsors<small>£308 balance</small></span><ArrowUpRight size={15} /></button><a href="/__mockup/preview/career-redesign/Club"><Shield size={17} /><span>Club &amp; selection<small>The Robin Hood · Division 1</small></span><ArrowUpRight size={15} /></a><a href="/__mockup/preview/career-redesign/MyCareer"><Trophy size={17} /><span>Player record<small>Results, honours, identity</small></span><ArrowUpRight size={15} /></a></section>
    </div>
    {(booking || detail) && <div className="tk-modal-scrim" role="presentation" onClick={() => { setBooking(null); setDetail(null); }}>
      <section className="tk-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={e => e.stopPropagation()}>
        <button className="tk-icon-button modal-close" aria-label="Close" onClick={() => { setBooking(null); setDetail(null); }}><X size={18} /></button>
        {booking ? <><Eyebrow>BOOK AN ACTIVITY · {days[selected].name.toUpperCase()} 17</Eyebrow><h2 id="modal-title">Make this day count.</h2><p className="modal-intro">Choose one activity. You can change your mind before confirming.</p><div className="booking-choices">{choices.map(choice => <button key={choice.title} className={`booking-choice ${booking.title === choice.title ? "chosen" : ""}`} onClick={() => setBooking(choice)}><span className={`choice-icon ${choice.accent}`}><Activity size={17} /></span><span><strong>{choice.title}</strong><small>{choice.time} · {choice.place}</small></span><b>{choice.cost}</b></button>)}</div><div className="modal-footer"><button className="tk-button" onClick={() => setBooking(null)}>Cancel</button><button className="tk-button primary" onClick={book}><Check size={15} /> Confirm booking</button></div></>
          : <><Eyebrow>CAREER DETAILS</Eyebrow><h2 id="modal-title">{detail?.title}</h2><div className="detail-ticket"><span>{detail?.type}</span><strong>{detail?.time}</strong><p>{detail?.place}</p><b>{detail?.cost}</b></div><p className="modal-intro">Details are for this prototype. Your decisions stay in your Career.</p><div className="modal-footer"><button className="tk-button primary" onClick={() => setDetail(null)}>Back to this week <Check size={15} /></button></div></>}
      </section>
    </div>}
  </CareerShell>;
}
