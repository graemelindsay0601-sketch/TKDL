import { useState, type AnchorHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Award, Bell, BookOpen,
  Briefcase, CalendarDays, ChevronRight, CircleDollarSign, FastForward,
  Gamepad2, Globe2, History, House, LayoutGrid, Map, Medal, Moon, Search,
  Shield, Sparkles, Star, Target, TrendingUp, Trophy, UserRound, Users,
} from "lucide-react";
import "./_group.css";
import "./Redesign.css";

const save = {
  id: "career-save-01",
  name: "Ayrshire Debut",
  player: "Morgan Campbell",
  slot: 1,
  season: 1,
  week: 1,
  age: 24,
  balance: "£1,250",
  home: "Kilbirnie",
};

const navItems = [
  { label: "Home", icon: House, color: "#f14663" },
  { label: "Map", icon: Map, color: "#d9b96f" },
  { label: "Calendar", icon: CalendarDays, color: "#d9b96f" },
  { label: "Nights Out", icon: Moon, color: "#bba58d" },
  { label: "Darts World", icon: Globe2, color: "#8eaaa1" },
  { label: "My Career", icon: UserRound, color: "#c69b80" },
];

const days = [
  { day: "Mon", note: "Free", state: "open" },
  { day: "Tue", note: "Club night", state: "booked" },
  { day: "Wed", note: "Free", state: "open" },
  { day: "Thu", note: "Rest", state: "quiet" },
  { day: "Fri", note: "Open event", state: "open" },
  { day: "Sat", note: "Free", state: "open" },
  { day: "Sun", note: "Rest", state: "quiet" },
];

function LocalLink({ children, className = "", ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a href="#career-home" className={className} {...props}>{children}</a>;
}

function Header() {
  const [attention, setAttention] = useState(false);
  const [sections, setSections] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  return (
    <>
      <header className="cr-header">
        <div className="cr-brandline">
          <LocalLink className="cr-back" aria-label="Back to Career saves"><ArrowLeft size={16} /></LocalLink>
          <span className="cr-monogram">TKDL<span> / </span>CAREER</span>
          <span className="cr-slot">SAVE SLOT 0{save.slot}</span>
          <div className="cr-save-title"><strong>{save.name}</strong><span>Season {save.season} <i /> Week {save.week} <i /> Opening Swing</span></div>
          <button className="cr-continue" onClick={() => setNotice("Continue Career is safely stubbed in this static preview.")}>
            <FastForward size={15} /> Continue Career
          </button>
        </div>
        <div className="cr-tools">
          <button className="cr-tool cr-attention" onClick={() => setAttention(v => !v)} aria-expanded={attention}><Bell size={15} /> Attention <b>2</b></button>
          <button className="cr-tool" onClick={() => setSections(v => !v)} aria-expanded={sections}><LayoutGrid size={15} /> Career sections</button>
          <LocalLink className="cr-tool"><Gamepad2 size={15} /> Play mode</LocalLink>
          <form className="cr-search" onSubmit={e => { e.preventDefault(); setNotice(search ? `Search preview: “${search}”` : "Enter a player, event or venue to search."); }}>
            <Search size={15} />
            <label className="cr-visually-hidden" htmlFor="cr-search">Search the darts world</label>
            <input id="cr-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Players, events, venues" />
            <button type="submit">Search</button>
          </form>
          <LocalLink className="cr-tool-link">Career Guide</LocalLink>
          <LocalLink className="cr-tool-link">Save health</LocalLink>
        </div>
        {attention && <aside className="cr-popover cr-popover--attention"><span className="cr-eyebrow">CAREER UPDATES</span><strong>Two entry windows are open this week.</strong><p>Your first event is ready to choose.</p><LocalLink>Review updates <ArrowUpRight size={13} /></LocalLink></aside>}
        {sections && <aside className="cr-popover cr-popover--sections"><span className="cr-eyebrow">CAREER SECTIONS</span><div>{["Overview", "Calendar", "Rankings", "History"].map(item => <LocalLink key={item}>{item}<ArrowUpRight size={12} /></LocalLink>)}</div></aside>}
        {notice && <div className="cr-notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}
      </header>
      <nav className="cr-nav" aria-label="Career">
        {navItems.map(({ label, icon: Icon, color }, index) => <LocalLink key={label} className={`cr-nav-item${index === 0 ? " is-active" : ""}`} aria-current={index === 0 ? "page" : undefined} style={{ "--item-accent": color } as CSSProperties}>
          <Icon size={17} /><span>{label}</span>
        </LocalLink>)}
      </nav>
    </>
  );
}

function PlayerIdentity() {
  return <section className="cr-player" aria-label="Career headquarters">
    <div className="cr-player-art" aria-hidden="true">
      <div className="cr-art-rule" />
      <div className="cr-dartboard"><span /><i /><b /></div>
      <div className="cr-stage-lamp" />
      <span className="cr-art-coordinate">55°45′N<br />04°41′W</span>
      <span className="cr-art-season">S01 <i /> W01</span>
      <div className="cr-player-shirt"><img src="/__mockup/images/tkdl-premium-kit-redline.webp" alt="" /><span>LOCAL CLUB<br />PLAYER</span></div>
    </div>
    <div className="cr-player-copy">
      <span className="cr-eyebrow"><i /> CAREER HEADQUARTERS · SEASON 01 / WEEK 01</span>
      <p className="cr-player-name">{save.player}</p>
      <div className="cr-player-meta"><span>{save.home}, Scotland</span><i /> Amateur <i /> Age {save.age}</div>
      <div className="cr-player-actions">
        <LocalLink className="cr-action cr-action--gold"><CalendarDays size={15} /> Open calendar <ArrowUpRight size={13} /></LocalLink>
        <LocalLink className="cr-action"><TrendingUp size={15} /> Rankings <ArrowUpRight size={13} /></LocalLink>
      </div>
    </div>
    <div className="cr-record">
      <span className="cr-record-label">THE RECORD · S01</span>
      <div><small>WORLD RANK</small><strong>Unranked</strong></div>
      <div><small>TOUR CARD</small><strong>No Tour Card</strong><span>Q-School or Challenger Tour</span></div>
      <div><small>CAREER BALANCE</small><strong>{save.balance}</strong><span>£1,250 available</span></div>
      <div><small>SPONSOR</small><strong>Self-funded</strong></div>
    </div>
  </section>;
}

function DecisionDesk() {
  const [week, setWeek] = useState(1);
  const [selectedDay, setSelectedDay] = useState("");
  const [message, setMessage] = useState("");
  const activeDay = days.find(d => d.day === selectedDay);
  const handleEntry = () => setMessage("Entry review is available in the full Career save.");
  return <section className="cr-decision" aria-labelledby="cr-decision-title">
    <div className="cr-decision-top">
      <div className="cr-decision-label"><span className="cr-live-dot" /> THE NEXT DECISION <span className="cr-decision-count">01 / 01</span></div>
      <span className="cr-decision-week">SEASON 01 <i /> WEEK 01</span>
    </div>
    <div className="cr-decision-head">
      <div><h1 id="cr-decision-title">Make your<br /><em>first mark.</em></h1><p>One good place to begin. A local open, close to home.</p></div>
      <div className="cr-decision-mark" aria-hidden="true"><span>01</span><i /></div>
    </div>
    <article className="cr-event">
      <div className="cr-event-image" aria-hidden="true">
        <span className="cr-event-location">NORTH AYRSHIRE <i /> SCOTLAND</span>
        <div className="cr-event-board"><i /><b /><span /></div>
        <span className="cr-event-oche" />
        <span className="cr-event-vertical">GRASSROOTS CIRCUIT</span>
      </div>
      <div className="cr-event-body">
        <div className="cr-event-top"><span>WEEK 01 <i /> FRIDAY</span><span className="cr-open"><i /> ENTRY OPEN</span></div>
        <h2>North Ayrshire Open</h2>
        <p>Grassroots <i /> Kilbirnie <i /> Local open</p>
        <div className="cr-event-facts">
          <div><small>ENTRY</small><strong>£8</strong></div>
          <div><small>EST. TRAVEL</small><strong>£14</strong></div>
          <div><small>TOP PRIZE</small><strong>£120</strong></div>
        </div>
        <div className="cr-event-bottom">
          <button className="cr-review" onClick={handleEntry}>Review event <ArrowRight size={15} /></button>
          <span>Optional entry. Check schedule and cost first.</span>
        </div>
      </div>
    </article>
    {message && <p className="cr-feedback" role="status">{message}</p>}
    <div className="cr-planning">
      <div className="cr-planning-head"><span>YOUR WEEK, AT A GLANCE</span><div className="cr-week-tabs" role="tablist" aria-label="Select plan week">
        {[1, 2].map(n => <button key={n} role="tab" aria-selected={week === n} onClick={() => { setWeek(n); setSelectedDay(""); }}>{n === 1 ? "This week" : "Next week"} <small>Wk {n}</small></button>)}
      </div></div>
      <div className="cr-days">{days.map(item => <button key={item.day} data-state={item.state} aria-pressed={selectedDay === item.day} onClick={() => setSelectedDay(item.day)}>
        <span>{item.day}</span><b>{week === 2 && item.state === "open" ? "Open" : item.note}</b>
      </button>)}</div>
      <div className="cr-agenda">
        {activeDay ? <div className="cr-agenda-selected"><b>{activeDay.day}</b><span>{activeDay.note}{activeDay.day === "Tue" ? " · Kilbirnie Darts Club" : activeDay.day === "Fri" && week === 1 ? " · North Ayrshire Open" : ""}</span><small>{activeDay.day === "Tue" ? "Home club social night" : activeDay.day === "Fri" && week === 1 ? "Week 1 · £8 entry · about £14 estimated travel" : "No other commitment listed."}</small></div>
          : <><div><b>TUE</b><span>Club night · Kilbirnie Darts Club</span><small>Home club social night</small></div><div><b>FRI</b><span>North Ayrshire Open</span><small>Week 1 · £8 entry · about £14 estimated travel</small></div></>}
      </div>
    </div>
    <div className="cr-decision-foot"><span>Nothing booked yet. Choose when the schedule and cost work for you.</span><button onClick={() => setMessage("Continue is safely stubbed in this static preview.")}><FastForward size={14} /> Skip ahead to next date</button></div>
  </section>;
}

function RouteEngraving() {
  const routes = [
    { icon: Map, label: "SPORTING ROUTE", title: "Local & amateur", text: "Open for entry: North Ayrshire Open · week 1." },
    { icon: Shield, label: "SPORTING ROUTE", title: "County & national", text: "Selection status is not yet reported." },
    { icon: Users, label: "SPORTING ROUTE", title: "Modus & series", text: "No series event is listed in this calendar window." },
    { icon: Star, label: "PARALLEL ROUTE", title: "DartCast", text: "A streaming pathway alongside sporting progress." },
    { icon: Trophy, label: "PROFESSIONAL ROUTE", title: "Tour Card", text: "No Tour Card held. Q-School and Challenger routes." },
  ];
  return <section className="cr-routes" aria-labelledby="cr-routes-title">
    <header><div><span className="cr-eyebrow">A CAREER IS MORE THAN ONE ROUTE</span><h2 id="cr-routes-title">The road ahead</h2></div><p>Paths can overlap. DartCast runs in parallel; it is not a sporting qualification.</p></header>
    <div className="cr-route-rail" aria-label="Career pathways">
      {routes.map(({ icon: Icon, label, title, text }, index) => <article key={title} className={index === 0 ? "is-current" : ""}>
        <span className="cr-route-index">0{index + 1}</span><Icon size={17} /><small>{label}</small><h3>{title}</h3><p>{text}</p>
      </article>)}
    </div>
    <LocalLink className="cr-route-link">Explore Tour Card routes <ArrowUpRight size={14} /></LocalLink>
  </section>;
}

function Section({ icon: Icon, title, children, link }: { icon: typeof Target; title: string; children: ReactNode; link: string }) {
  return <section className="cr-support-section">
    <header><Icon size={16} /><h3>{title}</h3><LocalLink>{link}<ArrowUpRight size={12} /></LocalLink></header>{children}
  </section>;
}

function SupportingCareer() {
  return <details className="cr-support">
    <summary><span><span className="cr-eyebrow">IN YOUR CORNER</span><strong>More about your Career</strong></span><small>Guidance, goals, schedule, results and the world around you</small><ChevronRight size={18} /></summary>
    <div className="cr-support-content">
      <div className="cr-checklist">
        <div className="cr-support-title"><Sparkles size={16} /><span><b>Your first season</b><small>0 of 6 steps complete</small></span></div>
        <p>You start as an amateur at your local club with {save.balance}. Build your record one decision at a time.</p>
        <ol>
          <li><span>01</span><b>Pick your first event</b><small>Choose a local event near home.</small></li>
          <li><span>02</span><b>Play your first event</b></li>
          <li><span>03</span><b>Finish your first week</b></li>
          <li><span>04</span><b>Win some prize money</b></li>
          <li><span>05</span><b>Try a night out</b></li>
          <li><span>06</span><b>See your routes to a Tour Card</b></li>
        </ol>
      </div>
      <div className="cr-guidance">
        <span className="cr-eyebrow">CAREER GUIDE · GETTING STARTED</span><h3>Every route starts somewhere.</h3>
        <p>Play local events, learn your schedule and build experience. Qualification, rankings and progress come from the Career world.</p>
        <LocalLink>Read Career guidance <ArrowUpRight size={13} /></LocalLink>
      </div>
      <div className="cr-route-strip"><span>LOCAL &amp; AMATEUR</span><b>Club events</b><ChevronRight /><b>County circuit</b><ChevronRight /><b>National events</b><ChevronRight /><b>Q-School</b><ChevronRight /><b>Tour Card</b></div>
      <div className="cr-support-grid">
        <Section icon={Target} title="The route ahead" link="Qualification">
          <div className="cr-support-copy"><b>Your first milestone</b><p>Enter and complete a local event to start building a verified record. Qualification is based on event results and eligibility.</p></div>
        </Section>
        <Section icon={Sparkles} title="Career Compass" link="Focus & goals">
          <div className="cr-support-copy"><small>NEAR-TERM PREFERENCE</small><b>Build experience close to home</b><p>Your main ambition: win your first event.</p></div>
        </Section>
        <Section icon={CalendarDays} title="Entry windows" link="Full calendar">
          <div className="cr-list-row"><b>North Ayrshire Open</b><span>Week 1 · Registration open</span></div>
          <div className="cr-list-row"><b>West Scotland Ranking Event</b><span>Week 3 · Entry opens soon</span></div>
        </Section>
        <Section icon={CalendarDays} title="Your schedule" link="Plan the season">
          <div className="cr-support-copy"><b>No entered commitments nearby</b><p>Qualified does not mean entered. Choose an event when registration and schedule work.</p></div>
        </Section>
        <Section icon={Medal} title="Recent results" link="Full history">
          <div className="cr-empty">Your first finished event will appear here with its verified result.</div>
        </Section>
        <Section icon={Award} title="Latest milestones" link="Achievements">
          <div className="cr-empty">Your first ranking, Tour Card and other big moments will show here.</div>
        </Section>
        <Section icon={History} title="Recent changes" link="Career history">
          <div className="cr-empty">Important changes and season reviews will show here.</div>
        </Section>
        <Section icon={Globe2} title="Darts world" link="Explore world">
          <div className="cr-list-row"><b>World rankings refresh each week</b><span>Explore events, players and venues.</span></div>
        </Section>
      </div>
    </div>
  </details>;
}

export function Redesign() {
  return <div className="cr-app">
    <Header />
    <main id="career-home" className="cr-home">
      <PlayerIdentity />
      <DecisionDesk />
      <RouteEngraving />
      <aside className="cr-finance"><div className="cr-finance-mark"><Briefcase size={16} /></div><div><span>CAREER FINANCES</span><strong>Self-funded Career</strong><small>No sponsor decision is waiting.</small></div><LocalLink>Finances <ArrowUpRight size={14} /></LocalLink></aside>
      <SupportingCareer />
      <footer className="cr-footer"><span><CircleDollarSign size={13} /> Static Career save preview</span><span><BookOpen size={13} /> Local-only interactions</span></footer>
    </main>
  </div>;
}
